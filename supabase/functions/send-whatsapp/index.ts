import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { contactId, phone, message, templateId, templateVars } = await req.json()

    if (!phone && !contactId) {
      return new Response(JSON.stringify({ error: 'phone or contactId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve phone from contactId if needed
    let finalPhone = phone
    if (!finalPhone && contactId) {
      const { data: contact } = await supabase.from('contacts').select('phone').eq('id', contactId).single()
      finalPhone = contact?.phone
    }

    if (!finalPhone) {
      return new Response(JSON.stringify({ error: 'no phone number found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Clean phone number for WhatsApp API (international format without +)
    let waPhone = finalPhone.replace(/[^0-9]/g, '')
    if (waPhone.startsWith('0')) waPhone = '972' + waPhone.slice(1)

    // Resolve template if templateId provided
    let finalMessage = message
    if (templateId && !finalMessage) {
      const { data: template } = await supabase.from('wa_templates').select('body').eq('id', templateId).single()
      if (template?.body) {
        finalMessage = template.body
        // Interpolate variables
        for (const [key, value] of Object.entries(templateVars || {})) {
          finalMessage = finalMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string)
        }
      }
    }

    if (!finalMessage) {
      return new Response(JSON.stringify({ error: 'no message content' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via WhatsApp Business Cloud API
    const WA_PHONE_ID    = Deno.env.get('WA_PHONE_NUMBER_ID')
    const WA_ACCESS_TOKEN = Deno.env.get('WA_ACCESS_TOKEN')

    let waResult = null
    let waError  = null

    if (WA_PHONE_ID && WA_ACCESS_TOKEN) {
      try {
        const waRes = await fetch(
          `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: waPhone,
              type: 'text',
              text: { body: finalMessage },
            }),
          }
        )
        waResult = await waRes.json()
        if (!waRes.ok) waError = waResult?.error?.message || 'WhatsApp API error'
      } catch (e) {
        waError = e.message
      }
    } else {
      waError = 'WhatsApp credentials not configured'
    }

    // Log the message regardless of send success
    const { data: logRow } = await supabase.from('wa_messages').insert({
      contact_id:  contactId || null,
      direction:   'outgoing',
      message:     finalMessage.slice(0, 2000),
      template_id: templateId || null,
      phone:       finalPhone,
      status:      waError ? 'failed' : 'sent',
      wa_msg_id:   waResult?.messages?.[0]?.id || null,
    }).select().single()

    return new Response(
      JSON.stringify({
        success: !waError,
        error:   waError || undefined,
        messageId: logRow?.id,
        waMessageId: waResult?.messages?.[0]?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
