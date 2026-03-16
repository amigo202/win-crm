import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_KEY = () => Deno.env.get('GEMINI_API_KEY') || ''

// ── Israeli tax categories with VAT deduction factors ─────────────
const CATEGORIES = [
  'marketing',       // שיווק ופרסום (Google/Meta ישראלי)     — VAT 100%
  'software_il',     // תוכנה/שירות ספק ישראלי               — VAT 100%
  'software_abroad', // SaaS/Cloud מחו"ל                      — VAT 0%
  'office',          // ציוד משרדי וחומרה                     — VAT 100%
  'professional',    // שירותים מקצועיים (רו"ח/עו"ד/ייעוץ)   — VAT 100%
  'communication',   // תקשורת ואינטרנט                       — VAT 100%
  'delivery',        // שליחויות והובלה                       — VAT 100%
  'freelancers',     // פרילנסרים/קבלני משנה                  — VAT 100%
  'car_fuel',        // רכב ודלק                              — VAT 66%
  'car_maintenance', // אחזקת רכב (מוסך/ביטוח רכב)           — VAT 66%
  'flights_hotels',  // נסיעות לחו"ל (טיסות/מלון)            — VAT 0%
  'food',            // כיבוד ומסעדות                         — VAT 0%
  'gifts',           // מתנות                                 — VAT 0%
  'home_office',     // הוצאות בית/משרד בבית                  — VAT 0%
  'insurance',       // ביטוח עסקי                            — VAT 100%
  'other',           // אחר / כללי                            — VAT 100%
] as const

// VAT deduction factors per Israeli tax law
const VAT_FACTORS: Record<string, number> = {
  marketing: 1, software_il: 1, office: 1, professional: 1,
  communication: 1, delivery: 1, freelancers: 1, insurance: 1, other: 1,
  car_fuel: 0.666, car_maintenance: 0.666,
  software_abroad: 0, flights_hotels: 0, food: 0, gifts: 0, home_office: 0,
}

