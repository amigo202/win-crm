import { supabase } from '../lib/supabase'

export function fromDbPayment(r) {
  return {
    id:           r.id,
    ownerId:      r.owner_id,
    contactId:    r.contact_id,
    instructorId: r.instructor_id,
    amount:       Number(r.amount || 0),
    month:        r.month,
    year:         r.year,
    status:       r.status,
    program:      r.program,
    notes:        r.notes,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  }
}

function toDbPayment(p) {
  return {
    contact_id:    p.contactId    || null,
    instructor_id: p.instructorId || null,
    amount:        Number(p.amount) || 0,
    month:         Number(p.month),
    year:          Number(p.year),
    status:        p.status       || 'pending',
    program:       p.program      || null,
    notes:         p.notes        || null,
  }
}

export async function fetchPayments(month, year) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbPayment)
}

export async function createPayment(data) {
  const { data: row, error } = await supabase
    .from('payments').insert(toDbPayment(data)).select().single()
  if (error) throw error
  return fromDbPayment(row)
}

export async function updatePayment(id, data) {
  const { error } = await supabase
    .from('payments').update(toDbPayment(data)).eq('id', id)
  if (error) throw error
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}
