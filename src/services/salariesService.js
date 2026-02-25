import { supabase } from '../lib/supabase'
import { monthlyPay } from '../utils/alerts'

export function fromDbSalary(r) {
  return {
    id:                r.id,
    ownerId:           r.owner_id,
    instructorId:      r.instructor_id,
    month:             r.month,
    year:              r.year,
    baseSalary:        Number(r.base_salary        || 0),
    additions:         Number(r.additions          || 0),
    deductions:        Number(r.deductions         || 0),
    tax:               Number(r.tax                || 0),
    nationalInsurance: Number(r.national_insurance || 0),
    healthInsurance:   Number(r.health_insurance   || 0),
    netSalary:         Number(r.net_salary         || 0),
    notes:             r.notes,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
  }
}

function toDbSalary(s) {
  return {
    instructor_id:      s.instructorId,
    month:              Number(s.month),
    year:               Number(s.year),
    base_salary:        Number(s.baseSalary)        || 0,
    additions:          Number(s.additions)          || 0,
    deductions:         Number(s.deductions)         || 0,
    tax:                Number(s.tax)                || 0,
    national_insurance: Number(s.nationalInsurance)  || 0,
    health_insurance:   Number(s.healthInsurance)    || 0,
    notes:              s.notes                      || null,
  }
}

export async function fetchSalaries(month, year) {
  const { data, error } = await supabase
    .from('salaries')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbSalary)
}

export async function createSalary(data) {
  const { data: row, error } = await supabase
    .from('salaries').insert(toDbSalary(data)).select().single()
  if (error) throw error
  return fromDbSalary(row)
}

export async function updateSalary(id, data) {
  const { error } = await supabase
    .from('salaries').update(toDbSalary(data)).eq('id', id)
  if (error) throw error
}

export async function deleteSalary(id) {
  const { error } = await supabase.from('salaries').delete().eq('id', id)
  if (error) throw error
}

export async function autoGenerateSalaries(instructors, month, year) {
  if (!instructors.length) return []
  const rows = instructors.map(inst => ({
    instructor_id:      inst.id,
    month:              Number(month),
    year:               Number(year),
    base_salary:        monthlyPay(inst),
    additions:          0,
    deductions:         0,
    tax:                0,
    national_insurance: 0,
    health_insurance:   0,
  }))
  const { data, error } = await supabase
    .from('salaries')
    .upsert(rows, { onConflict: 'instructor_id,month,year' })
    .select()
  if (error) throw error
  return data.map(fromDbSalary)
}
