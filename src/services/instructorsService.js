import { supabase } from '../lib/supabase'

export function fromDbInstructor(r) {
  return {
    id:         r.id,
    name:       r.name,
    phone:      r.phone,
    email:      r.email,
    programs:   r.programs || [],
    hourlyRate: r.hourly_rate,
    sessions:   r.sessions  || [],
    createdAt:  r.created_at,
  }
}

export function toDbInstructor(i) {
  return {
    name:        i.name,
    phone:       i.phone       || null,
    email:       i.email       || null,
    programs:    i.programs    || [],
    hourly_rate: Number(i.hourlyRate) || 0,
    sessions:    i.sessions    || [],
  }
}

export async function fetchInstructors() {
  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbInstructor)
}

export async function createInstructor(data) {
  const { data: row, error } = await supabase
    .from('instructors').insert(toDbInstructor(data)).select().single()
  if (error) throw error
  return fromDbInstructor(row)
}

export async function updateInstructor(id, data) {
  const { error } = await supabase
    .from('instructors').update(toDbInstructor(data)).eq('id', id)
  if (error) throw error
}

export async function deleteInstructor(id) {
  const { error } = await supabase.from('instructors').delete().eq('id', id)
  if (error) throw error
}

export async function appendSession(instructorId, session) {
  const { data: row, error: fetchErr } = await supabase
    .from('instructors').select('sessions').eq('id', instructorId).single()
  if (fetchErr) throw fetchErr
  const next = [...(row.sessions || []), session]
  const { error } = await supabase
    .from('instructors').update({ sessions: next }).eq('id', instructorId)
  if (error) throw error
  return next
}
