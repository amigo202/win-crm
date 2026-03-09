import { supabase } from '../lib/supabase'

let _warned = false
export async function fetchSchedules() {
  const { data, error } = await supabase
    .from('report_schedules').select('*').order('created_at', { ascending: false })
  if (error) {
    if (!_warned) { console.warn('fetchSchedules: table may not exist yet –', error.message); _warned = true }
    return []
  }
  return data
}

export async function createSchedule(data) {
  const { data: row, error } = await supabase
    .from('report_schedules').insert({
      report_type:  data.reportType,
      frequency:    data.frequency || 'monthly',
      recipients:   data.recipients || [],
      day_of_week:  data.dayOfWeek ?? null,
      day_of_month: data.dayOfMonth ?? 1,
      enabled:      data.enabled !== false,
    }).select().single()
  if (error) throw error
  return row
}

export async function updateSchedule(id, data) {
  const updates = {}
  if (data.recipients !== undefined)  updates.recipients   = data.recipients
  if (data.frequency !== undefined)   updates.frequency    = data.frequency
  if (data.dayOfWeek !== undefined)   updates.day_of_week  = data.dayOfWeek
  if (data.dayOfMonth !== undefined)  updates.day_of_month = data.dayOfMonth
  if (data.enabled !== undefined)     updates.enabled      = data.enabled

  const { error } = await supabase.from('report_schedules').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteSchedule(id) {
  const { error } = await supabase.from('report_schedules').delete().eq('id', id)
  if (error) throw error
}

export async function triggerReport(type) {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { type }
  })
  if (error) throw error
  return data
}
