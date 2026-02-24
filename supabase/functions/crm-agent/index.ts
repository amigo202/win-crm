// WIN CRM — crm-agent Edge Function
// POST /functions/v1/crm-agent
// Secret required: GEMINI_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  'https://frabjous-marzipan-d68ffc.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(msg: string): Response {
  // Always 200 so supabase.functions.invoke() puts body in `data` (not `error`)
  // Client checks result.error to detect failures
  console.error('[crm-agent] err:', msg)
  return new Response(JSON.stringify({ error: msg, response: 'שגיאת שרת — נסה שוב', actions_taken: [] }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactCtx { id: string; name: string; phone?: string }

interface CrmAction {
  type: string
  data: Record<string, unknown>
}

interface AIResponse {
  actions: CrmAction[]
  response: string
}

interface ImageCtx {
  base64:   string   // raw base64, no data-URL prefix
  mimeType: string   // e.g. "image/jpeg"
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contacts: ContactCtx[]): string {
  const list = contacts.length
    ? contacts.map(c => `  - "${c.name}" (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const today    = new Date().toISOString().split('T')[0]

  return `אתה עוזר AI למערכת CRM בשם WIN CRM.
המשתמש כותב בעברית חופשית. תפקידך לנתח ולהפיק פעולות CRM מובנות.
אם נשלחה תמונה — נתח אותה והפק פעולות מתאימות (למשל, קרא שם/טלפון מכרטיס ביקור).

אנשי קשר קיימים במערכת (השתמש בשמות המדויקים האלה ב-contactName):
${list}

פעולות (type) — קרא את הכללים בעיון לפני בחירה:

1. create_task — כשהמשתמש רוצה לעשות פעולה: להתקשר, לפגוש, לשלוח, לעקוב, לזכור, לתאם.
   { title, contactName?(שם מדויק מהרשימה למעלה בלבד), dueDate?(YYYY-MM-DD), priority?("low"|"medium"|"high") }
   ← אם האדם קיים ברשימה — חובה לשים את שמו ב-contactName.
   ← אם האדם לא קיים ברשימה — השאר contactName ריק, אל תמציא שם.

2. create_contact — כשמוסיפים איש קשר חדש שאינו ליד (לקוח, שותף, ספק, מכר).
   { name, phone?, email?, type?("lead"|"customer"|"partner"|"vendor"), notes? }

3. create_deal — כשמוזכרת עסקה, מכירה, או סכום כסף.
   { title, contactName?(שם מדויק מהרשימה), value?(number), stage?("lead"|"meeting"|"proposal"|"signed"|"active") }

4. create_lead — רק כשהמשתמש מציין מפורשות ליד חדש / מתעניין חדש שלא קיים במערכת.
   { name, phone?, email?, source?("website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual"), notes? }
   ← לעולם אל תשתמש ב-create_lead עבור אנשי קשר שכבר קיימים ברשימה!
   ← לעולם אל תשתמש ב-create_lead רק כי רוצים להתקשר — זה create_task!

5. open_whatsapp — כשרוצים לשלוח ווצאפ לאיש קשר קיים.
   { contactName }

דוגמאות לבחירה נכונה:
"להתקשר לדני מחר" → create_task (title:"להתקשר לדני", contactName:"דני כהן" אם קיים ברשימה)
"יש ליד חדש שמו משה" → create_lead
"הוסף איש קשר שמו יוסי" → create_contact
"עסקה עם רונן על 5000 ₪" → create_deal
"שלח ווצאפ לשרה" → open_whatsapp

כללים נוספים:
- מחר = ${tomorrow}, היום = ${today}
- ענה בעברית בשדה "response"
- החזר JSON בלבד — ללא טקסט לפני או אחרי

פורמט חובה:
{"actions":[{"type":"...","data":{...}}],"response":"תיאור בעברית"}`
}

// ── Gemini call ───────────────────────────────────────────────────────────────
// Model: gemini-2.5-flash  (change to gemini-2.0-flash if 2.5 unavailable)

const GEMINI_MODEL = 'gemini-2.5-flash'

async function callGemini(
  systemPrompt: string,
  userMsg:      string,
  image?:       ImageCtx,
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('Missing secret: GEMINI_API_KEY is not set in Supabase Edge Function secrets')

  // Build parts — text always first, image optional
  const userParts: unknown[] = [{ text: userMsg }]
  if (image?.base64) {
    userParts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  })

  if (!r.ok) {
    const body = await r.text()
    console.error(`[crm-agent] Gemini HTTP ${r.status}:`, body.slice(0, 500))
    throw new Error(`Gemini ${r.status}: ${body.slice(0, 200)}`)
  }

  const b = await r.json()
  console.log('[crm-agent] Gemini finish_reason:', b.candidates?.[0]?.finishReason)

  const text = b.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    console.error('[crm-agent] Gemini empty text, full response:', JSON.stringify(b).slice(0, 500))
    throw new Error('Gemini returned no text content')
  }
  return text
}

// ── Action helpers ────────────────────────────────────────────────────────────

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS })
  }

  if (req.method !== 'POST') return err('Method not allowed')

  try {
    // JWT is optional — function works in both authenticated and anon mode.
    // Supabase gateway JWT verification is disabled (--no-verify-jwt).
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
    console.log('[crm-agent] jwt present:', !!jwt)

    const { message, context, image } = await req.json() as {
      message:  string
      context?: { contacts?: ContactCtx[] }
      image?:   ImageCtx
    }
    if (!message?.trim()) return err('message is required')

    // Build supabase client — use user JWT when available, fall back to anon
    const authHeader = jwt ? { Authorization: `Bearer ${jwt}` } : {}
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts = (context?.contacts ?? []) as ContactCtx[]

    // ── Gemini ────────────────────────────────────────────────────────────────
    const raw = await callGemini(buildSystemPrompt(contacts), message.trim(), image)
    let parsed: AIResponse
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch (parseErr) {
      // Log the raw output for debugging — never forward it to the UI
      console.error('[crm-agent] JSON parse failed:', String(parseErr))
      console.error('[crm-agent] raw output (first 300):', raw.slice(0, 300))
      parsed = { actions: [], response: 'לא הצלחתי לעבד את הבקשה — נסה לנסח מחדש' }
    }

    // ── Execute actions ───────────────────────────────────────────────────────
    const actions_taken: { type: string; summary: string; url?: string }[] = []

    const resolveId = (name?: string): string | null => {
      if (!name?.trim()) return null
      const n = name.trim().toLowerCase()
      // 1. exact match
      const exact = contacts.find(c => c.name.trim().toLowerCase() === n)
      if (exact) return exact.id
      // 2. partial match (contact name contains the search term or vice versa)
      const partial = contacts.find(c => {
        const cn = c.name.trim().toLowerCase()
        return cn.includes(n) || n.includes(cn)
      })
      return partial?.id ?? null
    }

    for (const action of (parsed.actions ?? [])) {
      try {
        const d = action.data

        if (action.type === 'create_task') {
          const { error } = await supabase.from('tasks').insert({
            title: d.title, contact_id: resolveId(d.contactName as string),
            due_date: d.dueDate ?? null, priority: d.priority ?? 'medium', completed: false,
          })
          if (error) throw error
          actions_taken.push({ type: 'create_task', summary: `משימה: "${d.title}"` })

        } else if (action.type === 'create_contact') {
          const { error } = await supabase.from('contacts').insert({
            name: d.name, phone: d.phone ?? null, email: (d.email as string)?.toLowerCase() ?? null,
            type: d.type ?? 'lead', status: 'lead',
            notes: [], activities: [], tags: [], active_programs: [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_contact', summary: `איש קשר: "${d.name}"` })

        } else if (action.type === 'create_deal') {
          const { error } = await supabase.from('deals').insert({
            title: d.title, contact_id: resolveId(d.contactName as string),
            value: d.value ?? 0, stage: d.stage ?? 'lead',
          })
          if (error) throw error
          actions_taken.push({ type: 'create_deal', summary: `עסקה: "${d.title}"${d.value ? ` — ₪${Number(d.value).toLocaleString()}` : ''}` })

        } else if (action.type === 'create_lead') {
          const { data: row, error: cErr } = await supabase.from('contacts').insert({
            name: d.name, phone: d.phone ?? null,
            email: (d.email as string)?.toLowerCase() ?? null,
            source: d.source ?? 'manual', lead_stage: 'new', status: 'lead',
            last_activity_at: new Date().toISOString(),
            notes: [], activities: [], tags: [], active_programs: [],
          }).select('id').single()
          if (cErr) throw cErr
          await supabase.from('tasks').insert({
            contact_id: row.id, title: `פולואפ עם ${d.name}`,
            priority: 'high', due_date: addDays(2), completed: false, auto_generated: true,
          })
          actions_taken.push({ type: 'create_lead', summary: `ליד: "${d.name}"` })

        } else if (action.type === 'open_whatsapp') {
          const contact = contacts.find(c =>
            c.name.trim().toLowerCase() === (d.contactName as string)?.trim().toLowerCase()
          )
          if (contact?.phone) {
            const wa = `https://wa.me/972${(contact.phone as string).replace(/^0/, '').replace(/\D/g, '')}`
            actions_taken.push({ type: 'open_whatsapp', summary: `ווצאפ: ${d.contactName}`, url: wa })
          } else {
            actions_taken.push({ type: 'open_whatsapp', summary: `לא נמצא מספר ל-${d.contactName}` })
          }
        }
      } catch (e) {
        console.error(`[crm-agent] action ${action.type} failed:`, e)
        actions_taken.push({ type: action.type, summary: `שגיאה: ${String(e)}` })
      }
    }

    return ok({ response: parsed.response ?? 'בוצע', actions_taken })

  } catch (e) {
    const msg   = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack   : undefined
    console.error('[crm-agent] FATAL:', msg)
    if (stack) console.error('[crm-agent] stack:', stack)
    return err(msg)
  }
})
