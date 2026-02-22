import { useState, useCallback } from 'react'
import { fetchDeals, createDeal, updateDeal, deleteDeal } from '../services/dealsService'

export function useDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setDeals(await fetchDeals()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addDeal = useCallback(async data => {
    const row = await createDeal(data)
    setDeals(p => [row, ...p])
    return row
  }, [])

  const editDeal = useCallback(async (id, data) => {
    setDeals(p => p.map(d => d.id === id ? { ...d, ...data } : d))
    await updateDeal(id, data)
  }, [])

  const removeDeal = useCallback(async id => {
    setDeals(p => p.filter(d => d.id !== id))
    await deleteDeal(id)
  }, [])

  return { deals, setDeals, loading, error, load, addDeal, editDeal, removeDeal }
}