const SYSTEM_PROMPT = `אתה רואה חשבון ישראלי מומחה המנתח חשבוניות ומסמכים פיננסיים.
תפקידך לקבוע האם המסמך הוא חשבונית מס/קבלה תקינה, ואם כן — לחלץ את הנתונים.

**מה היא חשבונית תקינה (is_valid_invoice=true)?**
חשבונית תקינה חייבת לכלול את כל אלה:
1. שם הספק/העסק
2. סכום סופי לתשלום
3. תאריך המסמך
4. מספר חשבונית/אסמכתא

**מה לדחות (is_valid_invoice=false)?**
- מיילים שיווקיים / ניוזלטרים / תוכן פרסומי
- אישורי הזמנה ללא חשבונית מצורפת
- הודעות מעקב חבילה / shipping notifications
- הודעות אי-מענה / password reset / ברוכים הבאים
- לוגואים, תמונות decorative, screenshots של אפליקציות
- מסמכים ללא סכום כספי ברור

**כללי חילוץ:**
- vendor_name: שם העסק/חברה (עברית או אנגלית)
- total_amount: סכום סופי כולל מע"מ — מספר חיובי בלבד
- currency: ₪→ILS, $→USD, €→EUR
- invoice_date: YYYY-MM-DD (המר DD/MM/YYYY ישראלי לפורמט זה!)
- invoice_number: מספר חשבונית/אסמכתא
- suggested_category: קטגוריה לפי סוג הספק
- is_valid_invoice: true רק אם יש ספק + סכום + תאריך + נראה כמסמך מס אמיתי
- confidence: 0-1 (מתחת ל-0.5 = כנראה לא חשבונית)
- rejection_reason: אם is_valid_invoice=false — סיבת הדחייה בקצרה

**ישראלי ספציפי:**
- שיעור מע"מ: 18%
- פורמט תאריך נפוץ: DD/MM/YYYY — יש להמיר ל-YYYY-MM-DD
- סמל ₪ = מטבע ILS`

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType = 'image/jpeg', text, subject, from } = await req.json()
    if (!imageBase64 && !text) return jsonRes({ error: 'imageBase64 or text is required' }, 400)
    if (!GEMINI_KEY()) return jsonRes({ error: 'GEMINI_API_KEY not configured' }, 500)

    // Build Gemini content parts — image/PDF or text
    const userParts: unknown[] = text
      ? [{ text: `נושא: ${subject || ''}\nמאת: ${from || ''}\n\nתוכן המייל:\n${text.slice(0, 5000)}` }]
      : [
          { text: 'נתח את חשבונית/מסמך זה וחלץ את הנתונים:' },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ]

    // ── Gemini function calling (tools) — guarantees structured JSON ─
    const geminiBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: userParts }],
      tools: [{
        function_declarations: [{
          name: 'extract_invoice_data',
          description: 'Extract structured data from an invoice. Return is_valid_invoice=false for non-invoice documents.',
          parameters: {
            type: 'OBJECT',
            properties: {
              vendor_name:        { type: 'STRING',  description: 'Business/vendor name.' },
              total_amount:       { type: 'NUMBER',  description: 'Total amount including VAT. Positive number only.' },
              currency:           { type: 'STRING',  enum: ['ILS', 'USD', 'EUR'] },
              invoice_date:       { type: 'STRING',  description: 'Invoice date in YYYY-MM-DD format.' },
              invoice_number:     { type: 'STRING',  description: 'Invoice or receipt reference number.' },
              suggested_category: { type: 'STRING',  enum: [...CATEGORIES] },
              is_valid_invoice:   { type: 'BOOLEAN', description: 'true only if real tax document with amount+vendor+date.' },
              confidence:         { type: 'NUMBER',  description: 'Confidence score 0-1.' },
              rejection_reason:   { type: 'STRING',  description: 'If invalid: short reason why (e.g. "marketing email").' },
            },
            required: ['is_valid_invoice', 'confidence'],
          },
        }],
      }],
      tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['extract_invoice_data'] } },
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return jsonRes({ error: 'Gemini API error: ' + err }, 500)
    }

    const geminiData = await geminiRes.json()

    // Extract from function call response
    const fc = geminiData?.candidates?.[0]?.content?.parts?.[0]?.functionCall
    const extracted: Record<string, unknown> = fc?.args || {}

    // Not a valid invoice — return signal without saving
    if (extracted.is_valid_invoice === false) {
      return jsonRes({
        is_valid_invoice: false,
        confidence:       Number(extracted.confidence) || 0,
        rejection_reason: (extracted.rejection_reason as string) || 'לא זוהה כחשבונית מס תקינה',
      })
    }

    // Normalise currency
    let currency = (extracted.currency as string) || 'ILS'
    if (currency === '₪') currency = 'ILS'
    if (currency === '$') currency = 'USD'
    if (currency === '€') currency = 'EUR'

    const isForeign    = currency !== 'ILS'
    const vatRate      = isForeign ? 0 : 0.18
    const totalAmt     = Number(extracted.total_amount) || null
    const vatAmount    = (totalAmt && !isForeign)
      ? Math.round((totalAmt / 1.18) * 0.18 * 100) / 100
      : null
    const amountPreVat = (totalAmt && !isForeign)
      ? Math.round((totalAmt / 1.18) * 100) / 100
      : totalAmt

    const category   = (CATEGORIES as readonly string[]).includes(extracted.suggested_category as string)
      ? (extracted.suggested_category as string)
      : 'other'
    const vatFactor  = VAT_FACTORS[category] ?? 1
    const recoverableVat = vatAmount !== null
      ? Math.round(vatAmount * vatFactor * 100) / 100
      : null

    // Derive month/year from invoice_date
    let month: number | null = null
    let year:  number | null = null
    if (extracted.invoice_date) {
      const d = new Date(extracted.invoice_date as string)
      if (!isNaN(d.getTime())) {
        month = d.getMonth() + 1
        year  = d.getFullYear()
      }
    }

    return jsonRes({
      // Core invoice fields (mapped to our DB schema)
      vendor:         extracted.vendor_name   || null,
      invoice_number: extracted.invoice_number || null,
      invoice_date:   extracted.invoice_date   || null,
      amount:         amountPreVat,
      vat_amount:     vatAmount,
      total_amount:   totalAmt,
      category,
      month,
      year,
      description:    null,

      // Israeli tax fields
      currency,
      vat_rate:            vatRate,
      vat_factor:          vatFactor,
      recoverable_vat:     recoverableVat,
      is_foreign_currency: isForeign,

      // AI metadata
      is_valid_invoice: true,
      confidence:       Number(extracted.confidence) || 1,
      ai_analyzed:      true,
    })

  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500)
  }
})
