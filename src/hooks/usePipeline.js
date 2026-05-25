import { useState, useEffect, useCallback } from 'react'
import * as svc from '../services/pipelineService'

const LS_LINES   = 'pipeline_lines_v2'
const LS_ENTRIES = 'pipeline_entries_v2'

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS_TO_LOAD = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export function usePipeline() {
  const [lines,   setLines]   = useState([])
  const [entries, setEntries] = useState({})  // { lineId: { year: { month: { amount, isPaid } } } }
  const [loading, setLoading] = useState(true)
  const [synced,  setSynced]  = useState(false)

  // ── Load ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rawLines = await svc.fetchLines()
      setLines(rawLines.map(l => ({
        id:        l.id,
        name:      l.name,
        type:      l.line_type,
        hasVat:    l.has_vat,
        sortOrder: l.sort_order,
      })))

      const allEntries = {}
      for (const y of YEARS_TO_LOAD) {
        const raw = await svc.fetchEntries(y)
        raw.forEach(e => {
          if (!allEntries[e.line_id])         allEntries[e.line_id] = {}
          if (!allEntries[e.line_id][e.year]) allEntries[e.line_id][e.year] = {}
          allEntries[e.line_id][e.year][e.month] = {
            amount: Number(e.amount),
            isPaid: e.is_paid,
          }
        })
      }
      setEntries(allEntries)
      setSynced(true)
    } catch (err) {
      console.warn('[Pipeline] Supabase unavailable — localStorage fallback', err.message)
      const ls = localStorage.getItem(LS_LINES)
      const le = localStorage.getItem(LS_ENTRIES)
      if (ls) setLines(JSON.parse(ls))
      if (le) setEntries(JSON.parse(le))
      setSynced(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Backup to localStorage whenever state changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(LS_LINES,   JSON.stringify(lines))
      localStorage.setItem(LS_ENTRIES, JSON.stringify(entries))
    }
  }, [lines, entries, loading])

  // ── Getters ─────────────────────────────────────
  const getEntry = useCallback((lineId, year, month) =>
    entries[lineId]?.[year]?.[month],
  [entries])

  // ── Lines CRUD ──────────────────────────────────
  const addLine = useCallback(async ({ name, type, hasVat }) => {
    const id = genId()
    const newLine = { id, name, type, hasVat, sortOrder: lines.length }
    setLines(prev => [...prev, newLine])
    try {
      await svc.upsertLine({ id, name, line_type: type, has_vat: hasVat, sort_order: lines.length })
    } catch (err) { console.error('[Pipeline] addLine:', err) }
  }, [lines.length])

  const updateLine = useCallback(async (id, changes) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l))
    try {
      const line = lines.find(l => l.id === id)
      if (!line) return
      await svc.upsertLine({
        id,
        name:       changes.name      ?? line.name,
        line_type:  changes.type      ?? line.type,
        has_vat:    changes.hasVat    ?? line.hasVat,
        sort_order: changes.sortOrder ?? line.sortOrder,
      })
    } catch (err) { console.error('[Pipeline] updateLine:', err) }
  }, [lines])

  const deleteLine = useCallback(async (id) => {
    setLines(prev => prev.filter(l => l.id !== id))
    setEntries(prev => { const n = { ...prev }; delete n[id]; return n })
    try { await svc.deleteLine(id) }
    catch (err) { console.error('[Pipeline] deleteLine:', err) }
  }, [])

  const toggleVat = useCallback((id) => {
    const line = lines.find(l => l.id === id)
    if (line) updateLine(id, { hasVat: !line.hasVat })
  }, [lines, updateLine])

  const reorderLines = useCallback((from, to) => {
    setLines(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return arr.map((l, i) => ({ ...l, sortOrder: i }))
    })
  }, [])

  // ── Entries CRUD ────────────────────────────────
  const setEntry = useCallback(async (lineId, year, month, amount, isPaid) => {
    // Optimistic update
    setEntries(prev => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {}),
        [year]: {
          ...((prev[lineId] || {})[year] || {}),
          [month]: { amount, isPaid },
        },
      },
    }))
    try {
      if (amount > 0) {
        await svc.upsertEntry({ line_id: lineId, year, month, amount, is_paid: isPaid })
      } else {
        await svc.deleteEntry(lineId, year, month)
      }
    } catch (err) { console.error('[Pipeline] setEntry:', err) }
  }, [])

  const togglePaid = useCallback((lineId, year, month) => {
    const e = entries[lineId]?.[year]?.[month]
    if (!e?.amount) return
    setEntry(lineId, year, month, e.amount, !e.isPaid)
  }, [entries, setEntry])

  return {
    lines, entries, loading, synced,
    getEntry,
    addLine, updateLine, deleteLine, toggleVat, reorderLines,
    setEntry, togglePaid,
  }
}
