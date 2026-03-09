import { useState, useCallback } from 'react'
import {
  fetchRules, createRule, updateRule, deleteRule, toggleRule,
} from '../services/workflowService'

export function useWorkflows() {
  const [rules, setRules]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRules(await fetchRules()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addRule = useCallback(async data => {
    const row = await createRule(data)
    setRules(p => [row, ...p])
    return row
  }, [])

  const editRule = useCallback(async (id, data) => {
    setRules(p => p.map(r => r.id === id ? { ...r, ...data } : r))
    await updateRule(id, data)
  }, [])

  const removeRule = useCallback(async id => {
    setRules(p => p.filter(r => r.id !== id))
    await deleteRule(id)
  }, [])

  const toggle = useCallback(async (id, enabled) => {
    setRules(p => p.map(r => r.id === id ? { ...r, enabled } : r))
    await toggleRule(id, enabled)
  }, [])

  return { rules, setRules, loading, error, load, addRule, editRule, removeRule, toggle }
}
