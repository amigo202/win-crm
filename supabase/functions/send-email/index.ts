import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured. Set it with: supabase secrets set RESEND_API_KEY=re_xxxx' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { to, subject, html, type, test } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let emailTo      = to
    let emailSubject  = subject
    let emailHtml     = html

    // If type-based notification, build email from data
    if (type && !html) {
      const result = await buildNotificationEmail(supabase, type, test)
      if (!result) {
        return new Response(JSON.stringify({ error: 'No data for notification type: ' + type }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      emailSubject = result.subject
      emailHtml    = result.html
      if (!emailTo) emailTo = result.to
    }

    if (!emailTo || !emailSubject || !emailHtml) {
      return new Response(JSON.stringify({ error: 'Missing to, subject, or html' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WIN CRM <noreply@resend.dev>',
        to: Array.isArray(emailTo) ? emailTo : [emailTo],
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    const resendData = await resendRes.json()

    // Log notification
    await supabase.from('notification_log').insert({
      type:    type || 'custom',
      subject: emailSubject,
      sent_to: Array.isArray(emailTo) ? emailTo.join(', ') : emailTo,
      status:  resendRes.ok ? 'sent' : 'failed',
      error:   resendRes.ok ? null : JSON.stringify(resendData),
    })

    return new Response(
      JSON.stringify({ success: resendRes.ok, data: resendData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Build notification emails by type ──────────────────────────────
async function buildNotificationEmail(
  supabase: any, type: string, test: boolean
) {
  const wrapHtml = (title: string, body: string) => `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: 'Rubik', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f1f5f9;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden;">
        <div style="background: #f97316; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">WIN CRM</h1>
          <p style="color: #fed7aa; margin: 4px 0 0; font-size: 14px;">${title}</p>
        </div>
        <div style="padding: 24px;">${body}</div>
        <div style="padding: 16px 24px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8;">
          נשלח אוטומטית מ-WIN CRM
        </div>
      </div>
    </body></html>`

  switch (type) {
    case 'task_due_today': {
      const today = new Date().toISOString().split('T')[0]
      const { data: tasks } = await supabase
        .from('tasks').select('title, priority').eq('due_date', today).eq('completed', false).limit(20)
      if (!tasks?.length && !test) return null
      const rows = (tasks || [{ title: 'משימה לדוגמה', priority: 'high' }])
        .map((t: any) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${t.title}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${t.priority}</td></tr>`)
        .join('')
      return {
        subject: `📋 WIN CRM — ${tasks?.length || 1} משימות להיום`,
        html: wrapHtml('משימות להיום', `
          <table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:right;padding:8px;border-bottom:2px solid #f97316;">משימה</th><th style="text-align:right;padding:8px;border-bottom:2px solid #f97316;">עדיפות</th></tr></thead><tbody>${rows}</tbody></table>`),
      }
    }
    case 'payment_overdue': {
      const { data: payments } = await supabase
        .from('payments').select('amount, contact_id, program').eq('status', 'overdue').limit(20)
      if (!payments?.length && !test) return null
      return {
        subject: `💰 WIN CRM — ${payments?.length || 0} תשלומים באיחור`,
        html: wrapHtml('תשלומים באיחור', `<p>יש ${payments?.length || 0} תשלומים שטרם שולמו ועברו את מועד התשלום.</p>`),
      }
    }
    case 'lead_at_risk': {
      const { data: leads } = await supabase
        .from('contacts').select('name, lead_stage, last_activity_at')
        .eq('at_risk', true).not('lead_stage', 'is', null).limit(20)
      if (!leads?.length && !test) return null
      return {
        subject: `⚠️ WIN CRM — ${leads?.length || 0} לידים בסיכון`,
        html: wrapHtml('לידים בסיכון', `<p>${leads?.length || 0} לידים לא קיבלו טיפול ב-7 הימים האחרונים.</p>`),
      }
    }
    case 'weekly_digest':
    case 'daily_digest': {
      return {
        subject: `📊 WIN CRM — סיכום ${type === 'weekly_digest' ? 'שבועי' : 'יומי'}`,
        html: wrapHtml(type === 'weekly_digest' ? 'סיכום שבועי' : 'סיכום יומי',
          `<p>מכיל עדכונים ממערכת ה-CRM שלך. התחבר למערכת לפרטים נוספים.</p>`),
      }
    }
    default:
      return null
  }
}
