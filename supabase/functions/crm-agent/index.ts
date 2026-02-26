// WIN CRM — crm-agent Edge Function v2
// POST /functions/v1/crm-agent
// Secrets required: GEMINI_API_KEY

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
  console.error('[crm-agent] err:', msg)
  return new Response(
    JSON.stringify({ error: msg, response: 'שגיאת שרת — נסה שוב', actions_taken: [] }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactCtx    { id: string; name: string; phone?: string }
interface InstructorCtx { id: string; name: string; programs?: string[] }

interface HistoryMsg {
  role: 'user' | 'agent'
  text: string
}

interface BusinessSnapshot {
  stats?: {
    contactsTotal?: number
    leadsCount?:    number
    studentsCount?: number
    dealsTotal?:    number
  }
  openTasks?:    Array<{ title: string; dueDate?: string; contactName?: string; priority?: string }>
  recentLeads?:  Array<{ name: string; phone?: string; source?: string; stage?: string }>
  activeDeals?:  Array<{ title: string; value?: number; stage?: string; contactName?: string }>
}

interface CrmAction {
  type: string
  data: Record<string, unknown>
}

interface AIResponse {
  actions:  CrmAction[]
  response: string
}

interface MediaCtx {
  base64:   string
  mimeType: string
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  contacts:    ContactCtx[],
  instructors: InstructorCtx[],
  snapshot:    BusinessSnapshot,
): string {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const today    = new Date().toISOString().split('T')[0]
  const nowMonth = new Date().getMonth() + 1
  const nowYear  = new Date().getFullYear()

  // ── Business snapshot section ──────────────────────────────────────────────
  let snapshotSection = ''
  const overdueTasks: Array<{ title: string; dueDate?: string; contactName?: string }> = []

  if (snapshot.stats) {
    const s = snapshot.stats
    snapshotSection += `\n=== מצב עסק נוכחי (${today}) ===\n`
    snapshotSection += `אנשי קשר: ${s.contactsTotal ?? 0} | לידים: ${s.leadsCount ?? 0} | תלמידים: ${s.studentsCount ?? 0} | עסקאות: ${s.dealsTotal ?? 0}\n`
  }

  if (snapshot.openTasks?.length) {
    for (const t of snapshot.openTasks) {
      if (t.dueDate && t.dueDate < today) overdueTasks.push(t)
    }
    snapshotSection += `\nמשימות פתוחות (${snapshot.openTasks.length}${overdueTasks.length ? `, ⚠️ ${overdueTasks.length} באיחור` : ''}):\n`
    for (const t of snapshot.openTasks.slice(0, 15)) {
      const contact = t.contactName ? ` — ${t.contactName}` : ''
      const due = t.dueDate
        ? ` (${t.dueDate === today ? '📅 היום' : t.dueDate < today ? '⚠️ באיחור!' : t.dueDate})`
        : ''
      const pri = t.priority === 'high' ? ' 🔴' : t.priority === 'medium' ? ' 🟡' : ''
      snapshotSection += `  • "${t.title}"${contact}${due}${pri}\n`
    }
  } else if (snapshot.stats) {
    snapshotSection += `\nאין משימות פתוחות.\n`
  }

  if (snapshot.recentLeads?.length) {
    snapshotSection += `\nלידים אחרונים (${snapshot.recentLeads.length}):\n`
    for (const l of snapshot.recentLeads.slice(0, 10)) {
      const phone  = l.phone  ? ` | ${l.phone}`  : ''
      const source = l.source ? ` (${l.source})` : ''
      const stage  = l.stage  ? ` [${l.stage}]`  : ''
      snapshotSection += `  • ${l.name}${phone}${source}${stage}\n`
    }
  }

  if (snapshot.activeDeals?.length) {
    const totalValue = snapshot.activeDeals.reduce((s, d) => s + (d.value ?? 0), 0)
    snapshotSection += `\nעסקאות פעילות (${snapshot.activeDeals.length}, סה"כ ₪${totalValue.toLocaleString()}):\n`
    for (const d of snapshot.activeDeals.slice(0, 10)) {
      const contact = d.contactName ? ` — ${d.contactName}` : ''
      const val     = d.value != null ? ` ₪${d.value.toLocaleString()}` : ''
      snapshotSection += `  • "${d.title}"${contact}${val} [${d.stage ?? ''}]\n`
    }
  }

  // ── Build proactive insights for the agent to leverage ────────────────────
  let insightsSection = ''
  if (overdueTasks.length > 0) {
    insightsSection += `\n🚨 התראות דחופות:\n`
    insightsSection += `  • יש ${overdueTasks.length} משימות שעברו את המועד שלהן! שקול לטפל בהן בדחיפות.\n`
  }
  if ((snapshot.stats?.leadsCount ?? 0) > 10 && (snapshot.openTasks?.length ?? 0) < 3) {
    insightsSection += `  • יש ${snapshot.stats?.leadsCount} לידים אך מעט מאוד משימות — שקול פולואפ פעיל.\n`
  }

  // ── Contacts / Instructors lists ──────────────────────────────────────────
  const contactList = contacts.length
    ? contacts.slice(0, 100).map(c => `  - "${c.name}"${c.phone ? ` | ${c.phone}` : ''} (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  const instructorList = instructors.length
    ? instructors.map(i => `  - "${i.name}" (id: ${i.id}${i.programs?.length ? `, תוכניות: ${i.programs.join(', ')}` : ''})`).join('\n')
    : '  (אין מדריכים עדיין)'

  return `אתה יועץ עסקי ו-AI חכם של מערכת WIN CRM — מכון כושר / סטודיו לאימונים.
המשתמש כותב בעברית. אתה מבין את העסק לעומק: לידים, תלמידים, מדריכים, תשלומים, תוכניות אימון ועסקאות.

=== תפקידך ===
1. לבצע פעולות CRM (יצירת משימות, לידים, עסקאות וכו׳)
2. לענות על שאלות עסקיות בחכמה, על בסיס הנתונים שלך
3. להיות פרואקטיבי — שים לב לבעיות ומגמות, והצע פעולות גם מבלי שביקשו
4. לייעץ על בסיס הנתונים — אם רואים בעיה (משימות באיחור, לידים ללא פולואפ, הכנסה נמוכה), ציין זאת
${snapshotSection}${insightsSection}
אנשי קשר קיימים:
${contactList}

מדריכים קיימים:
${instructorList}

=== 📷 קריאת תמונות — חובה לנתח! ===
כשנשלחת תמונה, תמיד פתח את תשובתך עם: "📷 ראיתי בתמונה: [תיאור מה רואים]"
לאחר מכן בצע את הפעולה המתאימה:
  • כרטיס ביקור → חלץ שם/טלפון/אימייל/חברה → create_contact (ציין "מכרטיס ביקור" ב-notes)
  • חשבונית/קבלה → חלץ שם לקוח/סכום/תיאור → create_deal
  • רשימת שמות/טלפונים → צור create_lead לכל שם
  • מסמך/הוראות → קרא וצא בהתאם
  • צילום מסך/אחר → תאר מה ראית ואז שאל שאלה אחת: "מה לעשות עם זה?"
חשוב: גם אם התמונה מטושטשת — נסה לחלץ מידע ודווח על מה שראית.

🎤 הקלטה קולית — תמלל ועבד בדיוק כאילו הוקלד.

=== 💼 יועץ עסקי — כיצד להגיב ===
• שאלות על מצב העסק → ענה עם ניתוח + המלצה אחת: "יש לך X לידים חדשים, אבל Y מהם ללא פולואפ — כדאי ליצור משימות."
• אחרי ביצוע פעולה → הוסף בriefing קצר: "בוצע! אגב, שים לב ש..."
• כשרואים בעיה → ציין אותה בשפה ישירה: "⚠️ 3 משימות כבר עברו את המועד שלהן"
• הצעות פעולה → כשרלוונטי, הצע פעולה נוספת: "רוצה שאצור גם משימת פולואפ?"

=== פעולות (type) ===

1. create_task — פעולה לביצוע (להתקשר, לפגוש, לשלוח, לעקוב, לתאם)
   { title, contactName?(שם מדויק מרשימת אנשי הקשר), dueDate?(YYYY-MM-DD), priority?("low"|"medium"|"high") }
   ← אם האדם קיים ברשימה — חובה לשים שמו ב-contactName.

2. create_contact — הוספת איש קשר חדש (שאינו ליד)
   { name, phone?, email?, type?("lead"|"customer"|"partner"|"vendor"), notes? }

3. create_deal — עסקה, מכירה, או סכום כסף
   { title, contactName?(שם מדויק), value?(number), stage?("lead"|"meeting"|"proposal"|"signed"|"active") }

4. create_lead — ליד/מתעניין חדש בלבד (שאינו קיים במערכת)
   { name, phone?, email?, source?("website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual"), notes? }
   ← לא לשימוש עבור אנשי קשר קיימים! לא לשימוש רק כי רוצים להתקשר (זה create_task)!

5. open_whatsapp — שליחת ווצאפ לאיש קשר קיים
   { contactName }

6. create_instructor — הוספת מדריך חדש
   { name, phone?, email?, programs?(מערך מחרוזות), hourlyRate?(number) }

7. create_salary — רישום שכר למדריך קיים
   { instructorName(שם מדויק), baseSalary(number), month?(1-12, ברירת מחדל ${nowMonth}), year?(YYYY, ברירת מחדל ${nowYear}), tax?, additions?, deductions?, nationalInsurance?, healthInsurance?, notes? }

=== עקרונות ===
- בצע פעולה מיד לפי הבנתך. אל תשאל שאלות מיותרות.
- שאל רק אם חסר פרט קריטי שבלעדיו אי אפשר לבצע כלום (שאלה אחת קצרה).
- היה יועץ אמיתי: אחרי כל פעולה — הוסף תובנה קצרה רלוונטית מהנתונים.
- מחר = ${tomorrow}, היום = ${today}
- ענה בעברית בשדה "response"
- החזר JSON בלבד — ללא טקסט לפני או אחרי:
{"actions":[{"type":"...","data":{...}}],"response":"תיאור בעברית"}`
}

// ── Gemini multi-turn call ────────────────────────────────────────────────────

const DEFAULT_MODEL  = 'gemini-3-pro-preview'
const ALLOWED_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

function buildContents(
  history: HistoryMsg[],
  userMsg: string,
  media?:  MediaCtx,
): unknown[] {
  const contents: unknown[] = []

  // Add conversation history (ensure alternating user/model)
  const filtered = history.filter(h => h.role === 'user' || h.role === 'agent')
  for (const h of filtered) {
    contents.push({
      role:  h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })
  }

  // Add current user message (with optional media)
  const userParts: unknown[] = []
  if (media?.base64) {
    userParts.push({ inline_data: { mime_type: media.mimeType.split(';')[0], data: media.base64 } })
  }
  userParts.push({ text: userMsg })
  contents.push({ role: 'user', parts: userParts })

  return contents
}

async function callGemini(
  systemPrompt: string,
  history:      HistoryMsg[],
  userMsg:      string,
  media?:       MediaCtx,
  model:        string = DEFAULT_MODEL,
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('Missing secret: GEMINI_API_KEY is not set in Supabase Edge Function secrets')

  const contents = buildContents(history, userMsg, media)
  console.log('[crm-agent] model:', model, '| history turns:', history.length, '| hasMedia:', !!media?.base64)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
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
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
    console.log('[crm-agent] jwt present:', !!jwt)

    const {
      message,
      context,
      image,
      audio,
      model: reqModel,
      history: reqHistory,
      businessSnapshot,
    } = await req.json() as {
      message:           string
      context?:          { contacts?: ContactCtx[]; instructors?: InstructorCtx[] }
      image?:            MediaCtx
      audio?:            MediaCtx
      model?:            string
      history?:          HistoryMsg[]
      businessSnapshot?: BusinessSnapshot
    }

    const media = audio || image  // audio takes priority
    if (!message?.trim()) return err('message is required')

    const model = ALLOWED_MODELS.includes(reqModel ?? '') ? reqModel! : DEFAULT_MODEL

    // Build supabase client (for action execution)
    const authHeader = jwt ? { Authorization: `Bearer ${jwt}` } : {}
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts    = (context?.contacts    ?? []) as ContactCtx[]
    const instructors = (context?.instructors ?? []) as InstructorCtx[]
    const history     = (reqHistory ?? []) as HistoryMsg[]
    const snapshot    = (businessSnapshot ?? {}) as BusinessSnapshot

    // ── Call Gemini ────────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(contacts, instructors, snapshot)
    const raw = await callGemini(systemPrompt, history, message.trim(), media, model)

    let parsed: AIResponse
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch (parseErr) {
      console.error('[crm-agent] JSON parse failed:', String(parseErr))
      console.error('[crm-agent] raw output (first 300):', raw.slice(0, 300))
      // If Gemini returned plain text (e.g. a clarifying question), wrap it
      if (raw.length < 300 && !raw.startsWith('{')) {
        parsed = { actions: [], response: raw.trim() }
      } else {
        parsed = { actions: [], response: 'לא הצלחתי לעבד את הבקשה — נסה לנסח מחדש' }
      }
    }

    // ── Execute actions ────────────────────────────────────────────────────────
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
            title:      d.title,
            contact_id: resolveId(d.contactName as string),
            due_date:   d.dueDate ?? null,
            priority:   d.priority ?? 'medium',
            completed:  false,
          })
          if (error) throw error
          actions_taken.push({ type: 'create_task', summary: `משימה: "${d.title}"` })

        } else if (action.type === 'create_contact') {
          const { error } = await supabase.from('contacts').insert({
            name:             d.name,
            phone:            d.phone ?? null,
            email:            (d.email as string)?.toLowerCase() ?? null,
            type:             d.type ?? 'lead',
            status:           'lead',
            notes:            [],
            activities:       [],
            tags:             [],
            active_programs:  [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_contact', summary: `איש קשר: "${d.name}"` })

        } else if (action.type === 'create_deal') {
          const { error } = await supabase.from('deals').insert({
            title:      d.title,
            contact_id: resolveId(d.contactName as string),
            value:      d.value ?? 0,
            stage:      d.stage ?? 'lead',
          })
          if (error) throw error
          actions_taken.push({
            type:    'create_deal',
            summary: `עסקה: "${d.title}"${d.value ? ` — ₪${Number(d.value).toLocaleString()}` : ''}`,
          })

        } else if (action.type === 'create_lead') {
          const { data: row, error: cErr } = await supabase.from('contacts').insert({
            name:             d.name,
            phone:            d.phone ?? null,
            email:            (d.email as string)?.toLowerCase() ?? null,
            source:           d.source ?? 'manual',
            lead_stage:       'new',
            status:           'lead',
            last_activity_at: new Date().toISOString(),
            notes:            [],
            activities:       [],
            tags:             [],
            active_programs:  [],
          }).select('id').single()
          if (cErr) throw cErr
          await supabase.from('tasks').insert({
            contact_id:     row.id,
            title:          `פולואפ עם ${d.name}`,
            priority:       'high',
            due_date:       addDays(2),
            completed:      false,
            auto_generated: true,
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
          actions_taken.push({
            type:    'create_salary',
            summary: `שכר ${d.instructorName}: ₪${Number(d.baseSalary).toLocaleString()}`,
          })
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
