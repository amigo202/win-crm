import { supabase } from '../lib/supabase'

// ── Template CRUD ──────────────────────────────────────────────────
let _warnedTpl = false
export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('wa_templates').select('*').order('created_at', { ascending: false })
  if (error) {
    if (!_warnedTpl) { console.warn('fetchTemplates: table may not exist yet –', error.message); _warnedTpl = true }
    return []
  }
  return data
}

export async function createTemplate(data) {
  const { data: row, error } = await supabase
    .from('wa_templates').insert({
      name:     data.name,
      body:     data.body,
      category: data.category || 'general',
    }).select().single()
  if (error) throw error
  return row
}

export async function updateTemplate(id, data) {
  const { error } = await supabase
    .from('wa_templates').update({ name: data.name, body: data.body, category: data.category }).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('wa_templates').delete().eq('id', id)
  if (error) throw error
}

// ── Message Log ────────────────────────────────────────────────────
let _warnedMsg = false
export async function fetchMessages(contactId, limit = 50) {
  const { data, error } = await supabase
    .from('wa_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (!_warnedMsg) { console.warn('fetchMessages: table may not exist yet –', error.message); _warnedMsg = true }
    return []
  }
  return data
}

export async function fetchAllMessages(limit = 100) {
  const { data, error } = await supabase
    .from('wa_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('fetchAllMessages:', error); return [] }
  return data
}

// ── Send Message (via Edge Function) ───────────────────────────────
export async function sendWhatsApp({ contactId, phone, message, templateId, templateVars }) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { contactId, phone, message, templateId, templateVars }
  })
  if (error) throw error
  return data
}

// ── Fallback: open wa.me link (for when Edge Function is not set up)
export function openWhatsAppLink(phone, message = '') {
  const clean = phone.replace(/[^0-9+]/g, '')
  const intl  = clean.startsWith('+') ? clean.slice(1)
              : clean.startsWith('0') ? '972' + clean.slice(1)
              : clean
  const url = `https://wa.me/${intl}${message ? '?text=' + encodeURIComponent(message) : ''}`
  window.open(url, '_blank')
}

// ── Interpolate template variables ─────────────────────────────────
export function interpolateTemplate(body, vars) {
  if (!body) return ''
  let result = body
  for (const [key, value] of Object.entries(vars || {})) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}
