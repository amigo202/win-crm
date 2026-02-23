import { supabase } from '../lib/supabase'

export function fromDbActivity(r) {
  return {
    id:          r.id,
    contactId:   r.contact_id,
    dealId:      r.deal_id,
    type:        r.type,
    description: r.description,
    metadata:    r.metadata || {},
    createdAt:   r.created_at,
  }
}

export async function fetchActivities(contactId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbActivity)
}

export async function createActivity(data) {
  const { data: row, error } = await supabase
    .from('activities')
    .insert({
      contact_id:  data.contactId,
      deal_id:     data.dealId   || null,
      type:        data.type     || 'note',
      description: data.description || '',
      metadata:    data.metadata || {},
    })
    .select()
    .single()
  if (error) throw error
  return fromDbActivity(row)
}
