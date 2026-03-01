import { useState, useCallback } from 'react'
import * as svc from '../services/activitiesService'

export function useActivities() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await svc.fetchActivities()
      setActivities(data)
    } catch (e) {
      console.error('[useActivities] load:', e.message)
    }
    setLoading(false)
  }, [])

  const addActivity = async data => {
    const row = await svc.createActivity(data)
    if (row) setActivities(p => [row, ...p])
    return row
  }

  const editActivity = async (id, data) => {
    const row = await svc.updateActivity(id, data)
    if (row) setActivities(p => p.map(a => a.id === id ? row : a))
    return row
  }

  const removeActivity = async id => {
    await svc.deleteActivity(id)
    setActivities(p => p.filter(a => a.id !== id))
  }

  return { activities, setActivities, loading, load, addActivity, editActivity, removeActivity }
}
