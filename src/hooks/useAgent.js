import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Max history turns to send (keeps token usage manageable)
const MAX_HISTORY = 10

export function useAgent() {
  const [messages, setMessages] = useState([])  // { id, role, text, actions? }
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  /**
   * send() — main entry point
   *
   * @param text           The user's message text
   * @param contacts       Full contacts array from the CRM
   * @param media          Optional { base64, mimeType, preview? } — image or audio
   * @param instructors    Full instructors array
   * @param model          Gemini model id
   * @param businessData   { tasks, deals, leads, students } — for business snapshot
   */
  const send = useCallback(async (
    text,
    contacts     = [],
    media        = null,
    instructors  = [],
    model        = 'gemini-3-pro-preview',
    businessData = {},
  ) => {
    if (!text?.trim() || loading) return
    const isAudio = media?.mimeType?.startsWith('audio/')

    const userMsg = {
      id:       crypto.randomUUID(),
      role:     'user',
      text:     text.trim(),
      preview:  isAudio ? null : (media?.preview ?? null),
      isAudio:  isAudio ?? false,
      audioDur: isAudio ? (media?.durationSec ?? 0) : null,
    }

    // Capture history BEFORE adding the new user message
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'agent')
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, text: m.text }))

    setMessages(p => [...p, userMsg])
    setLoading(true)
    setError(null)

    try {
      // ── Build business snapshot ───────────────────────────────────────────
      const { tasks = [], deals = [], leads = [], students = [] } = businessData
      const today = new Date().toISOString().split('T')[0]

      const openTasks = tasks
        .filter(t => !t.completed)
        .sort((a, b) => {
          const da = a.dueDate || a.due_date || '9999'
          const db = b.dueDate || b.due_date || '9999'
          return da < db ? -1 : 1
        })
        .slice(0, 20)
        .map(t => {
          const contact = contacts.find(c => c.id === (t.contactId || t.contact_id))
          return {
            title:       t.title,
            dueDate:     t.dueDate || t.due_date || null,
            contactName: contact?.name ?? null,
            priority:    t.priority ?? 'medium',
          }
        })

      const recentLeads = leads.slice(0, 10).map(l => ({
        name:   l.name,
        phone:  l.phone  || null,
        source: l.source || null,
        stage:  l.leadStage || l.lead_stage || null,
      }))

      const activeDeals = deals
        .filter(d => d.stage !== 'closed' && d.stage !== 'lost')
        .slice(0, 10)
        .map(d => {
          const contact = contacts.find(c => c.id === (d.contactId || d.contact_id))
          return {
            title:       d.title,
            value:       d.value ?? 0,
            stage:       d.stage,
            contactName: contact?.name ?? null,
          }
        })

      const businessSnapshot = {
        stats: {
          contactsTotal: contacts.length,
          leadsCount:    leads.length,
          studentsCount: students.length,
          dealsTotal:    deals.filter(d => d.stage !== 'closed').length,
        },
        openTasks,
        recentLeads,
        activeDeals,
      }

      // ── Build request body ────────────────────────────────────────────────
      const body = {
        message: text.trim(),
        model,
        context: {
          contacts:    contacts.slice(0, 100).map(c => ({ id: c.id, name: c.name, phone: c.phone || null })),
          instructors: instructors.map(i => ({ id: i.id, name: i.name, programs: i.programs || [] })),
        },
        history,
        businessSnapshot,
      }

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
  }, [loading, messages])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, send, clear }
}
