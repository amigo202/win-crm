import { useState, useCallback } from 'react'
import {
  fetchInstructors, createInstructor, updateInstructor, deleteInstructor,
} from '../services/instructorsService'

export function useInstructors() {
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setInstructors(await fetchInstructors()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addInstructor = useCallback(async data => {
    const row = await createInstructor(data)
    setInstructors(p => [row, ...p])
    return row
  }, [])

  const editInstructor = useCallback(async (id, data) => {
    setInstructors(p => p.map(i => i.id === id ? { ...i, ...data } : i))
    await updateInstructor(id, data)
  }, [])

  const removeInstructor = useCallback(async id => {
    setInstructors(p => p.filter(i => i.id !== id))
    await deleteInstructor(id)
  }, [])

  return { instructors, setInstructors, loading, error, load, addInstructor, editInstructor, removeInstructor }
}
