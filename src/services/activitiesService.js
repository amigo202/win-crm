import { supabase } from '../lib/supabase'

/* ── DB ↔ App field mapping ──────────────────────────────── */

export function fromDb(r) {
  return {
    id:            r.id,
    ownerId:       r.owner_id,
    name:          r.name,
    activityType:  r.activity_type,
    contactId:     r.contact_id,
    contactName:   r.contact_name,
    activityDate:  r.activity_date,
    month:         r.month,
    year:          r.year,
    income:        Number(r.income  || 0),
    expenses:      Number(r.expenses || 0),
    profit:        Number(r.profit  || 0),
    paymentStatus: r.payment_status,
    paymentDate:   r.payment_date,
    paymentMethod: r.payment_method,
    invoiceNumber: r.invoice_number,
    notes:         r.notes,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  }
}

function toDb(a) {
  return {
    name:            a.name,
    activity_type:   a.activityType   || 'other',
    contact_id:      a.contactId      || null,
    contact_name:    a.contactName    || null,
    activity_date:   a.activityDate   || null,
    month:           a.month != null ? Number(a.month) : null,
    year:            a.year  != null ? Number(a.year)  : null,
    income:          Number(a.income   || 0),
    expenses:        Number(a.expenses || 0),
    payment_status:  a.paymentStatus  || 'pending',
    payment_date:    a.paymentDate    || null,
    payment_method:  a.paymentMethod  || null,
    invoice_number:  a.invoiceNumber  || null,
    notes:           a.notes          || null,
  }
}

/* ── CRUD ─────────────────────────────────────────────────── */

export async function fetchActivities() {
  const { data, error } = await supabase
    .from('business_activities')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(fromDb)
}

export async function createActivity(data) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = { ...toDb(data), owner_id: user.id }
  const { data: row, error } = await supabase
    .from('business_activities').insert(payload).select().single()
  if (error) throw error
  return fromDb(row)
}

export async function updateActivity(id, data) {
  const payload = toDb(data)
  const { data: row, error } = await supabase
    .from('business_activities').update(payload).eq('id', id).select().single()
  if (error) throw error
  return fromDb(row)
}

export async function deleteActivity(id) {
  const { error } = await supabase.from('business_activities').delete().eq('id', id)
  if (error) throw error
}
