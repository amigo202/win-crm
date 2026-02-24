// WIN CRM — crm-agent Edge Function
// POST /functions/v1/crm-agent
// Secret required: ANTHROPIC_API_KEY

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

function err(msg: string, status = 500): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
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

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contacts: ContactCtx[]): string {
  const list = contacts.length
    ? contacts.map(c => `  - "${c.name}" (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const today    = new Date().toISOString().split('T')[0]

  return `אתה עוזר AI למערכת CRM בשם WIN CRM.
המשתמש כותב בעברית חופשית. תפקידך לנתח ולהפיק פעולות CRM מובנות.

אנשי קשר קיימים:
${list}

פעולות (type):
1. create_task    — { title, contactName?, dueDate?(YYYY-MM-DD), priority?("low"|"medium"|"high") }
2. create_contact — { name, phone?, email?, type?("lead"|"customer"|"partner"|"vendor"), notes? }
3. create_deal    — { title, contactName?, value?(number), stage?("lead"|"meeting"|"proposal"|"signed"|"active") }
4. create_lead    — { name, phone?, email?, source?("website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual"), notes? }
5. open_whatsapp  — { contactName }

כללים:
- מחר = ${tomorrow}, היום = ${today}
- ענה בעברית בשדה "response"
- החזר JSON בלבד

פורמט חובה:
{"actions":[{"type":"...","data":{...}}],"response":"תיאור בעברית"}`
}

// ── AI call ───────────────────────────────────────────────────────────────────

async function callAI(systemPrompt: string, userMsg: string): Promise<string> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) throw new Error('Missing secret: ANTHROPIC_API_KEY is not set in Supabase Edge Function secrets')

  const r = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: userMsg }],
    }),
  })

  if (!r.ok) {
    const body = await r.text()
    throw new Error(`Anthropic API error ${r.status}: ${body}`)
  }

  const b = await r.json()
  return b.content?.[0]?.text ?? '{}'
}

// ── Action helpers ────────────────────────────────────────────────────────────

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight — must return 200 with CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS })
  }

  if (req.method !== 'POST') return err('Method not allowed', 405)

  try {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
    if (!jwt) return err('Unauthorized', 401)

    const { message, context } = await req.json() as {
      message: string
      context?: { contacts?: ContactCtx[] }
    }
    if (!message?.trim()) return err('message is required', 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts = (context?.contacts ?? []) as ContactCtx[]

    // ── AI ────────────────────────────────────────────────────────────────
    const raw = await callAI(buildSystemPrompt(contacts), message.trim())
    let parsed: AIResponse
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { actions: [], response: raw }
    }

    // ── Execute actions ───────────────────────────────────────────────────
    const actions_taken: { type: string; summary: string; url?: string }[] = []

    const resolveId = (name?: string) =>
      contacts.find(c => c.name.trim().toLowerCase() === name?.trim().toLowerCase())?.id ?? null

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
        console.error(`Action ${action.type} failed:`, e)
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
