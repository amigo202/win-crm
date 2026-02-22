import { supabase } from '../lib/supabase'

export function fromDbStudent(r) {
  return {
    id:            r.id,
    name:          r.name,
    contactId:     r.contact_id,
    program:       r.program,
    paymentStatus: r.payment_status,
    attendance:    r.attendance || [],
    notes:         r.notes,
    createdAt:     r.created_at,
  }
}

export function toDbStudent(s) {
  return {
    name:           s.name,
    contact_id:     s.contactId     || null,
    program:        s.program       || null,
    payment_status: s.paymentStatus || 'pending',
    attendance:     s.attendance    || [],
    notes:          s.notes         || null,
  }
}

export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbStudent)
}

export async function createStudent(data) {
  const { data: row, error } = await supabase
    .from('students').insert(toDbStudent(data)).select().single()
  if (error) throw error
  return fromDbStudent(row)
}

export async function updateStudent(id, data) {
  const { error } = await supabase
    .from('students').update(toDbStudent(data)).eq('id', id)
  if (error) throw error
}

export async function deleteStudent(id) {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

export async function appendAttendance(studentId, record) {
  const { data: row, error: fetchErr } = await supabase
    .from('students').select('attendance').eq('id', studentId).single()
  if (fetchErr) throw fetchErr
  const next = [...(row.attendance || []), record]
  const { error } = await supabase
    .from('students').update({ attendance: next }).eq('id', studentId)
  if (error) throw error
  return next
}
