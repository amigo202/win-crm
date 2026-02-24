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
      const body = {
        message: text.trim(),
        context: { contacts: contacts.map(c => ({ id: c.id, name: c.name, phone: c.phone || null })) },
      }
      // Attach image payload if provided (base64 without data-URL prefix)
      if (image?.base64) body.image = { base64: image.base64, mimeType: image.mimeType }

      const { data: result, error: fnError } = await supabase.functions.invoke('crm-agent', { body })
      if (fnError) throw new Error(fnError.message ?? 'שגיאת שרת')
      if (result?.error) throw new Error(result.error)

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
