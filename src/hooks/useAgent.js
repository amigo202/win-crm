import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAgent() {
  const [messages, setMessages] = useState([])  // { id, role, text, actions? }
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // image: { base64: string, mimeType: string } | null
  const send = useCallback(async (text, contacts = [], image = null) => {
    if (!text?.trim() || loading) return

    const userMsg = {
      id:      crypto.randomUUID(),
      role:    'user',
      text:    text.trim(),
      preview: image?.preview ?? null,   // data-URL for thumbnail display
    }
    setMessages(p => [...p, userMsg])
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('לא מחובר')

      const body = {
        message: text.trim(),
        context: { contacts: contacts.map(c => ({ id: c.id, name: c.name, phone: c.phone || null })) },
      }
      // Attach image payload if provided (base64 without data-URL prefix)
      if (image?.base64) body.image = { base64: image.base64, mimeType: image.mimeType }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-agent`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      })

      const result = await res.json()

      if (!res.ok) throw new Error(result.error ?? `שגיאת שרת ${res.status}`)

      const actions = result.actions_taken ?? []

      // Auto-open WhatsApp URLs returned by the agent
      actions.forEach(a => {
        if (a.type === 'open_whatsapp' && a.url) window.open(a.url, '_blank')
      })

      setMessages(p => [...p, {
        id:      crypto.randomUUID(),
        role:    'agent',
        text:    result.response ?? 'בוצע',
        actions,
      }])
    } catch (e) {
      setError(e.message)
      setMessages(p => [...p, {
        id:   crypto.randomUUID(),
        role: 'error',
        text: `שגיאה: ${e.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }, [loading])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, send, clear }
}
