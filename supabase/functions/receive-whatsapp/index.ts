// WIN CRM — receive-whatsapp Edge Function
// Handles WhatsApp Business Cloud API webhooks
//
// Setup:
//   1. supabase secrets set WA_VERIFY_TOKEN=any_secret_string_you_choose
//   2. supabase functions deploy receive-whatsapp
//   3. In Meta Developer Portal → WhatsApp → Configuration:
//      Webhook URL: https://<project>.supabase.co/functions/v1/receive-whatsapp
//      Verify Token: same string as WA_VERIFY_TOKEN
//      Subscribe to: messages
//
// Secrets also needed:
//   supabase secrets set WA_PHONE_NUMBER_ID=1234567890
//   supabase secrets set WA_ACCESS_TOKEN=EAAxxxxx   (WhatsApp Business API token)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Service-role client — used for all DB operations (webhook has no user JWT)
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOwnerId(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 })
  if (!users?.length) throw new Error('No CRM users found')
  return users[0].id
}

function addDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Send WhatsApp reply (optional — just logs if no token) ───────────────────
async function sendReply(phone: string, text: string) {
  const token   = Deno.env.get('WA_ACCESS_TOKEN')
  const phoneId = Deno.env.get('WA_PHONE_NUMBER_ID')
  if (!token || !phoneId) return   // no sending configured, silently skip

  await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text },
    }),
  })
}

// ── Webhook handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── GET: Webhook verification (Meta requires this handshake) ─────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const mode  = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === Deno.env.get('WA_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // ── POST: Incoming messages ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()

    // Meta sends: { object: 'whatsapp_business_account', entry: [...] }
    if (body.object !== 'whatsapp_business_account') {
      return new Response('Not a WhatsApp event', { status: 200 })
    }

    const supabase = getSupabase()
    const ownerId  = await getOwnerId(supabase)

    for (const entry of (body.entry ?? [])) {
      for (const change of (entry.changes ?? [])) {
        if (change.field !== 'messages') continue
        const value = change.value

        for (const msg of (value.messages ?? [])) {
          if (msg.type !== 'text') continue   // handle text messages only

          const phone   = msg.from                           // e.g. "972501234567"
          const text    = msg.text?.body ?? ''
          const profile = value.contacts?.find((c: {wa_id:string}) => c.wa_id === phone)
          const name    = profile?.profile?.name || `ווצאפ ${phone}`

          // ── Dedup by phone ─────────────────────────────────────────────
          const { data: existing } = await supabase
            .from('contacts').select('id, name, lead_stage')
            .eq('phone', phone).maybeSingle()

          let contactId: string
          let isNew = false

          if (existing) {
            contactId = existing.id
            // Update last_activity_at
            await supabase.from('contacts')
              .update({ last_activity_at: new Date().toISOString() })
              .eq('id', contactId)
          } else {
            // ── New lead from WhatsApp ─────────────────────────────────
            isNew = true
            const { data: contact, error } = await supabase.from('contacts').insert({
              owner_id:        ownerId,
              name,
              phone,
              source:          'whatsapp',
              lead_stage:      'new',
              status:          'lead',
              last_activity_at: new Date().toISOString(),
              notes:           [],
              activities:      [],
              tags:            [],
              active_programs: [],
            }).select('id').single()
            if (error) throw error
            contactId = contact.id

            // Auto follow-up task
            await supabase.from('tasks').insert({
              owner_id:       ownerId,
              contact_id:     contactId,
              title:          `פולואפ ווצאפ עם ${name}`,
              priority:       'high',
              due_date:       addDays(1),
              completed:      false,
              auto_generated: true,
            })
          }

          // ── Log activity ───────────────────────────────────────────────
          await supabase.from('activities').insert({
            contact_id:  contactId,
            type:        'whatsapp',
            description: `ווצאפ נכנס: "${text.slice(0, 200)}"`,
          })

          // ── Auto-reply to new leads ────────────────────────────────────
          if (isNew) {
            await sendReply(
              phone,
              `שלום ${name} 👋 תודה שפנית! נחזור אליך בהקדם.`
            )
          }

          console.log(`WhatsApp message processed: contact=${contactId} new=${isNew}`)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('receive-whatsapp error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
