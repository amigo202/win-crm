import { useState, useCallback } from 'react'
import {
  fetchLeads, createLead, updateLead,
  updateLeadStage, deleteLead, bulkSetAtRisk,
} from '../services/leadsService'

const RISK_DAYS = 7

export function useLeads() {
  const [leads, setLeads]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await fetchLeads()

      // ── Auto-compute at_risk ────────────────────────────────────
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - RISK_DAYS)

      const nowAtRisk   = data.filter(l =>
        !['won','lost'].includes(l.leadStage) &&
        l.lastActivityAt &&
        new Date(l.lastActivityAt) < cutoff &&
        !l.atRisk
      ).map(l => l.id)

      const nowRecovered = data.filter(l =>
        l.atRisk && l.lastActivityAt && new Date(l.lastActivityAt) >= cutoff
      ).map(l => l.id)

      // Persist changes silently (don't block UI)
      if (nowAtRisk.length || nowRecovered.length)
        bulkSetAtRisk(nowAtRisk, nowRecovered).catch(() => {})

      setLeads(data.map(l => ({
        ...l,
        atRisk: nowAtRisk.includes(l.id) ? true
              : nowRecovered.includes(l.id) ? false
              : l.atRisk,
      })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const addLead = useCallback(async data => {
    const row = await createLead(data)
    setLeads(p => [row, ...p])
    return row
  }, [])

  const editLead = useCallback(async (id, data) => {
    setLeads(p => p.map(l => l.id === id ? { ...l, ...data } : l))
    await updateLead(id, data)
  }, [])

  const moveStage = useCallback(async (id, newStage) => {
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.leadStage === newStage) return

    // Optimistic update
    setLeads(p => p.map(l => l.id === id ? { ...l, leadStage: newStage } : l))

    try {
      await updateLeadStage(id, newStage, lead.leadStage, lead.name)
    } catch (e) {
      // Roll back
      setLeads(p => p.map(l => l.id === id ? { ...l, leadStage: lead.leadStage } : l))
      throw e
    }
  }, [leads])

  const removeLead = useCallback(async id => {
    setLeads(p => p.filter(l => l.id !== id))
    await deleteLead(id)
  }, [])

  return { leads, setLeads, loading, error, load, addLead, editLead, moveStage, removeLead }
}
