import { useState, useCallback } from 'react'
import {
  fetchStudents, createStudent, updateStudent, deleteStudent,
} from '../services/studentsService'

export function useStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setStudents(await fetchStudents()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addStudent = useCallback(async data => {
    const row = await createStudent(data)
    setStudents(p => [row, ...p])
    return row
  }, [])

  const editStudent = useCallback(async (id, data) => {
    setStudents(p => p.map(s => s.id === id ? { ...s, ...data } : s))
    await updateStudent(id, data)
  }, [])

  const removeStudent = useCallback(async id => {
    setStudents(p => p.filter(s => s.id !== id))
    await deleteStudent(id)
  }, [])

  return { students, setStudents, loading, error, load, addStudent, editStudent, removeStudent }
}
