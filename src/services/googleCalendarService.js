import { supabase } from '../lib/supabase'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// ── OAuth Flow ────────────────────────────────────────────────────
// Scopes: Calendar + Gmail read (for invoice scanning)
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

export function getAuthUrl() {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID not set')
    return null
  }
  const redirectUri = window.location.origin + window.location.pathname
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         GOOGLE_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         'google_calendar_connect',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Dedicated Gmail auth URL (same scopes, different state)
export function getGmailAuthUrl() {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID not set')
    return null
  }
  const redirectUri = window.location.origin + window.location.pathname
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         GOOGLE_SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         'gmail_connect',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
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

// ── Sync ──────────────────────────────────────────────────────────
export async function syncTasks(tasks) {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'sync_tasks', tasks }
  })
  if (error) throw error
  return data
}

export async function syncClasses(classes) {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'sync_classes', classes }
  })
  if (error) throw error
  return data
}
