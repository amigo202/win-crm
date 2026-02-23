// WIN CRM — crm-agent Edge Function
// POST /functions/v1/crm-agent
// Body: { message: string, context: { contacts: [{id, name}][] } }
// Headers: Authorization: Bearer <user-jwt>
//
// Deploy: supabase functions deploy crm-agent
// Secrets (at least one required):
//   supabase secrets set GEMINI_API_KEY=AIza...         ← preferred
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   ← fallback

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ContactCtx { id: string; name: string; phone?: string }

interface ActionCreateTask {
  type: 'create_task'
  data: { title: string; contactName?: string; dueDate?: string; priority?: string }
}
interface ActionCreateContact {
  type: 'create_contact'
  data: { name: string; phone?: string; email?: string; type?: string; notes?: string }
}
interface ActionCreateDeal {
  type: 'create_deal'
  data: { title: string; contactName?: string; value?: number; stage?: string }
}
interface ActionCreateLead {
  type: 'create_lead'
  data: { name: string; phone?: string; email?: string; source?: string; notes?: string }
}

type CrmAction = ActionCreateTask | ActionCreateContact | ActionCreateDeal | ActionCreateLead

interface ClaudeResponse {
  actions: CrmAction[]
  response: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(contacts: ContactCtx[]): string {
  const contactList = contacts.length
    ? contacts.map(c => `  - "${c.name}" (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  return `אתה עוזר AI למערכת CRM בשם WIN CRM.
המשתמש כותב לך בעברית בשפה חופשית. תפקידך לנתח את הבקשה ולהפיק פעולות CRM מובנות.

אנשי הקשר הקיימים במערכת:
${contactList}

פעולות אפשריות (type):

1. create_task — יצירת משימה
   data: { title: string, contactName?: string, dueDate?: string (YYYY-MM-DD), priority?: "low"|"medium"|"high" }
   דוגמה: "להתקשר לאבי מחר" → create_task עם title="להתקשר לאבי", dueDate=מחר

2. create_contact — הוספת איש קשר
   data: { name: string, phone?: string, email?: string, type?: "lead"|"customer"|"partner"|"vendor", notes?: string }

3. create_deal — יצירת עסקה
   data: { title: string, contactName?: string, value?: number, stage?: "lead"|"meeting"|"proposal"|"signed"|"active" }
   אם המשתמש אומר "עסקה על סך X ₪" — שים את X ב-value

4. create_lead — הוספת ליד לפייפליין
   data: { name: string, phone?: string, email?: string, source?: "website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual", notes?: string }

5. open_whatsapp — פתיחת שיחת WhatsApp עם איש קשר
   data: { contactName: string }
   דוגמה: "שלח ווצאפ לדני" → open_whatsapp עם contactName="דני"

כללים:
- תוכל להפיק מספר פעולות מבקשה אחת (למשל: הוסף איש קשר + עסקה)
- כאשר המשתמש מזכיר שם של איש קשר קיים, השתמש ב-contactName המדויק כפי שמופיע ברשימה
- תאריך "מחר" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- תאריך "היום" = ${new Date().toISOString().split('T')[0]}
- ענה בעברית בשדה "response"
- החזר JSON בלבד, ללא טקסט נוסף

פורמט תשובה חובה:
{
  "actions": [ { "type": "...", "data": { ... } }, ... ],
  "response": "תיאור קצר בעברית של מה שעשית"
}`
}

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── AI provider: Gemini (preferred) or Claude (fallback) ─────────────────────

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const geminiKey    = Deno.env.get('GEMINI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  // ── Gemini ──────────────────────────────────────────────────────────────
  if (geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',   // Gemini returns clean JSON
        },
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err}`)
    }
    const body = await res.json()
    return body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  }

  // ── Claude fallback ──────────────────────────────────────────────────────
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API error ${res.status}: ${err}`)
    }
    const body = await res.json()
    return body.content?.[0]?.text ?? '{}'
  }

  throw new Error('No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY.')
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    const { message, context } = await req.json() as { message: string; context?: { contacts?: ContactCtx[] } }
    if (!message?.trim()) return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // User-scoped client — RLS applies, auth.uid() works
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts: ContactCtx[] = context?.contacts ?? []

    // ── Call AI (Gemini preferred, Claude fallback) ────────────────────────
    const rawText = await callAI(buildSystemPrompt(contacts), message.trim())

    let parsed: ClaudeResponse
    try {
      const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { actions: [], response: rawText }
    }

    // ── Execute actions ────────────────────────────────────────────────────
    const actions_taken: { type: string; summary: string }[] = []

    const resolveContactId = (name?: string): string | null => {
      if (!name) return null
      const match = contacts.find(c =>
        c.name.trim().toLowerCase() === name.trim().toLowerCase()
      )
      return match?.id ?? null
    }

    for (const action of (parsed.actions ?? [])) {
      try {
        if (action.type === 'create_task') {
          const d = action.data
          const contactId = resolveContactId(d.contactName)
          const { error } = await supabase.from('tasks').insert({
            title:      d.title,
            contact_id: contactId,
            due_date:   d.dueDate ?? null,
            priority:   d.priority ?? 'medium',
            completed:  false,
          })
          if (error) throw error
          actions_taken.push({ type: 'create_task', summary: `משימה: "${d.title}"` })

        } else if (action.type === 'create_contact') {
          const d = action.data
          const { error } = await supabase.from('contacts').insert({
            name:   d.name,
            phone:  d.phone ?? null,
            email:  d.email?.toLowerCase() ?? null,
            type:   d.type ?? 'lead',
            status: 'lead',
            notes:  d.notes ? [{ id: crypto.randomUUID(), text: d.notes, date: new Date().toISOString() }] : [],
            activities:      [],
            tags:            [],
            active_programs: [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_contact', summary: `איש קשר: "${d.name}"` })

        } else if (action.type === 'create_deal') {
          const d = action.data
          const contactId = resolveContactId(d.contactName)
          const { error } = await supabase.from('deals').insert({
            title:      d.title,
            contact_id: contactId,
            value:      d.value ?? 0,
            stage:      d.stage ?? 'lead',
          })
          if (error) throw error
          actions_taken.push({ type: 'create_deal', summary: `עסקה: "${d.title}"${d.value ? ` — ₪${d.value.toLocaleString()}` : ''}` })

        } else if (action.type === 'create_lead') {
          const d = action.data
          const now = new Date().toISOString()
          // Insert lead contact
          const { data: contact, error: cErr } = await supabase.from('contacts').insert({
            name:            d.name,
            phone:           d.phone ?? null,
            email:           d.email?.toLowerCase() ?? null,
            source:          d.source ?? 'manual',
            lead_stage:      'new',
            status:          'lead',
            last_activity_at: now,
            notes:           [],
            activities:      [],
            tags:            [],
            active_programs: [],
          }).select('id').single()
          if (cErr) throw cErr
          // Auto follow-up task
          await supabase.from('tasks').insert({
            contact_id:     contact.id,
            title:          `פולואפ עם ${d.name}`,
            priority:       'high',
            due_date:       addDays(2),
            completed:      false,
            auto_generated: true,
          })
          actions_taken.push({ type: 'create_lead', summary: `ליד: "${d.name}"` })

        } else if (action.type === 'open_whatsapp') {
          const d = action.data as { contactName: string }
          // Look up phone from contacts context
          const match = contacts.find(c =>
            c.name.trim().toLowerCase() === (d.contactName ?? '').trim().toLowerCase()
          ) as (ContactCtx & { phone?: string }) | undefined
          const phone = match?.phone
          if (phone) {
            const wa = `https://wa.me/972${phone.replace(/^0/, '').replace(/\D/g, '')}`
            actions_taken.push({ type: 'open_whatsapp', summary: `ווצאפ: ${d.contactName}`, url: wa })
          } else {
            actions_taken.push({ type: 'open_whatsapp', summary: `לא נמצא מספר ל-${d.contactName}` })
          }
        }
      } catch (actionErr) {
        console.error(`Action ${action.type} failed:`, actionErr)
        actions_taken.push({ type: action.type, summary: `שגיאה: ${String(actionErr)}` })
      }
    }

    return new Response(
      JSON.stringify({ response: parsed.response ?? 'בוצע', actions_taken }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('crm-agent error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
