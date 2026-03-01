import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Core columns that 100% exist in DB from original migration
const CORE_COLS = [
  'class_name','activity_type','location','city',
  'contact_name','contact_phone','contact_id',
  'year','month',
  'day','time_start','subject','grades',
  'groups_count','students_count','sessions_count','session_length',
  'instructor_id','instructor_price_per_session','total_instructor_cost',
  'agreed_price','price_per_student','price_per_session',
  'actual_income','payment_date','payment_method','invoice_number',
  'paid','status','responsible','notes',
  'owner_id',
]

// Extra columns added later (might not exist if migration not run)
const EXTRA_COLS = ['coordinator','overhead_pct','monthly_hours','instructor_total_override','linked_payment_id']

function pickCols(data, cols) {
  const out = {}
  for (const k of cols) {
    if (k in data && data[k] !== undefined && data[k] !== null) {
      out[k] = data[k]
    }
  }
  // Remove empty strings for text fields, keep 0 for numbers and false for booleans
  for (const [k, v] of Object.entries(out)) {
    if (v === '' && k !== 'notes') delete out[k]
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
    const raw = { ...data, owner_id: user.id }

    // Try with all columns first (core + extra)
    let payload = pickCols(raw, [...CORE_COLS, ...EXTRA_COLS])
    let { data: row, error } = await supabase
      .from('classes')
      .insert(payload)
      .select('*, instructors(name)')
      .single()

    // If failed (400 = unknown columns), retry with core columns only
    if (error) {
      console.warn('[useClasses] insert failed, retrying with core cols:', error.message)
      payload = pickCols(raw, CORE_COLS)
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
    let payload = pickCols(data, [...CORE_COLS, ...EXTRA_COLS])
    delete payload.owner_id
    let { data: row, error } = await supabase
      .from('classes')
      .update(payload)
      .eq('id', id)
      .select('*, instructors(name)')
      .single()

    if (error) {
      payload = pickCols(data, CORE_COLS)
      delete payload.owner_id
      const res = await supabase
        .from('classes')
        .update(payload)
        .eq('id', id)
        .select('*, instructors(name)')
        .single()
      row = res.data
      error = res.error
    }

    if (error) throw new Error(error.message)
    if (row) setClasses(p => p.map(c => c.id === id ? row : c))
  }

  const removeClass = async id => {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setClasses(p => p.filter(c => c.id !== id))
  }

  // Duplicate a class — copies all fields except id/created_at
  const duplicateClass = async (cls) => {
    const copy = { ...cls }
    delete copy.id
    delete copy.created_at
    delete copy.updated_at
    delete copy.instructors // joined table
    delete copy.linked_payment_id // don't copy finance link
    delete copy.owner_id // will be set by addClass
    return await addClass(copy)
  }

  return { classes, setClasses, loading, load, addClass, editClass, removeClass, duplicateClass }
}
