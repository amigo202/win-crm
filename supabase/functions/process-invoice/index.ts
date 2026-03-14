import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_KEY = () => Deno.env.get('GEMINI_API_KEY') || ''

// Israeli business expense categories
const CATEGORIES = [
  'משרד וציוד',
  'שיווק ופרסום',
  'תחבורה ונסיעות',
  'מזון ואירוח',
  'שירותים מקצועיים',
  'תוכנה ומנויים',
  'תחזוקה ותיקונים',
  'שכירות',
  'חשמל ומים',
  'ביטוח',
  'ציוד ומכשור',
  'הדרכה והשתלמות',
  'אחר',
]

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
    if (!imageBase64) return jsonRes({ error: 'imageBase64 is required' }, 400)
    if (!GEMINI_KEY()) return jsonRes({ error: 'GEMINI_API_KEY not configured' }, 500)

    const systemPrompt = `אתה מומחה לקריאת חשבוניות עסקיות ישראליות.

    נתחל תמונה/מסמך של חשבונית ותחלוץ את הנתונים הבאים:
    1. שם הספק/העסק שהוציא את החשבונית
    2. מספר חשבונית
    3. תאריך החשבונית (בפורמט YYYY-MM-DD)
    4. סכום לפני מע"מ (מספר בלבד)
    5. סכום מע"מ (מספר בלבד)
    6. סכום כולל לתשלום (מספר בלבד)
    7. תיאור/פירוט השירות או המוצר
    8. קטגוריה מתאימה לעסק מהרשימה: ${CATEGORIES.join(', ')}

    החזר JSON בלבד (ללא markdown, ללא הסברים) בפורמט:
    {
      "vendor": "שם הספק",
      "invoice_number": "מספר החשבונית",
      "invoice_date": "YYYY-MM-DD",
      "amount": 100.00,
      "vat_amount": 17.00,
      "total_amount": 117.00,
      "description": "תיאור השירות",
      "category": "קטגוריה מהרשימה"
    }

    אם שדה מסוים לא נמצא בתמונה, השתמש ב-null.
    אם אין מידע על מע"מ נפרד, הנח שהסכום הכולל כולל מע"מ 17% וחשב בהתאם.`

    const geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        role: 'user',
        parts: [
          { text: 'חלץ את פרטי החשבונית מהתמונה הבאה:' },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
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
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let extracted: Record<string, unknown> = {}
    try {
      // Try to parse JSON from response
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      // Fallback: return empty structure
      extracted = {
        vendor: null, invoice_number: null, invoice_date: null,
        amount: null, vat_amount: null, total_amount: null,
        description: rawText || null, category: 'אחר',
      }
    }

    // Ensure category is valid
    if (!CATEGORIES.includes(extracted.category as string)) {
      extracted.category = 'אחר'
    }

    // Derive month/year from invoice_date
    let month: number | null = null
    let year: number | null = null
    if (extracted.invoice_date) {
      const d = new Date(extracted.invoice_date as string)
      if (!isNaN(d.getTime())) {
        month = d.getMonth() + 1
        year  = d.getFullYear()
      }
    }

    return jsonRes({ ...extracted, month, year })

  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500)
  }
})
