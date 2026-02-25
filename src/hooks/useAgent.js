import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAgent() {
  const [messages, setMessages] = useState([])  // { id, role, text, actions? }
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // media: { base64, mimeType, preview? } — image or audio
  const send = useCallback(async (text, contacts = [], media = null, instructors = [], model = 'gemini-3-pro-preview') => {
    if (!text?.trim() || loading) return
    const isAudio = media?.mimeType?.startsWith('audio/')

    const userMsg = {
      id:          crypto.randomUUID(),
      role:        'user',
      text:        text.trim(),
      preview:     isAudio ? null : (media?.preview ?? null),
      isAudio:     isAudio ?? false,
      audioDur:    isAudio ? (media?.durationSec ?? 0) : null,
    }
    setMessages(p => [...p, userMsg])
    setLoading(true)
    setError(null)

    try {
      const session = (await supabase.auth.getSession()).data.session
      console.log('Session:', session)

      const body = {
        message: text.trim(),
        model,
        context: {
          contacts:    contacts.map(c => ({ id: c.id, name: c.name, phone: c.phone || null })),
          instructors: instructors.map(i => ({ id: i.id, name: i.name, programs: i.programs || [] })),
        },
      }
      // Attach media payload (image or audio)
      if (media?.base64) {
        const key = media.mimeType?.startsWith('audio/') ? 'audio' : 'image'
        body[key] = { base64: media.base64, mimeType: media.mimeType.split(';')[0] }
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('crm-agent', { body })
      if (fnError) {
        let detail = 'שגיאת שרת'
        try { const b = await fnError.context?.json(); detail = b?.error ?? b?.message ?? detail } catch {}
        throw new Error(detail)
      }
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
