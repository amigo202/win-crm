import { supabase } from '../lib/supabase'

// ── Notification Preferences ──────────────────────────────────────
let _warned = false
export async function fetchPreferences() {
  const { data, error } = await supabase
    .from('notification_preferences').select('*').maybeSingle()
  if (error) {
    if (!_warned) { console.warn('fetchPreferences: table may not exist yet –', error.message); _warned = true }
    return null
  }
  return data
}

export async function upsertPreferences(prefs) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id:         user.id,
      task_due_today:  prefs.taskDueToday ?? true,
      payment_overdue: prefs.paymentOverdue ?? true,
      lead_at_risk:    prefs.leadAtRisk ?? true,
      weekly_digest:   prefs.weeklyDigest ?? true,
      daily_digest:    prefs.dailyDigest ?? false,
      email_address:   prefs.emailAddress || null,
    }, { onConflict: 'user_id' })
    .select().single()
  if (error) throw error
  return data
}

// ── Send Test Email ───────────────────────────────────────────────
export async function sendTestEmail(type, to) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { type, test: true, to }
  })
  if (error) throw error
  return data
}
