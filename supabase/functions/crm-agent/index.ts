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

interface ContactCtx    { id: string; name: string; phone?: string }
interface InstructorCtx { id: string; name: string; programs?: string[] }

interface CrmAction {
  type: string
  data: Record<string, unknown>
}

interface AIResponse {
  actions: CrmAction[]
  response: string
}

interface MediaCtx {
  base64:   string   // raw base64, no data-URL prefix
  mimeType: string   // e.g. "image/jpeg" or "audio/webm"
}
type ImageCtx = MediaCtx  // backward compat alias

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contacts: ContactCtx[], instructors: InstructorCtx[]): string {
  const contactList = contacts.length
    ? contacts.map(c => `  - "${c.name}" (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  const instructorList = instructors.length
    ? instructors.map(i => `  - "${i.name}" (id: ${i.id}${i.programs?.length ? `, תוכניות: ${i.programs.join(', ')}` : ''})`).join('\n')
    : '  (אין מדריכים עדיין)'

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const today    = new Date().toISOString().split('T')[0]
  const nowMonth = new Date().getMonth() + 1
  const nowYear  = new Date().getFullYear()

  return `אתה עוזר AI למערכת CRM בשם WIN CRM.
המשתמש כותב בעברית חופשית. תפקידך לנתח ולהפיק פעולות CRM מובנות.
אם נשלחה תמונה — נתח אותה והפק פעולות מתאימות (למשל, קרא שם/טלפון מכרטיס ביקור).
אם נשלחה הקלטה קולית — תמלל אותה ועבד את הבקשה בדיוק כאילו הוקלדה.

אנשי קשר קיימים (השתמש בשמות המדויקים ב-contactName):
${contactList}

מדריכים קיימים (השתמש בשמות המדויקים ב-instructorName):
${instructorList}

פעולות (type) — קרא את הכללים בעיון לפני בחירה:

1. create_task — כשהמשתמש רוצה לעשות פעולה: להתקשר, לפגוש, לשלוח, לעקוב, לזכור, לתאם.
   { title, contactName?(שם מדויק מרשימת אנשי הקשר), dueDate?(YYYY-MM-DD), priority?("low"|"medium"|"high") }
   ← אם האדם קיים ברשימה — חובה לשים את שמו ב-contactName.
   ← אם האדם לא קיים — השאר contactName ריק, אל תמציא שם.

2. create_contact — כשמוסיפים איש קשר חדש שאינו ליד (לקוח, שותף, ספק, מכר).
   { name, phone?, email?, type?("lead"|"customer"|"partner"|"vendor"), notes? }

3. create_deal — כשמוזכרת עסקה, מכירה, או סכום כסף.
   { title, contactName?(שם מדויק מרשימת אנשי הקשר), value?(number), stage?("lead"|"meeting"|"proposal"|"signed"|"active") }

4. create_lead — רק כשהמשתמש מציין מפורשות ליד חדש / מתעניין חדש שלא קיים במערכת.
   { name, phone?, email?, source?("website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual"), notes? }
   ← לעולם אל תשתמש ב-create_lead עבור אנשי קשר שכבר קיימים ברשימה!
   ← לעולם אל תשתמש ב-create_lead רק כי רוצים להתקשר — זה create_task!

5. open_whatsapp — כשרוצים לשלוח ווצאפ לאיש קשר קיים.
   { contactName }

6. create_instructor — כשמוסיפים מדריך חדש למערכת.
   { name, phone?, email?, programs?(מערך מחרוזות, למשל ["קרוספיט","יוגה"]), hourlyRate?(number) }

7. create_salary — כשרוצים לרשום תשלום שכר למדריך קיים.
   { instructorName(שם מדויק מרשימת המדריכים), baseSalary(number), month?(1-12, ברירת מחדל ${nowMonth}), year?(YYYY, ברירת מחדל ${nowYear}), tax?(number), additions?(number), deductions?(number), nationalInsurance?(number), healthInsurance?(number), notes? }
   ← חובה: instructorName חייב להיות מרשימת המדריכים הקיימים.

עקרון ברזל — תפעל, אל תשאל:
- ברירת מחדל: בצע פעולה מיד לפי מה שהבנת. אל תשאל שאלות מיותרות.
- שאל רק אם חסר פרט שבלעדיו אי אפשר לבצע כלום (למשל שם כשצריך שם).
- שאלה אחת בלבד, קצרה, עם אפשרות לדלג: "על מי מדובר? (או כתוב דלג)"
- אם הבקשה כללית לגמרי ואין מה לבצע — ענה בקצרה ב-response בלבד, actions:[].

דוגמאות:
"להתקשר לדני מחר" → create_task title:"התקשר לדני" + contactName אם קיים
"יש ליד חדש שמו משה" → create_lead
"הוסף איש קשר שמו יוסי" → create_contact
"עסקה עם רונן על 5000 ₪" → create_deal
"שלח ווצאפ לשרה" → open_whatsapp
"הוסף מדריך שמו יוסי לוי" → create_instructor
"שכר למדריך דני 8000 ₪ לחודש הזה" → create_salary
"מה אפשר לעשות?" → response:"אני יכול לפתוח משימות, להוסיף לידים, לרשום עסקאות, אנשי קשר, מדריכים ושכר. פשוט כתוב מה צריך!", actions:[]

כללים:
- מחר = ${tomorrow}, היום = ${today}
- ענה בעברית בשדה "response"
- החזר JSON בלבד — ללא טקסט לפני או אחרי

פורמט חובה:
{"actions":[{"type":"...","data":{...}}],"response":"תיאור בעברית"}`
}

// ── Gemini call ───────────────────────────────────────────────────────────────

const DEFAULT_MODEL  = 'gemini-3-pro-preview'
const ALLOWED_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

async function callGemini(
  systemPrompt: string,
  userMsg:      string,
  media?:       MediaCtx,
  model:        string = DEFAULT_MODEL,
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('Missing secret: GEMINI_API_KEY is not set in Supabase Edge Function secrets')

  // Build parts — media first (image/audio), then text
  const userParts: unknown[] = []
  if (media?.base64) {
    userParts.push({ inline_data: { mime_type: media.mimeType.split(';')[0], data: media.base64 } })
  }
  userParts.push({ text: userMsg })

  console.log('[crm-agent] model:', model)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
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

    const { message, context, image, audio, model: reqModel } = await req.json() as {
      message:  string
      context?: { contacts?: ContactCtx[]; instructors?: InstructorCtx[] }
      image?:   MediaCtx
      audio?:   MediaCtx
      model?:   string
    }
    const media = audio || image   // audio takes priority
    if (!message?.trim()) return err('message is required')
    const model = ALLOWED_MODELS.includes(reqModel ?? '') ? reqModel! : DEFAULT_MODEL

    // Build supabase client — use user JWT when available, fall back to anon
    const authHeader = jwt ? { Authorization: `Bearer ${jwt}` } : {}
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts    = (context?.contacts    ?? []) as ContactCtx[]
    const instructors = (context?.instructors ?? []) as InstructorCtx[]

    // ── Gemini ────────────────────────────────────────────────────────────────
    const raw = await callGemini(buildSystemPrompt(contacts, instructors), message.trim(), media, model)
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
      const exact = contacts.find(c => c.name.trim().toLowerCase() === n)
      if (exact) return exact.id
      const partial = contacts.find(c => {
        const cn = c.name.trim().toLowerCase()
        return cn.includes(n) || n.includes(cn)
      })
      return partial?.id ?? null
    }

    const resolveInstructorId = (name?: string): string | null => {
      if (!name?.trim()) return null
      const n = name.trim().toLowerCase()
      const exact = instructors.find(i => i.name.trim().toLowerCase() === n)
      if (exact) return exact.id
      const partial = instructors.find(i => {
        const iname = i.name.trim().toLowerCase()
        return iname.includes(n) || n.includes(iname)
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

        } else if (action.type === 'create_instructor') {
          const { error } = await supabase.from('instructors').insert({
            name:        d.name,
            phone:       d.phone       ?? null,
            email:       (d.email as string)?.toLowerCase() ?? null,
            programs:    Array.isArray(d.programs) ? d.programs : [],
            hourly_rate: Number(d.hourlyRate) || 0,
            sessions:    [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_instructor', summary: `מדריך: "${d.name}"` })

        } else if (action.type === 'create_salary') {
          const instId = resolveInstructorId(d.instructorName as string)
          if (!instId) throw new Error(`מדריך לא נמצא: "${d.instructorName}"`)
          const now = new Date()
          const { error } = await supabase.from('salaries').insert({
            instructor_id:      instId,
            base_salary:        Number(d.baseSalary)        || 0,
            month:              Number(d.month)             || (now.getMonth() + 1),
            year:               Number(d.year)              || now.getFullYear(),
            tax:                Number(d.tax)               || 0,
            additions:          Number(d.additions)         || 0,
            deductions:         Number(d.deductions)        || 0,
            national_insurance: Number(d.nationalInsurance) || 0,
            health_insurance:   Number(d.healthInsurance)   || 0,
            notes:              d.notes                     ?? null,
          })
          if (error) throw error
          actions_taken.push({ type: 'create_salary', summary: `שכר ${d.instructorName}: ₪${Number(d.baseSalary).toLocaleString()}` })
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
