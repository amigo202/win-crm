import { supabase } from '../lib/supabase'

export function fromDbStudent(r) {
  return {
    id:            r.id,
    ownerId:       r.owner_id,
    name:          r.name,
    contactId:     r.contact_id,
    program:       r.program,
    paymentStatus: r.payment_status,
    attendance:    r.attendance || [],
    notes:         r.notes,
    parentName:    r.parent_name   || '',
    parentPhone:   r.parent_phone  || '',
    grade:         r.grade         || '',
    schoolName:    r.school_name   || '',
    className:     r.class_name    || '',
    createdAt:     r.created_at,
  }
}

// Core cols that always exist
const CORE_COLS = { name: 'name', contact_id: 'contactId', program: 'program', payment_status: 'paymentStatus', attendance: 'attendance', notes: 'notes' }
// New cols — may not exist yet if migration not run
const NEW_COLS  = { parent_name: 'parentName', parent_phone: 'parentPhone', grade: 'grade', school_name: 'schoolName', class_name: 'className' }

export function toDbStudent(s) {
  const row = {
    name:           s.name,
    contact_id:     s.contactId     || null,
    program:        s.program       || null,
    payment_status: s.paymentStatus || 'pending',
    attendance:     s.attendance    || [],
    notes:          s.notes         || null,
  }
  // Add new columns (safe — Supabase ignores unknown cols with 400, we catch below)
  if (s.parentName  !== undefined) row.parent_name  = s.parentName  || null
  if (s.parentPhone !== undefined) row.parent_phone = s.parentPhone || null
  if (s.grade       !== undefined) row.grade        = s.grade       || null
  if (s.schoolName  !== undefined) row.school_name  = s.schoolName  || null
  if (s.className   !== undefined) row.class_name   = s.className   || null
  return row
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
  let payload = toDbStudent(data)
  let { data: row, error } = await supabase
    .from('students').insert(payload).select().single()
  // If new columns cause 400 error, retry with core cols only
  if (error && error.code === '42703') {
    const { parent_name, parent_phone, grade, school_name, class_name, ...core } = payload
    const res = await supabase.from('students').insert(core).select().single()
    row = res.data; error = res.error
  }
  if (error) throw error
  return fromDbStudent(row)
}

export async function updateStudent(id, data) {
  let payload = toDbStudent(data)
  let { error } = await supabase
    .from('students').update(payload).eq('id', id)
  // If new columns cause error, retry with core cols only
  if (error && error.code === '42703') {
    const { parent_name, parent_phone, grade, school_name, class_name, ...core } = payload
    const res = await supabase.from('students').update(core).eq('id', id)
    error = res.error
  }
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
