import { useState, useCallback, useEffect } from 'react'
import { fetchActivities, createActivity } from '../services/activitiesService'

export function useActivities(contactId) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!contactId) return
    setLoading(true)
    fetchActivities(contactId)
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contactId])

  const add = useCallback(async (data) => {
    const row = await createActivity({ ...data, contactId })
    setActivities(p => [row, ...p])
    return row
  }, [contactId])

  return { activities, loading, add }
}
