import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as svc from '../services/taxRadarService'

// ── Seed data — נתוני 2025 אמיתיים (ינואר–אוגוסט) ──────────────────────────
const SEED_2025 = [
  { year:2025, month:1,  income:45000,  payroll:0, subcontractors:5000,  professional_services:3000,  software:2000, marketing:2500, vehicle:2000, office:1000, other:3000, notes:'ינואר 2025' },
  { year:2025, month:2,  income:78000,  payroll:0, subcontractors:6000,  professional_services:2000,  software:2000, marketing:3000, vehicle:2000, office:1000, other:3500, notes:'פברואר חזק במיוחד' },
  { year:2025, month:3,  income:40000,  payroll:0, subcontractors:5000,  professional_services:47242, software:2000, marketing:2500, vehicle:2000, office:1000, other:2258, notes:'הפסד — שירותים מקצועיים 47,242 ₪' },
  { year:2025, month:4,  income:52000,  payroll:0, subcontractors:4000,  professional_services:2500,  software:2000, marketing:3000, vehicle:2000, office:1000, other:3000, notes:'אפריל 2025' },
  { year:2025, month:5,  income:55000,  payroll:0, subcontractors:5000,  professional_services:2500,  software:2000, marketing:3000, vehicle:2000, office:1000, other:2500, notes:'מאי 2025' },
  { year:2025, month:6,  income:60000,  payroll:0, subcontractors:5500,  professional_services:2500,  software:2000, marketing:3500, vehicle:2000, office:1000, other:2500, notes:'יוני 2025' },
  { year:2025, month:7,  income:45000,  payroll:0, subcontractors:4000,  professional_services:2000,  software:2000, marketing:2500, vehicle:2000, office:1000, other:1000, notes:'יולי – כמעט איזון' },
  { year:2025, month:8,  income:17466,  payroll:0, subcontractors:1500,  professional_services:1000,  software:1000, marketing:500,  vehicle:1000, office:500,  other:459,  notes:'אוגוסט חלש' },
]

// ── Local computation (mirrors Supabase GENERATED columns) ───────────────────
function calcExpenses(m) {
  return (m.payroll||0) + (m.subcontractors||0) + (m.professional_services||0) +
         (m.software||0) + (m.marketing||0) + (m.vehicle||0) + (m.office||0) + (m.other||0)
}
function hydrate(raw) {
  return raw.map(m => ({
    ...m,
    total_expenses: calcExpenses(m),
    net_profit: (m.income||0) - calcExpenses(m),
  }))
}

// ── localStorage keys & helpers ──────────────────────────────────────────────
const LS_MONTHS   = 'taxradar_months'
const LS_PAYMENTS = 'taxradar_tax_payments'
const LS_SETTINGS = 'taxradar_settings'

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function stripComputed(m) {
  // eslint-disable-next-line no-unused-vars
  const { total_expenses, net_profit, id, user_id, created_at, updated_at, is_closed, ...rest } = m
  return rest
}

// ── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { taxRate: 35, bankBalance: 0, monthlyCommitments: 0 }

