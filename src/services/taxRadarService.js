import { supabase } from '../lib/supabase'

// ── DB mappers ────────────────────────────────────────────────────────────────
// finance_months: DB column names differ from hook's short names

function monthFromDb(r) {
  return {
    id:                    r.id,
    user_id:               r.user_id,
    year:                  r.year,
    month:                 r.month,
    income:                Number(r.income                || 0),
    payroll:               Number(r.payroll_expenses      || 0),
    subcontractors:        Number(r.subcontractors        || 0),
    professional_services: Number(r.professional_services || 0),
    software:              Number(r.software_expenses     || 0),
    marketing:             Number(r.marketing_expenses    || 0),
    vehicle:               Number(r.vehicle_expenses      || 0),
    office:                Number(r.office_expenses       || 0),
    other:                 Number(r.other_expenses        || 0),
    total_expenses:        Number(r.total_expenses        || 0),
    net_profit:            Number(r.net_profit            || 0),
    notes:                 r.notes || '',
    is_closed:             r.is_closed || false,
    created_at:            r.created_at,
    updated_at:            r.updated_at,
  }
}

function monthToDb(m) {
  return {
    year:                  m.year,
    month:                 m.month,
    income:                Number(m.income                || 0),
    payroll_expenses:      Number(m.payroll               || 0),
    subcontractors:        Number(m.subcontractors        || 0),
    professional_services: Number(m.professional_services || 0),
    software_expenses:     Number(m.software              || 0),
    marketing_expenses:    Number(m.marketing             || 0),
    vehicle_expenses:      Number(m.vehicle               || 0),
    office_expenses:       Number(m.office                || 0),
    other_expenses:        Number(m.other                 || 0),
    notes:                 m.notes || null,
    is_closed:             m.is_closed || false,
  }
}

function paymentFromDb(r) {
  return {
    id:           r.id,
    user_id:      r.user_id,
    year:         r.year,
    payment_date: r.payment_date,
    date:         r.payment_date,   // alias used in UI
    type:         r.type,
    amount:       Number(r.amount || 0),
    period_month: r.period_month,
    notes:        r.notes || '',
    created_at:   r.created_at,
  }
}

function settingsFromDb(r) {
  if (!r) return { taxRate: 35, bankBalance: 0, monthlyCommitments: 0 }
  return {
    taxRate:            Number(r.tax_rate_pct         || 35),
    bankBalance:        Number(r.bank_balance         || 0),
    monthlyCommitments: Number(r.monthly_commitments  || 0),
  }
}

// ── Finance Months ────────────────────────────────────────────────────────────

export async function fetchMonths(year) {
  let q = supabase.from('finance_months').select('*').order('month', { ascending: true })
  if (year) q = q.eq('year', year)
  const { data, error } = await q
  if (error) throw error
  return data.map(monthFromDb)
}

export async function upsertMonth(data) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = { ...monthToDb(data), user_id: user.id }

  // Try insert first, on conflict update
  const { data: row, error } = await supabase
    .from('finance_months')
    .upsert(payload, { onConflict: 'user_id,year,month' })
    .select()
    .single()
  if (error) throw error
  return monthFromDb(row)
}

export async function deleteMonth(year, month) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('finance_months')
    .delete()
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
  if (error) throw error
}

// ── Tax Payments ──────────────────────────────────────────────────────────────

export async function fetchPayments(year) {
  let q = supabase.from('tax_payments').select('*').order('payment_date', { ascending: false })
  if (year) q = q.eq('year', year)
  const { data, error } = await q
  if (error) throw error
  return data.map(paymentFromDb)
}

export async function addPayment(data) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    user_id:      user.id,
    year:         data.year,
    payment_date: data.date || data.payment_date || new Date().toISOString().split('T')[0],
    type:         data.type,
    amount:       Number(data.amount || 0),
    period_month: data.period_month || null,
    notes:        data.notes || null,
  }
  const { data: row, error } = await supabase
    .from('tax_payments').insert(payload).select().single()
  if (error) throw error
  return paymentFromDb(row)
}

export async function removePayment(id) {
  const { error } = await supabase.from('tax_payments').delete().eq('id', id)
  if (error) throw error
}

// ── Settings (tax_forecasts table — 1 row per user per year) ─────────────────

export async function fetchSettings(year) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('tax_forecasts')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return settingsFromDb(data)
}

export async function saveSettings(year, settings) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    user_id:             user.id,
    year,
    tax_rate_pct:        Number(settings.taxRate            || 35),
    bank_balance:        Number(settings.bankBalance        || 0),
    monthly_commitments: Number(settings.monthlyCommitments || 0),
    updated_at:          new Date().toISOString(),
  }
  const { error } = await supabase
    .from('tax_forecasts')
    .upsert(payload, { onConflict: 'user_id,year' })
  if (error) throw error
}
