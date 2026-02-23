import { supabase } from '../lib/supabase'

export function fromDbDeal(r) {
  return {
    id:        r.id,
    ownerId:   r.owner_id,
    title:     r.title,
    contactId: r.contact_id,
    value:     r.value,
    stage:     r.stage,
    program:   r.program,
    closeDate: r.close_date,
    notes:     r.notes,
    createdAt: r.created_at,
  }
}

export function toDbDeal(d) {
  return {
    title:      d.title,
    contact_id: d.contactId  || null,
    value:      Number(d.value) || 0,
    stage:      d.stage       || 'lead',
    program:    d.program     || null,
    close_date: d.closeDate   || null,
    notes:      d.notes       || null,
  }
}

export async function fetchDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbDeal)
}

export async function createDeal(data) {
  const { data: row, error } = await supabase
    .from('deals').insert(toDbDeal(data)).select().single()
  if (error) throw error
  return fromDbDeal(row)
}

export async function updateDeal(id, data) {
  const { error } = await supabase
    .from('deals').update(toDbDeal(data)).eq('id', id)
  if (error) throw error
}

export async function deleteDeal(id) {
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw error
}