// ═════════════════════════════════════════════════════════════════════════════
export function useTaxRadar() {
  const [months,   setMonths]   = useState([])
  const [payments, setPayments] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading,  setLoading]  = useState(true)
  const [synced,   setSynced]   = useState(false)   // true = loaded from Supabase
  const settingsYearRef         = useRef(new Date().getFullYear())

  // ── Load all data ──────────────────────────────────────────────────────────
  const load = useCallback(async (year) => {
    setLoading(true)
    const yr = year || settingsYearRef.current

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not_authenticated')

      const [ms, ps, cfg] = await Promise.all([
        svc.fetchMonths(),
        svc.fetchPayments(),
        svc.fetchSettings(yr),
      ])

      // If Supabase is empty, seed from SEED_2025 (first run)
      if (ms.length === 0) {
        const localMs = lsGet(LS_MONTHS, null)
        setMonths(localMs ? hydrate(localMs) : hydrate(SEED_2025))
      } else {
        // monthFromDb already computes total_expenses & net_profit
        setMonths(ms)
      }

      setPayments(ps)
      setSettings(cfg)
      setSynced(true)
    } catch (err) {
      // ── Fallback: localStorage ──
      const localMs = lsGet(LS_MONTHS, null)
      setMonths(localMs ? hydrate(localMs) : hydrate(SEED_2025))
      setPayments(lsGet(LS_PAYMENTS, []))
      setSettings(lsGet(LS_SETTINGS, DEFAULT_SETTINGS))
      setSynced(false)
      if (err.message !== 'not_authenticated') {
        console.warn('[TaxRadar] Supabase unavailable — using localStorage', err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load settings when year changes (e.g., switching year in UI)
  const loadSettingsForYear = useCallback(async (year) => {
    settingsYearRef.current = year
    if (!synced) return
    try {
      const cfg = await svc.fetchSettings(year)
      setSettings(cfg)
    } catch { /* keep current */ }
  }, [synced])

  useEffect(() => { load() }, [load])

  // ── Persist to localStorage as backup whenever state changes ─────────────
  useEffect(() => {
    if (months.length > 0) lsSet(LS_MONTHS, months.map(stripComputed))
  }, [months])
  useEffect(() => {
    lsSet(LS_PAYMENTS, payments)
  }, [payments])
  useEffect(() => {
    lsSet(LS_SETTINGS, settings)
  }, [settings])

  // ── CRUD — months ─────────────────────────────────────────────────────────
  const upsertMonth = useCallback(async (data) => {
    // 1. Optimistic update (instant UI)
    const hydrated = hydrate([data])[0]
    setMonths(prev => {
      const idx = prev.findIndex(m => m.year === data.year && m.month === data.month)
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...hydrated }; return n }
      return [...prev, hydrated]
    })

    // 2. Persist to Supabase (non-blocking)
    if (synced) {
      svc.upsertMonth(data).then(row => {
        // Update with server-returned row (has correct id, timestamps)
        setMonths(prev => {
          const idx = prev.findIndex(m => m.year === row.year && m.month === row.month)
          if (idx >= 0) { const n = [...prev]; n[idx] = row; return n }
          return prev
        })
      }).catch(err => console.error('[TaxRadar] upsertMonth:', err))
    }
  }, [synced])

  const deleteMonth = useCallback(async (year, month) => {
    // Optimistic
    setMonths(prev => prev.filter(m => !(m.year === year && m.month === month)))

    if (synced) {
      svc.deleteMonth(year, month).catch(err => console.error('[TaxRadar] deleteMonth:', err))
    }
  }, [synced])

  // ── CRUD — payments ────────────────────────────────────────────────────────
  const addPayment = useCallback(async (data) => {
    // Optimistic with temp id
    const temp = { ...data, id: `temp_${Date.now()}`, created_at: new Date().toISOString() }
    setPayments(prev => [...prev, temp])

    if (synced) {
      svc.addPayment(data).then(row => {
        // Replace temp with real row
        setPayments(prev => prev.map(p => p.id === temp.id ? row : p))
      }).catch(err => {
        console.error('[TaxRadar] addPayment:', err)
        // Keep temp entry (it's in localStorage anyway)
      })
    }
  }, [synced])

  const removePayment = useCallback(async (id) => {
    setPayments(prev => prev.filter(p => p.id !== id))

    if (synced && !String(id).startsWith('temp_')) {
      svc.removePayment(id).catch(err => console.error('[TaxRadar] removePayment:', err))
    }
  }, [synced])

  // ── Settings ──────────────────────────────────────────────────────────────
  const updateSettings = useCallback(async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)

    if (synced) {
      svc.saveSettings(settingsYearRef.current, next)
        .catch(err => console.error('[TaxRadar] saveSettings:', err))
    }
  }, [settings, synced])

  // ── Analytics (same logic as before, year-filtered) ───────────────────────
  const analytics = useCallback((year = 2025) => {
    const yr = months.filter(m => m.year === year).sort((a, b) => a.month - b.month)
    const totalIncome   = yr.reduce((s, m) => s + (m.income        || 0), 0)
    const totalExpenses = yr.reduce((s, m) => s + (m.total_expenses || 0), 0)
    const totalProfit   = yr.reduce((s, m) => s + (m.net_profit     || 0), 0)

    const monthCount            = yr.length || 1
    const projectedAnnualProfit = (totalProfit / monthCount) * 12

    const taxRate            = settings.taxRate / 100
    const estimatedTaxTotal  = projectedAnnualProfit * taxRate
    const paidToDate         = payments.filter(p => p.year === year).reduce((s, p) => s + (p.amount || 0), 0)
    const missingReserve     = Math.max(0, estimatedTaxTotal - paidToDate)
    const monthsLeft         = Math.max(1, 12 - monthCount)
    const monthlyReserve     = missingReserve / monthsLeft

    let riskLevel = 'low'
    if      (projectedAnnualProfit > 550000) riskLevel = 'critical'
    else if (projectedAnnualProfit > 400000) riskLevel = 'high'
    else if (projectedAnnualProfit > 250000) riskLevel = 'medium'

    const realMoney = settings.bankBalance - missingReserve - settings.monthlyCommitments

    const alerts = generateAlerts(yr, totalProfit, projectedAnnualProfit, missingReserve, monthCount)

    return {
      months: yr,
      totalIncome,
      totalExpenses,
      totalProfit,
      projectedAnnualProfit,
      estimatedTaxTotal,
      paidToDate,
      missingReserve,
      monthlyReserve,
      riskLevel,
      realMoney,
      alerts,
      taxRate: settings.taxRate,
    }
  }, [months, payments, settings])

  return {
    months,
    payments,
    settings,
    loading,
    synced,
    load,
    loadSettingsForYear,
    upsertMonth,
    deleteMonth,
    addPayment,
    removePayment,
    updateSettings,
    analytics,
  }
}

