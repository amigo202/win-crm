import { supabase } from '../lib/supabase'

export function fromDbContact(r) {
  return {
    id:             r.id,
    ownerId:        r.owner_id,
    type:           r.type,
    name:           r.name,
    contactPerson:  r.contact_person,
    phone:          r.phone,
    email:          r.email,
    city:           r.city,
    status:         r.status,
    activePrograms: r.active_programs || [],
    notes:          r.notes || [],
    activities:     r.activities || [],
    tags:           r.tags || [],
    principal:      r.principal,
    studentCount:   r.student_count,
    department:     r.department,
    manager:        r.manager,
    targetAudience: r.target_audience,
    eventTypes:     r.event_types,
    age:            r.age,
    parentName:     r.parent_name,
    program:        r.program,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  }
}

export function toDbContact(c) {
  return {
    type:            c.type,
    name:            c.name,
    contact_person:  c.contactPerson  || null,
    phone:           c.phone          || null,
    email:           c.email          || null,
    city:            c.city           || null,
    status:          c.status         || 'lead',
    active_programs: c.activePrograms || [],
    notes:           c.notes          || [],
    activities:      c.activities     || [],
    tags:            c.tags           || [],
    principal:       c.principal      || null,
    student_count:   c.studentCount   || null,
    department:      c.department     || null,
    manager:         c.manager        || null,
    target_audience: c.targetAudience || null,
    event_types:     c.eventTypes     || null,
    age:             c.age            || null,
    parent_name:     c.parentName     || null,
    program:         c.program        || null,
  }
}

export async function fetchContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbContact)
}

export async function createContact(data) {
  const initAct = [{ id: crypto.randomUUID(), desc: 'נוסף איש קשר חדש', date: new Date().toISOString() }]
  const dbRow = {
    ...toDbContact(data),
    activities: initAct,
    notes:      data.notes || [],
    tags:       data.tags  || [],
  }
  const { data: row, error } = await supabase
    .from('contacts').insert(dbRow).select().single()
  if (error) throw error
  return fromDbContact(row)
}

export async function updateContact(id, data) {
  const { error } = await supabase
    .from('contacts').update(toDbContact(data)).eq('id', id)
  if (error) throw error
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}

export async function appendActivity(contactId, act) {
  const { data: row, error: fetchErr } = await supabase
    .from('contacts').select('activities').eq('id', contactId).single()
  if (fetchErr) throw fetchErr
  const next = [...(row.activities || []), act]
  const { error } = await supabase
    .from('contacts').update({ activities: next }).eq('id', contactId)
  if (error) throw error
  return next
}
