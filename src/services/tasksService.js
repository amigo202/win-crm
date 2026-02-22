import { supabase } from '../lib/supabase'

export function fromDbTask(r) {
  return {
    id:        r.id,
    title:     r.title,
    contactId: r.contact_id,
    priority:  r.priority,
    dueDate:   r.due_date,
    completed: r.completed,
    createdAt: r.created_at,
  }
}

export function toDbTask(t) {
  return {
    title:      t.title,
    contact_id: t.contactId || null,
    priority:   t.priority  || 'medium',
    due_date:   t.dueDate   || null,
    completed:  t.completed || false,
  }
}

export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbTask)
}

export async function createTask(data) {
  const { data: row, error } = await supabase
    .from('tasks').insert({ ...toDbTask(data), completed: false }).select().single()
  if (error) throw error
  return fromDbTask(row)
}

export async function updateTask(id, data) {
  const { error } = await supabase
    .from('tasks').update(toDbTask(data)).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function toggleTask(id, completed) {
  const { error } = await supabase
    .from('tasks').update({ completed }).eq('id', id)
  if (error) throw error
}
