import { useState, useCallback } from 'react'
import {
  fetchPayments, createPayment, updatePayment, deletePayment,
} from '../services/paymentsService'
import {
  fetchSalaries, createSalary, updateSalary, deleteSalary, autoGenerateSalaries,
} from '../services/salariesService'

export function useFinance() {
  const now = new Date()
  const [payments, setPayments] = useState([])
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading]   = useState(false)
  const [month, setMonth]       = useState(now.getMonth() + 1)
  const [year, setYear]         = useState(now.getFullYear())

  const load = useCallback(async (m, y) => {
    const n          = new Date()
    const targetMonth = m ?? (n.getMonth() + 1)
    const targetYear  = y ?? n.getFullYear()
    setLoading(true)
    try {
      const [p, s] = await Promise.all([
        fetchPayments(targetMonth, targetYear),
        fetchSalaries(targetMonth, targetYear),
      ])
      setPayments(p)
      setSalaries(s)
    } catch (e) {
      console.error('[useFinance] load error:', e?.message ?? e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Payments CRUD
  const addPayment = useCallback(async data => {
    const row = await createPayment(data)
    setPayments(p => [row, ...p])
    return row
  }, [])

  const editPayment = useCallback(async (id, data) => {
    await updatePayment(id, data)
    setPayments(p => p.map(x => x.id === id ? { ...x, ...data } : x))
  }, [])

  const removePayment = useCallback(async id => {
    await deletePayment(id)
    setPayments(p => p.filter(x => x.id !== id))
  }, [])

  // Salaries CRUD
  const addSalary = useCallback(async data => {
    const row = await createSalary(data)
    setSalaries(p => [row, ...p])
    return row
  }, [])

  const editSalary = useCallback(async (id, data) => {
    const net = (Number(data.baseSalary) || 0) + (Number(data.additions) || 0)
              - (Number(data.deductions) || 0) - (Number(data.tax) || 0)
              - (Number(data.nationalInsurance) || 0) - (Number(data.healthInsurance) || 0)
    await updateSalary(id, data)
    setSalaries(p => p.map(x => x.id === id ? { ...x, ...data, netSalary: net } : x))
  }, [])

  const removeSalary = useCallback(async id => {
    await deleteSalary(id)
    setSalaries(p => p.filter(x => x.id !== id))
  }, [])

  const autoGenerate = useCallback(async (instructors, m, y) => {
    setLoading(true)
    try {
      await autoGenerateSalaries(instructors, m, y)
      setSalaries(await fetchSalaries(m, y))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    payments, setPayments,
    salaries, setSalaries,
    loading,
    month, setMonth,
    year,  setYear,
    load,
    addPayment, editPayment, removePayment,
    addSalary, editSalary, removeSalary,
    autoGenerate,
  }
}