// ── Alert generator ───────────────────────────────────────────────────────────
function generateAlerts(months, totalProfit, projected, missingReserve, monthCount) {
  const alerts = []
  const now = new Date()
  const daysToYearEnd = Math.ceil((new Date(now.getFullYear(), 11, 31) - now) / 86400000)

  if (missingReserve > 20000) {
    alerts.push({
      id: 'missing-reserve', severity: 'red',
      title: 'חסר בקופת המס',
      message: `לפי הקצב הנוכחי, חסרים לך ${fmt(missingReserve)} ₪ בקופת המס. שים בצד ${fmt(missingReserve / Math.max(1, 12 - monthCount))} ₪ בחודש.`,
    })
  }

  if (totalProfit > 200000) {
    alerts.push({
      id: 'high-profit', severity: 'orange',
      title: 'רווח מצטבר חצה 200,000 ₪',
      message: 'הרווח המצטבר עבר 200,000 ₪. כדאי לבדוק הפקדות לקרן השתלמות ופנסיה לפני סוף שנה.',
    })
  }

  const avgIncome = months.reduce((s, m) => s + m.income, 0) / (months.length || 1)
  months.forEach(m => {
    if (m.net_profit < -10000) {
      alerts.push({
        id: `loss-${m.month}`, severity: 'red',
        title: `הפסד בחודש ${MONTH_HE[m.month - 1]}`,
        message: `${MONTH_HE[m.month - 1]} הסתיים בהפסד של ${fmt(Math.abs(m.net_profit))} ₪. ${m.notes || ''}`,
      })
    } else if (m.income < avgIncome * 0.4 && m.income > 0) {
      alerts.push({
        id: `weak-${m.month}`, severity: 'orange',
        title: `חודש חלש — ${MONTH_HE[m.month - 1]}`,
        message: `הכנסות ${MONTH_HE[m.month - 1]} (${fmt(m.income)} ₪) חריגות כלפי מטה. בדוק אם יש הכנסות שטרם נרשמו.`,
      })
    }
    if (m.professional_services > 40000) {
      alerts.push({
        id: `big-prof-${m.month}`, severity: 'orange',
        title: `שירותים מקצועיים גדולים — ${MONTH_HE[m.month - 1]}`,
        message: `שירותים מקצועיים קפצו ל-${fmt(m.professional_services)} ₪ ב${MONTH_HE[m.month - 1]}. לסמן כהוצאה חד-פעמית?`,
      })
    }
  })

  if (daysToYearEnd <= 60) {
    alerts.push({
      id: 'year-end', severity: 'orange',
      title: `נותרו ${daysToYearEnd} יום לסוף שנה`,
      message: 'זמן לבדוק: קרן השתלמות, פנסיה, הוצאות חסרות, ציוד, חשבוניות ספקים.',
    })
  }

  return alerts
}

const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const fmt = n => Math.round(n).toLocaleString('he-IL')
