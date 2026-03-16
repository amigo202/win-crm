import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { studentStatus, attPct, monthlyHours, monthlyPay, noSessionDays } from '../utils/alerts'

// Max history turns to send (keeps token usage manageable)
const MAX_HISTORY = 10

export function useAgent() {
  const [messages, setMessages] = useState([])  // { id, role, text, actions?, blocks? }
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
   * @param businessData   { tasks, deals, leads, students, classes, finance, activities }
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
      const {
        tasks = [], deals = [], leads = [], students = [],
        classes = [], finance = null, activities = [],
      } = businessData

      const today = new Date().toISOString().split('T')[0]
      const now = new Date()
      const curMonth = now.getMonth() + 1
      const curYear  = now.getFullYear()
      const prevMonth = curMonth === 1 ? 12 : curMonth - 1
      const prevYear  = curMonth === 1 ? curYear - 1 : curYear

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

      // ── Calculate business insights ──────────────────────────────────────
      const overdueTaskCount = openTasks.filter(t => t.dueDate && t.dueDate < today).length
      const hotLeads = leads.filter(l => {
        const stage = l.leadStage || l.lead_stage || ''
        return stage === 'new' || stage === 'contacted'
      }).length
      const totalPipelineValue = deals
        .filter(d => d.stage !== 'closed' && d.stage !== 'lost')
        .reduce((sum, d) => sum + (d.value || 0), 0)
      const staleLeads = leads.filter(l => {
        const lastTouch = l.lastTouchAt || l.last_touch_at || l.lastActivityAt || l.last_activity_at
        if (!lastTouch) return true
        const daysSince = Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86400000)
        return daysSince > 7
      }).length

      // ── v3: Financial snapshot ─────────────────────────────────────────
      const calcMonthFinancials = (m, y) => {
        const classInc = classes
          .filter(c => Number(c.month) === m && Number(c.year) === y)
          .reduce((sum, c) => {
            const actual = Number(c.actual_income) || 0
            const calc = (Number(c.students_count) || 0) * (Number(c.price_per_student) || 0)
            return sum + (actual || calc || Number(c.agreed_price) || 0)
          }, 0)
        const classExp = classes
          .filter(c => Number(c.month) === m && Number(c.year) === y)
          .reduce((sum, c) => sum + (
            Number(c.instructor_total_override) ||
            (Number(c.instructor_price_per_session || 0) * Number(c.sessions_count || 4))
          ), 0)
        const actInc = activities
          .filter(a => Number(a.month) === m && Number(a.year) === y)
          .reduce((sum, a) => sum + (Number(a.income) || 0), 0)
        const actExp = activities
          .filter(a => Number(a.month) === m && Number(a.year) === y)
          .reduce((sum, a) => sum + (Number(a.expenses) || 0), 0)
        return {
          income:   classInc + actInc,
          expenses: classExp + actExp,
          profit:   (classInc + actInc) - (classExp + actExp),
        }
      }

      const financialSnapshot = (classes.length > 0 || activities.length > 0) ? {
        currentMonth:  calcMonthFinancials(curMonth, curYear),
        previousMonth: calcMonthFinancials(prevMonth, prevYear),
      } : undefined

      // ── v3: Class snapshot ─────────────────────────────────────────────
      const classSnapshot = classes
        .filter(c => Number(c.month) === curMonth && Number(c.year) === curYear)
        .map(c => {
          const income = Number(c.actual_income) ||
            (Number(c.students_count) || 0) * (Number(c.price_per_student) || 0) ||
            Number(c.agreed_price) || 0
          const instructorCost = Number(c.instructor_total_override) ||
            (Number(c.instructor_price_per_session || 0) * Number(c.sessions_count || 4))
          return {
            name:           c.class_name || c.subject || 'ללא שם',
            type:           c.activity_type || 'חוג',
            studentsCount:  Number(c.students_count) || 0,
            income,
            instructorCost,
            profit:         income - instructorCost,
          }
        })
        .sort((a, b) => b.income - a.income)
        .slice(0, 15)

      // ── v3: Student alerts ─────────────────────────────────────────────
      const studentAlerts = students
        .map(s => ({
          name:   s.name,
          status: studentStatus(s),
          attPct: attPct(s),
        }))
        .filter(s => s.status === 'risk' || s.status === 'warn')
        .slice(0, 15)

      // ── v3: Instructor snapshot ────────────────────────────────────────
      const instructorSnapshot = instructors.map(inst => ({
        name:         inst.name,
        monthlyHours: monthlyHours(inst),
        monthlyPay:   monthlyPay(inst),
        inactive:     noSessionDays(inst, 14),
      }))

      // ── Build complete snapshot ────────────────────────────────────────
      const businessSnapshot = {
        stats: {
          contactsTotal:    contacts.length,
          leadsCount:       leads.length,
          studentsCount:    students.length,
          dealsTotal:       deals.filter(d => d.stage !== 'closed').length,
          overdueTaskCount,
          hotLeads,
          staleLeads,
          totalPipelineValue,
        },
        openTasks,
        recentLeads,
        activeDeals,
        role: 'business_advisor',
        // v3 enriched data
        financialSnapshot,
        classSnapshot:      classSnapshot.length > 0 ? classSnapshot : undefined,
        studentAlerts:      studentAlerts.length > 0 ? studentAlerts : undefined,
        instructorSnapshot: instructorSnapshot.length > 0 ? instructorSnapshot : undefined,
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
        blocks:  result.blocks ?? [],
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
