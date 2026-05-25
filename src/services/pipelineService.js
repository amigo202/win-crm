import { supabase } from '../lib/supabase'

async function uid() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id
}

// ── Lines ──────────────────────────────────────────
export async function fetchLines() {
  const { data, error } = await supabase
    .from('revenue_lines')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function upsertLine(line) {
  const userId = await uid()
  const { data, error } = await supabase
    .from('revenue_lines')
    .upsert({ ...line, user_id: userId }, { onConflict: 'id' })
    .select()
  if (error) throw error
  return data?.[0]
}

export async function deleteLine(id) {
  const { error } = await supabase.from('revenue_lines').delete().eq('id', id)
  if (error) throw error
}

// ── Entries ────────────────────────────────────────
export async function fetchEntries(year) {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('*')
    .eq('year', year)
  if (error) throw error
  return data || []
}

export async function upsertEntry(entry) {
  const userId = await uid()
  const { data, error } = await supabase
    .from('revenue_entries')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'user_id,line_id,year,month' })
    .select()
  if (error) throw error
  return data?.[0]
}

export async function deleteEntry(lineId, year, month) {
  const userId = await uid()
  const { error } = await supabase
    .from('revenue_entries')
    .delete()
    .match({ user_id: userId, line_id: lineId, year, month })
  if (error) throw error
}
