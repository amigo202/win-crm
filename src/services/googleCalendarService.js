import { supabase } from '../lib/supabase'

// ── OAuth Flow ────────────────────────────────────────────────────
// Auth URL is generated server-side (GOOGLE_CLIENT_ID stays in Edge Function secrets)
async function _getAuthUrl(state) {
  const redirectUri = window.location.origin + window.location.pathname
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'get_auth_url', redirectUri, state }
  })
  if (error || !data?.url) throw new Error(data?.error || 'Failed to get auth URL')
  return data.url
}

export async function getAuthUrl() {
  return _getAuthUrl('google_calendar_connect')
}

export async function getGmailAuthUrl() {
  return _getAuthUrl('gmail_connect')
}

export async function exchangeCode(code) {
  const redirectUri = window.location.origin + window.location.pathname
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'exchange_code', code, redirectUri }
  })
  if (error) throw error
  return data
}

// ── Connection Status ─────────────────────────────────────────────
export async function checkConnection() {
  // Don't call Edge Function without an active user session — avoids 401
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { connected: false }

  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'check_connection' }
  })
  if (error) return { connected: false }
  return data
}

export async function disconnect() {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'disconnect' }
  })
  if (error) throw error
  return data
}

