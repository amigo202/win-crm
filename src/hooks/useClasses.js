import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Known DB columns – strip anything else before insert/update to avoid 400
const DB_COLS = new Set([
  'class_name','activity_type','location','city',
  'contact_name','contact_phone','contact_id',
  'coordinator',
  'year','month',
  'day','time_start','subject','grades',
  'groups_count','students_count','sessions_count','session_length',
  'instructor_id','instructor_price_per_session','total_instructor_cost',
  'overhead_pct','monthly_hours',
  'agreed_price','price_per_student','price_per_session',
  'actual_income','payment_date','payment_method','invoice_number',
  'paid','status','responsible','notes',
  'owner_id',
])

function clean(data) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (DB_COLS.has(k) && v !== '' && v !== undefined) out[k] = v
  }
  return out
}

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
    const payload = clean({ ...data, owner_id: user.id })

    let { data: row, error } = await supabase
      .from('classes')
      .insert(payload)
      .select('*, instructors(name)')
      .single()

    // If new columns don't exist yet, retry without them
    if (error && error.code === 'PGRST204' || (error && error.message?.includes('column'))) {
      delete payload.coordinator
      delete payload.overhead_pct
      delete payload.monthly_hours
      const res = await supabase
        .from('classes')
        .insert(payload)
        .select('*, instructors(name)')
        .single()
      row = res.data
      error = res.error
    }

    if (error) throw new Error(error.message)
    if (row) setClasses(p => [row, ...p])
    return row
  }

  const editClass = async (id, data) => {
    const payload = clean(data)
    const { data: row, error } = await supabase
      .from('classes')
      .update(payload)
      .eq('id', id)
      .select('*, instructors(name)')
      .single()
    if (error) throw new Error(error.message)
    if (row) setClasses(p => p.map(c => c.id === id ? row : c))
  }

  const removeClass = async id => {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setClasses(p => p.filter(c => c.id !== id))
  }

  return { classes, setClasses, loading, load, addClass, editClass, removeClass }
}
