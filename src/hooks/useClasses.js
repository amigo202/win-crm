import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useClasses() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*, instructors(name)')
      .order('created_at', { ascending: false })
    if (error) console.error('[useClasses] load error:', error.message)
    setClasses(data || [])
    setLoading(false)
  }, [])

  const addClass = async data => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: row } = await supabase
      .from('classes')
      .insert({ ...data, owner_id: user.id })
      .select('*, instructors(name)')
      .single()
    if (row) setClasses(p => [row, ...p])
    return row
  }

  const editClass = async (id, data) => {
    const { data: row } = await supabase
      .from('classes')
      .update(data)
      .eq('id', id)
      .select('*, instructors(name)')
      .single()
    if (row) setClasses(p => p.map(c => c.id === id ? row : c))
  }

  const removeClass = async id => {
    await supabase.from('classes').delete().eq('id', id)
    setClasses(p => p.filter(c => c.id !== id))
  }

  return { classes, setClasses, loading, load, addClass, editClass, removeClass }
}
