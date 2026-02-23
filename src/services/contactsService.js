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

// ── Bulk upsert from CSV import ────────────────────────────────────
// rows: array of { name, type?, contact_person?, phone?, email? }
// Dedup: email (primary) → phone (secondary) → insert new
// owner_id is auto-set by the DB trigger on INSERT; RLS filters updates.
export async function upsertContacts(rows) {
  // 1. Fetch existing email + phone for duplicate detection
  const { data: existing, error: fetchErr } = await supabase
    .from('contacts')
    .select('id, email, phone')
  if (fetchErr) throw fetchErr

  const emailMap = {}
  const phoneMap = {}
  for (const c of existing) {
    const e = c.email?.toLowerCase().trim()
    const p = c.phone?.replace(/\s/g, '')
    if (e) emailMap[e] = c.id
    if (p) phoneMap[p] = c.id
  }

  const toInsert = []
  const toUpdate = []   // { id, data }
  let   skipped  = 0

  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) { skipped++; continue }

    const email = row.email?.toLowerCase().trim()  || null
    const phone = row.phone?.replace(/\s/g, '')    || null

    const dbRow = {
      type:           row.type?.trim() || 'other',
      name,
      contact_person: row.contact_person?.trim() || null,
      phone,
      email,
    }

    let existingId = null
    if (email && emailMap[email])  existingId = emailMap[email]
    else if (phone && phoneMap[phone]) existingId = phoneMap[phone]

    if (existingId) toUpdate.push({ id: existingId, data: dbRow })
    else            toInsert.push(dbRow)
  }

  let inserted = 0
  let updated  = 0
  const errors = []

  // 2. Insert new rows — 200 per batch (owner_id set by DB trigger)
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200)
    const { error } = await supabase.from('contacts').insert(chunk)
    if (error) chunk.forEach(r => errors.push({ row: r, error: error.message }))
    else       inserted += chunk.length
  }

  // 3. Update matched rows — 50 in parallel per round
  for (let i = 0; i < toUpdate.length; i += 50) {
    const chunk = toUpdate.slice(i, i + 50)
    const results = await Promise.all(
      chunk.map(({ id, data }) =>
        supabase.from('contacts').update(data).eq('id', id)
          .then(({ error }) => ({ ok: !error, msg: error?.message, data }))
      )
    )
    for (const r of results) {
      if (r.ok) updated++
      else      errors.push({ row: r.data, error: r.msg })
    }
  }

  return { inserted, updated, skipped, errors }
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
