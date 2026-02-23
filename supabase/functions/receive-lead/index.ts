// WIN CRM — receive-lead Edge Function
// POST /functions/v1/receive-lead
// Body: { name, phone?, email?, source?, note? }
//
// Deploy: supabase functions deploy receive-lead
// Local:  supabase functions serve receive-lead

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { name, phone, email, source = 'website', note } = body

    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Service-role client — bypasses RLS, can access auth.admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Resolve owner_id (assign to the first/only CRM user) ───────
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1 })
    if (usersErr || !users?.length) {
      return new Response(JSON.stringify({ error: 'No CRM users found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const ownerId = users[0].id

    // ── Duplicate detection: email → phone ─────────────────────────
    let existingId: string | null = null
    if (email?.trim()) {
      const { data } = await supabase
        .from('contacts').select('id').eq('email', email.trim().toLowerCase()).maybeSingle()
      existingId = data?.id ?? null
    }
    if (!existingId && phone?.trim()) {
      const { data } = await supabase
        .from('contacts').select('id').eq('phone', phone.trim()).maybeSingle()
      existingId = data?.id ?? null
    }

    const now = new Date().toISOString()
    let contactId: string

    if (existingId) {
      // ── Existing contact: update lead_stage if not already in pipeline
      contactId = existingId
      await supabase
        .from('contacts')
        .update({ source, last_activity_at: now })
        .eq('id', existingId)
        .is('lead_stage', null)   // don't overwrite if already in pipeline
    } else {
      // ── New contact
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          owner_id:   ownerId,
          name:       name.trim(),
          phone:      phone?.trim()  || null,
          email:      email?.trim().toLowerCase() || null,
          source,
          lead_stage: 'new',
          status:     'lead',
          last_activity_at: now,
          // required JSONB defaults
          active_programs: [],
          notes:           [],
          activities:      [],
          tags:            [],
        })
        .select('id')
        .single()

      if (contactErr) throw contactErr
      contactId = contact.id
    }

    // ── Log activity: lead_created ─────────────────────────────────
    await supabase.from('activities').insert({
      contact_id:  contactId,
      type:        'lead_created',
      description: note?.trim()
        ? `ליד נכנס מ-${source}. הערה: ${note.trim()}`
        : `ליד נכנס מ-${source}`,
    })

    // ── Auto-task: follow-up in 2 days ─────────────────────────────
    const followUpDate = new Date()
    followUpDate.setDate(followUpDate.getDate() + 2)

    await supabase.from('tasks').insert({
      owner_id:       ownerId,
      contact_id:     contactId,
      title:          `פולואפ עם ${name.trim()}`,
      priority:       'high',
      due_date:       followUpDate.toISOString().split('T')[0],
      completed:      false,
      auto_generated: true,
    })

    return new Response(
      JSON.stringify({ success: true, contact_id: contactId, is_new: !existingId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('receive-lead error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
