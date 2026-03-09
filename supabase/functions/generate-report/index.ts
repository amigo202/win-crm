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

    const { type } = await req.json()

    // Get all report schedules that are enabled
    const { data: schedules } = await supabase
      .from('report_schedules')
      .select('*')
      .eq('enabled', true)
      .eq('report_type', type || 'monthly_financial')

    if (!schedules?.length) {
      return new Response(JSON.stringify({ message: 'No active schedules for type: ' + type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const curMonth = now.getMonth() + 1
    const curYear  = now.getFullYear()
    // For monthly report, use previous month
    const reportMonth = type === 'monthly_financial' ? (curMonth === 1 ? 12 : curMonth - 1) : curMonth
    const reportYear  = type === 'monthly_financial' && curMonth === 1 ? curYear - 1 : curYear

    let reportsSent = 0

    for (const schedule of schedules) {
      const recipients = schedule.recipients || []
      if (!recipients.length) continue

      // Build report HTML
      let html = ''
      let subject = ''

      if (schedule.report_type === 'monthly_financial') {
        // Fetch financial data
        const [payments, salaries, classes, activities] = await Promise.all([
          supabase.from('payments').select('*').eq('month', reportMonth).eq('year', reportYear).then(r => r.data || []),
          supabase.from('salaries').select('*').eq('month', reportMonth).eq('year', reportYear).then(r => r.data || []),
          supabase.from('classes').select('*').eq('month', reportMonth).eq('year', reportYear).then(r => r.data || []),
          supabase.from('business_activities').select('*').eq('month', reportMonth).eq('year', reportYear).then(r => r.data || []),
        ])

        const totalIncome = classes.reduce((s: number, c: any) => s + Number(c.actual_income || c.agreed_price || 0), 0)
          + activities.reduce((s: number, a: any) => s + Number(a.income || 0), 0)
          + payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

        const totalExpenses = classes.reduce((s: number, c: any) => s + Number(c.total_instructor_cost || 0), 0)
          + activities.reduce((s: number, a: any) => s + Number(a.expenses || 0), 0)
          + salaries.reduce((s: number, x: any) => s + Number(x.net_salary || 0), 0)

        const profit = totalIncome - totalExpenses
        const margin = totalIncome ? ((profit / totalIncome) * 100).toFixed(1) : '0'

        const monthNames = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

        subject = `📊 WIN CRM — דוח כספי ${monthNames[reportMonth]} ${reportYear}`
        html = buildFinancialReport(monthNames[reportMonth], reportYear, totalIncome, totalExpenses, profit, margin, classes.length, payments.length, salaries.length)
      } else if (schedule.report_type === 'weekly_pipeline') {
        const { data: leads } = await supabase
          .from('contacts').select('name, lead_stage, at_risk')
          .not('lead_stage', 'is', null)

        const atRisk = (leads || []).filter((l: any) => l.at_risk).length
        const newLeads = (leads || []).filter((l: any) => l.lead_stage === 'new').length
        const proposals = (leads || []).filter((l: any) => l.lead_stage === 'proposal').length

        subject = `📈 WIN CRM — סיכום פייפליין שבועי`
        html = buildPipelineReport(leads?.length || 0, newLeads, atRisk, proposals)
      }

      // Send via send-email edge function (internal call)
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (RESEND_API_KEY && html) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'WIN CRM <noreply@resend.dev>',
            to: recipients,
            subject,
            html,
          }),
        })

        // Update last_sent_at
        await supabase.from('report_schedules').update({ last_sent_at: new Date().toISOString() }).eq('id', schedule.id)
        reportsSent++
      }
    }

    return new Response(
      JSON.stringify({ success: true, reportsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildFinancialReport(month: string, year: number, income: number, expenses: number, profit: number, margin: string, classCount: number, paymentCount: number, salaryCount: number) {
  const fmt = (n: number) => '₪' + n.toLocaleString('he-IL')
  return `
    <!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
    <body style="font-family:'Rubik','Segoe UI',Arial,sans-serif;margin:0;padding:20px;background:#f1f5f9;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#f97316;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">WIN CRM</h1>
          <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">דוח כספי — ${month} ${year}</p>
        </div>
        <div style="padding:24px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#fff7ed;"><td style="padding:12px;font-weight:600;">הכנסות</td><td style="padding:12px;text-align:left;color:#10b981;font-weight:700;">${fmt(income)}</td></tr>
            <tr><td style="padding:12px;font-weight:600;">הוצאות</td><td style="padding:12px;text-align:left;color:#ef4444;font-weight:700;">${fmt(expenses)}</td></tr>
            <tr style="background:#f0fdf4;"><td style="padding:12px;font-weight:600;">רווח</td><td style="padding:12px;text-align:left;color:#059669;font-weight:700;">${fmt(profit)} (${margin}%)</td></tr>
          </table>
          <div style="display:flex;gap:12px;">
            <div style="flex:1;text-align:center;background:#f8fafc;padding:12px;border-radius:8px;">
              <div style="font-size:24px;font-weight:700;">${classCount}</div><div style="font-size:12px;color:#64748b;">חוגים</div>
            </div>
            <div style="flex:1;text-align:center;background:#f8fafc;padding:12px;border-radius:8px;">
              <div style="font-size:24px;font-weight:700;">${paymentCount}</div><div style="font-size:12px;color:#64748b;">תשלומים</div>
            </div>
            <div style="flex:1;text-align:center;background:#f8fafc;padding:12px;border-radius:8px;">
              <div style="font-size:24px;font-weight:700;">${salaryCount}</div><div style="font-size:12px;color:#64748b;">משכורות</div>
            </div>
          </div>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
          נשלח אוטומטית מ-WIN CRM | ${new Date().toLocaleDateString('he-IL')}
        </div>
      </div>
    </body></html>`
}

function buildPipelineReport(total: number, newLeads: number, atRisk: number, proposals: number) {
  return `
    <!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
    <body style="font-family:'Rubik','Segoe UI',Arial,sans-serif;margin:0;padding:20px;background:#f1f5f9;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#3b82f6;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">WIN CRM</h1>
          <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">סיכום פייפליין שבועי</p>
        </div>
        <div style="padding:24px;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:120px;text-align:center;background:#f8fafc;padding:16px;border-radius:8px;">
              <div style="font-size:28px;font-weight:700;color:#3b82f6;">${total}</div><div style="font-size:12px;color:#64748b;">סה"כ לידים</div>
            </div>
            <div style="flex:1;min-width:120px;text-align:center;background:#dbeafe;padding:16px;border-radius:8px;">
              <div style="font-size:28px;font-weight:700;color:#2563eb;">${newLeads}</div><div style="font-size:12px;color:#64748b;">חדשים</div>
            </div>
            <div style="flex:1;min-width:120px;text-align:center;background:#fef3c7;padding:16px;border-radius:8px;">
              <div style="font-size:28px;font-weight:700;color:#d97706;">${proposals}</div><div style="font-size:12px;color:#64748b;">בהצעת מחיר</div>
            </div>
            <div style="flex:1;min-width:120px;text-align:center;background:${atRisk > 0 ? '#fee2e2' : '#d1fae5'};padding:16px;border-radius:8px;">
              <div style="font-size:28px;font-weight:700;color:${atRisk > 0 ? '#dc2626' : '#059669'};">${atRisk}</div><div style="font-size:12px;color:#64748b;">בסיכון</div>
            </div>
          </div>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
          נשלח אוטומטית מ-WIN CRM | ${new Date().toLocaleDateString('he-IL')}
        </div>
      </div>
    </body></html>`
}
