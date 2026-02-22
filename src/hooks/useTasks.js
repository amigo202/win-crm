import { useState, useCallback } from 'react'
import {
  fetchTasks, createTask, updateTask, deleteTask,
  toggleTask as toggleTaskService,
} from '../services/tasksService'

export function useTasks() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setTasks(await fetchTasks()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addTask = useCallback(async data => {
    const row = await createTask(data)
    setTasks(p => [row, ...p])
    return row
  }, [])

  const editTask = useCallback(async (id, data) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, ...data } : t))
    await updateTask(id, data)
  }, [])

  const removeTask = useCallback(async id => {
    setTasks(p => p.filter(t => t.id !== id))
    await deleteTask(id)
  }, [])

  const toggleTask = useCallback(async id => {
    const t = tasks.find(x => x.id === id)
    if (!t) return t
    const done = !t.completed
    setTasks(p => p.map(x => x.id === id ? { ...x, completed: done } : x))
    await toggleTaskService(id, done)
    return { ...t, completed: done }
  }, [tasks])

  return { tasks, setTasks, loading, error, load, addTask, editTask, removeTask, toggleTask }
}
