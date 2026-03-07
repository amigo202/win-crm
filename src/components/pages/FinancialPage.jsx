import { useState, useEffect, useMemo } from 'react'
import { PROGRAMS, PAY_STATUS } from '../../constants'
import { fmtShekel } from '../../utils/format'
import { monthlyPay } from '../../utils/alerts'
import { Ico } from '../icons/Ico'
import { toast_ok, toast_err } from '../Toast'

// ── Shared constants ───────────────────────────────────────────────
const MONTHS = [
  { v: 1, l: 'ינואר' }, { v: 2, l: 'פברואר' }, { v: 3, l: 'מרץ' },
  { v: 4, l: 'אפריל' }, { v: 5, l: 'מאי' }, { v: 6, l: 'יוני' },
  { v: 7, l: 'יולי' }, { v: 8, l: 'אוגוסט' }, { v: 9, l: 'ספטמבר' },
  { v: 10, l: 'אוקטובר' }, { v: 11, l: 'נובמבר' }, { v: 12, l: 'דצמבר' },
]
const CY = new Date().getFullYear()
const YEARS = [CY - 2, CY - 1, CY, CY + 1, CY + 2]

const BIZ_ACT_TYPES = [
  { id: 'pixmix',     label: 'PIXMIX',  icon: '🎨', color: '#8b5cf6' },
  { id: 'video',      label: 'סרטון',    icon: '🎬', color: '#ef4444' },
  { id: 'content',    label: 'תוכן',     icon: '📝', color: '#3b82f6' },
  { id: 'lecture',    label: 'הרצאה',    icon: '🎤', color: '#f59e0b' },
  { id: 'consulting', label: 'ייעוץ',    icon: '💡', color: '#10b981' },
  { id: 'other',      label: 'אחר',      icon: '📦', color: '#64748b' },
]
const PAY_STATUSES = [
  { id: 'pending', label: 'ממתין',  color: '#f59e0b', bg: '#fef3c7' },
  { id: 'paid',    label: 'שולם',   color: '#10b981', bg: '#d1fae5' },
  { id: 'partial', label: 'חלקי',   color: '#f97316', bg: '#ffedd5' },
  { id: 'overdue', label: 'באיחור', color: '#ef4444', bg: '#fee2e2' },
]
const PAY_METHODS = ['מזומן','שיק','העברה','כרטיס אשראי','ביט','פייבוקס','אחר']
const CLASS_TYPES = { 'חוג': 'חוגים', 'קורס': 'קורסים', 'סדנה': 'סדנאות', 'מחנה': 'מחנות', 'אירוע': 'אירועים', 'הרצאה': 'הרצאות' }

const INP = { padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', direction:'rtl', width:'100%', boxSizing:'border-box', background:'var(--bg)', color:'var(--text)' }
const LBL = { display:'block', fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:4 }
const GRP = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }

function fmt(n) { return Number(n || 0).toLocaleString('he-IL') }

// ── Zebra row style helper ───────────────────────────────────────
const zebraRow = (i) => ({
  background: i % 2 === 0 ? 'transparent' : 'var(--bg)',
  transition: 'background .15s',
})

// ── CSV export helper ────────────────────────────────────────────
function exportCSV(filename, headers, rows) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

// ── Trend arrow component ────────────────────────────────────────
function Trend({ current, previous, reverse }) {
  if (!previous) return null
  const diff = current - previous
  const pct = previous !== 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0)
  if (pct === 0) return <span style={{ fontSize:11, color:'var(--muted)' }}>— ללא שינוי</span>
  const up = diff > 0
  const good = reverse ? !up : up
  return (
    <span style={{ fontSize:11, fontWeight:600, color: good ? '#10b981' : '#ef4444', display:'inline-flex', alignItems:'center', gap:2 }}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  )
}

// ── Progress bar component ───────────────────────────────────────
function ProgressBar({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ width:'100%' }}>
      {label && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:600 }}>{Math.round(pct)}%</span>
      </div>}
      <div style={{ height:10, background:'var(--border)', borderRadius:5, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: color || '#f97316', borderRadius:5, transition:'width .5s ease' }}/>
      </div>
    </div>
  )
}

// ── PaymentModal ──────────────────────────────────────────────────
function PaymentModal({ data, fin, contacts, instructors, onClose }) {
  const isE = !!data
  const [form, setForm] = useState(() => data
    ? { ...data }
    : { contactId: '', instructorId: '', amount: '', month: fin.month, year: fin.year, status: 'pending', program: '', notes: '' }
  )
  const [saveErr, setSaveErr] = useState(null)
  const [saving, setSaving]   = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const amountNum = Number(form.amount)
  const isValid   = amountNum > 0

  const save = async () => {
    if (!isValid || saving) return
    setSaveErr(null); setSaving(true)
    const payload = {
      contactId: form.contactId || null, instructorId: form.instructorId || null,
      amount: amountNum, month: Number(form.month), year: Number(form.year),
      status: form.status || 'pending', program: form.program || null, notes: form.notes || null,
    }
    try {
      isE ? await fin.editPayment(data.id, payload) : await fin.addPayment(payload)
      onClose()
    } catch (e) { setSaveErr(e?.message ?? 'שגיאה בשמירה') } finally { setSaving(false) }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="mh"><h3>{isE ? 'עריכת תשלום' : 'תשלום חדש'}</h3><button className="mx" onClick={onClose}>×</button></div>
        <div className="mb">
          <div className="fg">
            <div className="frow full"><label>איש קשר</label><select value={form.contactId} onChange={f('contactId')}><option value="">בחר איש קשר</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="frow full"><label>תוכנית</label><select value={form.program} onChange={f('program')}><option value="">בחר תוכנית</option>{PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="frow full"><label>מדריך</label><select value={form.instructorId} onChange={f('instructorId')}><option value="">בחר מדריך</option>{instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
            <div className="frow"><label>סכום (₪) *</label><input type="number" value={form.amount} onChange={f('amount')} placeholder="0" min="0" style={!isValid && form.amount !== '' ? { borderColor: 'var(--danger)' } : {}}/>{!isValid && form.amount !== '' && <span style={{ color:'var(--danger)', fontSize:11, marginTop:2 }}>הסכום חייב להיות גדול מ-0</span>}{!isValid && form.amount === '' && <span style={{ color:'var(--muted)', fontSize:11, marginTop:2 }}>שדה חובה</span>}</div>
            <div className="frow"><label>סטטוס</label><select value={form.status} onChange={f('status')}>{PAY_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div className="frow"><label>חודש</label><select value={form.month} onChange={f('month')}>{MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
            <div className="frow"><label>שנה</label><select value={form.year} onChange={f('year')}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
            <div className="frow full"><label>הערות</label><input value={form.notes || ''} onChange={f('notes')} placeholder="הערות..."/></div>
          </div>
          {saveErr && <div style={{ marginTop:10, padding:'8px 12px', background:'#fee2e2', color:'#991b1b', borderRadius:7, fontSize:13, direction:'rtl' }}>⚠️ {saveErr}</div>}
        </div>
        <div className="mf">
          <button className="btn btn-p" onClick={save} disabled={!isValid || saving} style={{ opacity: !isValid || saving ? 0.5 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}>{saving ? 'שומר...' : isE ? 'שמור' : 'הוסף'}</button>
          <button className="btn btn-o" onClick={onClose} disabled={saving}>ביטול</button>
          {isE && <button className="del-link" disabled={saving} onClick={async () => { if (window.confirm('למחוק תשלום זה?')) { await fin.removePayment(data.id); onClose() } }}>מחק</button>}
        </div>
      </div>
    </div>
  )
}

// ── SalaryModal ───────────────────────────────────────────────────
function SalaryModal({ data, fin, instructors, onClose }) {
  const isE = !!data
  const [form, setForm] = useState(() => data
    ? { ...data }
    : { instructorId: '', month: fin.month, year: fin.year, baseSalary: '', additions: 0, deductions: 0, tax: 0, nationalInsurance: 0, healthInsurance: 0, notes: '' }
  )
  const [saveErr, setSaveErr] = useState(null)
  const [saving, setSaving]   = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const selectedInst = instructors.find(i => i.id === form.instructorId)
  const suggested    = selectedInst ? monthlyPay(selectedInst) : 0
  const net = (Number(form.baseSalary)||0) + (Number(form.additions)||0) - (Number(form.deductions)||0) - (Number(form.tax)||0) - (Number(form.nationalInsurance)||0) - (Number(form.healthInsurance)||0)
  const isValid = !!form.instructorId

  const save = async () => {
    if (!isValid || saving) return
    setSaveErr(null); setSaving(true)
    const payload = {
      instructorId: form.instructorId, month: Number(form.month), year: Number(form.year),
      baseSalary: Number(form.baseSalary)||0, additions: Number(form.additions)||0,
      deductions: Number(form.deductions)||0, tax: Number(form.tax)||0,
      nationalInsurance: Number(form.nationalInsurance)||0, healthInsurance: Number(form.healthInsurance)||0,
      notes: form.notes || null,
    }
    try {
      isE ? await fin.editSalary(data.id, payload) : await fin.addSalary(payload)
      onClose()
    } catch (e) { setSaveErr(e?.message ?? 'שגיאה בשמירה') } finally { setSaving(false) }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="mh"><h3>{isE ? 'עריכת שכר' : 'שכר חדש'}</h3><button className="mx" onClick={onClose}>×</button></div>
        <div className="mb">
          <div className="fg">
            <div className="frow full"><label>מדריך *</label><select value={form.instructorId} onChange={f('instructorId')}><option value="">בחר מדריך</option>{instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
            {selectedInst && suggested > 0 && <div className="frow full"><div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--accent)' }}>💡 לפי שיעורי החודש: {fmtShekel(suggested)} <button className="btn btn-o btn-sm" onClick={() => setForm(p => ({ ...p, baseSalary: suggested }))}>חשב מסשנים</button></div></div>}
            <div className="frow"><label>שכר בסיס (₪)</label><input type="number" value={form.baseSalary} onChange={f('baseSalary')} placeholder="0" min="0"/></div>
            <div className="frow"><label>תוספות (₪)</label><input type="number" value={form.additions} onChange={f('additions')} placeholder="0" min="0"/></div>
            <div className="frow"><label>ניכויים (₪)</label><input type="number" value={form.deductions} onChange={f('deductions')} placeholder="0" min="0"/></div>
            <div className="frow"><label>מס הכנסה (₪)</label><input type="number" value={form.tax} onChange={f('tax')} placeholder="0" min="0"/></div>
            <div className="frow"><label>ביטוח לאומי (₪)</label><input type="number" value={form.nationalInsurance} onChange={f('nationalInsurance')} placeholder="0" min="0"/></div>
            <div className="frow"><label>ביטוח בריאות (₪)</label><input type="number" value={form.healthInsurance} onChange={f('healthInsurance')} placeholder="0" min="0"/></div>
            <div className="frow full"><label>הערות</label><input value={form.notes || ''} onChange={f('notes')} placeholder="הערות..."/></div>
          </div>
          <div style={{ marginTop:16, padding:'14px 0 2px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600, color:'var(--muted)' }}>שכר נטו (חישוב):</span>
            <span style={{ fontWeight:800, fontSize:20, color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtShekel(net)}</span>
          </div>
        </div>
        {saveErr && <div style={{ margin:'10px 0 0', padding:'8px 12px', background:'#fee2e2', color:'#991b1b', borderRadius:7, fontSize:13, direction:'rtl' }}>⚠️ {saveErr}</div>}
        <div className="mf">
          <button className="btn btn-p" onClick={save} disabled={!isValid || saving} style={{ opacity: !isValid || saving ? 0.5 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}>{saving ? 'שומר...' : isE ? 'שמור' : 'הוסף'}</button>
          {!isValid && <span style={{ fontSize:12, color:'var(--danger)', alignSelf:'center' }}>יש לבחור מדריך</span>}
          <button className="btn btn-o" onClick={onClose} disabled={saving}>ביטול</button>
          {isE && <button className="del-link" disabled={saving} onClick={async () => { if (window.confirm('למחוק רשומת שכר זו?')) { await fin.removeSalary(data.id); onClose() } }}>מחק</button>}
        </div>
      </div>
    </div>
  )
}

// ── Activity modal ────────────────────────────────────────────────
function emptyActivity() {
  return {
    name: '', activityType: 'pixmix', contactId: '', contactName: '',
    activityDate: '', month: new Date().getMonth() + 1, year: CY,
    income: '', expenses: '',
    paymentStatus: 'pending', paymentDate: '', paymentMethod: '', invoiceNumber: '',
    notes: '',
  }
}

// ── Main Component ────────────────────────────────────────────────
export default function FinancialPage({
  fin, instructors, contacts, activities, classes,
  onAddActivity, onUpdateActivity, onDeleteActivity, onReloadActivities,
}) {
  const [tab, setTab]     = useState('income')
  const [modal, setModal] = useState(null)

  // Activities state
  const [actModal, setActModal] = useState(false)
  const [actEditId, setActEditId] = useState(null)
  const [actForm, setActForm]     = useState(emptyActivity())
  const [actFilterType, setActFilterType] = useState('all')
  const [actFilterYear, setActFilterYear] = useState(CY)
  const [actSearch, setActSearch] = useState('')
  const [actFormError, setActFormError] = useState('')

  useEffect(() => { fin.load(fin.month, fin.year) }, [fin.month, fin.year]) // eslint-disable-line

  const instName = id => instructors.find(i => i.id === id)?.name || '–'
  const contName = id => contacts.find(c => c.id === id)?.name || '–'

  // ── Classes income for selected month ──────────────────────
  const classData = useMemo(() => {
    const m = fin.month, y = fin.year
    return (classes || []).filter(c => Number(c.month) === m && Number(c.year) === y).map(c => {
      const students_n = Number(c.students_count) || 0
      const pps = Number(c.price_per_student) || 0
      const agreed = Number(c.agreed_price) || 0
      const actual = Number(c.actual_income) || 0
      const income = actual || (students_n * pps) || agreed
      const instrCost = Number(c.instructor_total_override) || (Number(c.instructor_price_per_session || 0) * Number(c.monthly_hours || 4))
      return { ...c, _income: income, _expense: instrCost }
    })
  }, [classes, fin.month, fin.year])

  const classIncomeTotal  = classData.reduce((s, c) => s + c._income, 0)
  const classExpenseTotal = classData.reduce((s, c) => s + c._expense, 0)

  // ── Previous month data (for trends) ──────────────────────
  const prevMonthData = useMemo(() => {
    const pm = fin.month === 1 ? 12 : fin.month - 1
    const py = fin.month === 1 ? fin.year - 1 : fin.year
    const prevClasses = (classes || []).filter(c => Number(c.month) === pm && Number(c.year) === py).map(c => {
      const students_n = Number(c.students_count) || 0
      const pps = Number(c.price_per_student) || 0
      const agreed = Number(c.agreed_price) || 0
      const actual = Number(c.actual_income) || 0
      const income = actual || (students_n * pps) || agreed
      const instrCost = Number(c.instructor_total_override) || (Number(c.instructor_price_per_session || 0) * Number(c.monthly_hours || 4))
      return { _income: income, _expense: instrCost }
    })
    const prevActs = (activities || []).filter(a => a.month === pm && a.year === py)
    return {
      classIncome: prevClasses.reduce((s, c) => s + c._income, 0),
      classExpense: prevClasses.reduce((s, c) => s + c._expense, 0),
      actIncome: prevActs.reduce((s, a) => s + (a.income || 0), 0),
      actExpense: prevActs.reduce((s, a) => s + (a.expenses || 0), 0),
    }
  }, [classes, activities, fin.month, fin.year])

  // ── Year-to-date totals ───────────────────────────────────
  const ytdData = useMemo(() => {
    const y = fin.year
    const ytdClasses = (classes || []).filter(c => Number(c.year) === y && Number(c.month) <= fin.month).map(c => {
      const students_n = Number(c.students_count) || 0
      const pps = Number(c.price_per_student) || 0
      const agreed = Number(c.agreed_price) || 0
      const actual = Number(c.actual_income) || 0
      const income = actual || (students_n * pps) || agreed
      const instrCost = Number(c.instructor_total_override) || (Number(c.instructor_price_per_session || 0) * Number(c.monthly_hours || 4))
      return { _income: income, _expense: instrCost }
    })
    const ytdActs = (activities || []).filter(a => a.year === y && a.month <= fin.month)
    return {
      classIncome: ytdClasses.reduce((s, c) => s + c._income, 0),
      classExpense: ytdClasses.reduce((s, c) => s + c._expense, 0),
      actIncome: ytdActs.reduce((s, a) => s + (a.income || 0), 0),
      actExpense: ytdActs.reduce((s, a) => s + (a.expenses || 0), 0),
      classCount: ytdClasses.length,
      actCount: ytdActs.length,
    }
  }, [classes, activities, fin.month, fin.year])

  // ── Activities for selected month ─────────────────────────
  const monthActivities = useMemo(() =>
    (activities || []).filter(a => a.month === fin.month && a.year === fin.year),
    [activities, fin.month, fin.year]
  )
  const actIncomeTotal  = monthActivities.reduce((s, a) => s + (a.income || 0), 0)
  const actExpenseTotal = monthActivities.reduce((s, a) => s + (a.expenses || 0), 0)

  // ── Finance data ──────────────────────────────────────────
  const paymentTotal   = fin.payments.reduce((s, p) => s + p.amount, 0)
  const salaryTotal    = fin.salaries.reduce((s, x) => s + x.netSalary, 0)

  // ── Grand totals ──────────────────────────────────────────
  const grandIncome  = classIncomeTotal + actIncomeTotal + paymentTotal
  const grandExpense = classExpenseTotal + actExpenseTotal + salaryTotal
  const grandProfit  = grandIncome - grandExpense

  // ── Previous month grand totals (partial — no payment/salary data) ──
  const prevGrandIncome  = prevMonthData.classIncome + prevMonthData.actIncome
  const prevGrandExpense = prevMonthData.classExpense + prevMonthData.actExpense

  // ── Activities tab: filtered list ─────────────────────────
  const actFiltered = useMemo(() => {
    let list = activities || []
    if (actFilterType !== 'all') list = list.filter(a => a.activityType === actFilterType)
    if (actFilterYear) list = list.filter(a => a.year === actFilterYear)
    if (actSearch) {
      const q = actSearch.toLowerCase()
      list = list.filter(a => (a.name||'').toLowerCase().includes(q) || (a.contactName||'').toLowerCase().includes(q) || (a.notes||'').toLowerCase().includes(q))
    }
    return list
  }, [activities, actFilterType, actFilterYear, actSearch])

  const actTotals = useMemo(() => {
    const inc = actFiltered.reduce((s, a) => s + a.income, 0)
    const exp = actFiltered.reduce((s, a) => s + a.expenses, 0)
    return { income: inc, expenses: exp, profit: inc - exp }
  }, [actFiltered])

  // ── Activity form handlers ────────────────────────────────
  const openNewAct = () => { setActEditId(null); setActForm(emptyActivity()); setActModal(true) }
  const openEditAct = a => {
    setActEditId(a.id)
    setActForm({ name: a.name, activityType: a.activityType, contactId: a.contactId || '', contactName: a.contactName || '', activityDate: a.activityDate || '', month: a.month || (new Date().getMonth()+1), year: a.year || CY, income: a.income || '', expenses: a.expenses || '', paymentStatus: a.paymentStatus || 'pending', paymentDate: a.paymentDate || '', paymentMethod: a.paymentMethod || '', invoiceNumber: a.invoiceNumber || '', notes: a.notes || '' })
    setActModal(true)
  }
  const closeAct = () => { setActModal(false); setActEditId(null); setActForm(emptyActivity()); setActFormError('') }
  const handleActContactChange = e => { const cid = e.target.value; const c = contacts.find(x => x.id === cid); setActForm(f => ({ ...f, contactId: cid, contactName: c?.name || '' })) }
  const saveAct = async () => {
    if (!actForm.name.trim()) { setActFormError('נא למלא שם פעילות'); return }
    setActFormError('')
    try {
      if (actEditId) { await onUpdateActivity(actEditId, actForm); toast_ok('הפעילות עודכנה') }
      else { await onAddActivity(actForm); toast_ok('פעילות נוספה') }
      closeAct()
    } catch (e) { toast_err('שגיאה: ' + e.message) }
  }
  const deleteAct = async id => {
    if (!window.confirm('למחוק פעילות?')) return
    try { await onDeleteActivity(id); toast_ok('הפעילות נמחקה') } catch (e) { toast_err('שגיאה: ' + e.message) }
  }
  const getTypeMeta = id => BIZ_ACT_TYPES.find(t => t.id === id) || BIZ_ACT_TYPES[5]
  const getPayMeta  = id => PAY_STATUSES.find(s => s.id === id) || PAY_STATUSES[0]
  const actProfitCalc = Number(actForm.income || 0) - Number(actForm.expenses || 0)

  // ── CSV export handlers ───────────────────────────────────
  const exportIncome = () => {
    const mName = MONTHS.find(m => m.v === fin.month)?.l || ''
    const rows = []
    classData.forEach(c => rows.push(['חוג', c.name || c.activity_type, CLASS_TYPES[c.activity_type] || c.activity_type, c.students_count || 0, c._income]))
    monthActivities.forEach(a => rows.push(['פעילות', a.name, getTypeMeta(a.activityType).label, '', a.income || 0]))
    fin.payments.forEach(p => rows.push(['תשלום', contName(p.contactId), p.program || '', '', p.amount]))
    exportCSV(`income_${mName}_${fin.year}.csv`, ['מקור','שם','סוג/תוכנית','תלמידים','סכום'], rows)
    toast_ok('קובץ הכנסות יוצא בהצלחה')
  }
  const exportExpenses = () => {
    const mName = MONTHS.find(m => m.v === fin.month)?.l || ''
    const rows = []
    fin.salaries.forEach(s => rows.push(['משכורת', instName(s.instructorId), s.baseSalary, s.additions, s.deductions, s.tax, s.nationalInsurance, s.healthInsurance, s.netSalary]))
    exportCSV(`expenses_${mName}_${fin.year}.csv`, ['סוג','מדריך','בסיס','תוספות','ניכויים','מס','בט"ל','בריאות','נטו'], rows)
    toast_ok('קובץ הוצאות יוצא בהצלחה')
  }

  // ── Source breakdown for report ───────────────────────────
  const sourceBreakdown = useMemo(() => {
    const sources = [
      { label: 'חוגים וקורסים', icon: '🏫', amount: classIncomeTotal, color: '#8b5cf6' },
      { label: 'פעילויות עסקיות', icon: '🎯', amount: actIncomeTotal, color: '#f97316' },
      { label: 'תשלומים ישירים', icon: '💳', amount: paymentTotal, color: '#3b82f6' },
    ]
    const total = sources.reduce((s, x) => s + x.amount, 0)
    return sources.map(s => ({ ...s, pct: total > 0 ? Math.round((s.amount / total) * 100) : 0 }))
  }, [classIncomeTotal, actIncomeTotal, paymentTotal])

  const expenseBreakdown = useMemo(() => {
    const sources = [
      { label: 'משכורות', icon: '💰', amount: salaryTotal, color: '#ef4444' },
      { label: 'הוצאות פעילויות', icon: '🎯', amount: actExpenseTotal, color: '#f97316' },
      { label: 'עלויות מדריכים', icon: '🏫', amount: classExpenseTotal, color: '#8b5cf6' },
    ]
    const total = sources.reduce((s, x) => s + x.amount, 0)
    return sources.map(s => ({ ...s, pct: total > 0 ? Math.round((s.amount / total) * 100) : 0 }))
  }, [salaryTotal, actExpenseTotal, classExpenseTotal])

  // ── Render ────────────────────────────────────────────────
  const mName = MONTHS.find(m => m.v === fin.month)?.l || ''

  return (
    <>
      <div className="ph">
        <h2>פיננסים</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* CSV export button */}
          <button className="btn btn-o btn-sm" onClick={tab === 'expenses' ? exportExpenses : exportIncome} title="ייצוא CSV" style={{ fontSize:12 }}>
            📥 ייצוא CSV
          </button>
          <select value={fin.month} onChange={e => fin.setMonth(Number(e.target.value))} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={fin.year} onChange={e => fin.setYear(Number(e.target.value))} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI Cards with trends ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, padding: '18px 30px 0' }}>
        <div className="stat-card" style={{ background: '#d1fae5', border: '1px solid #10b98122' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <span style={{ fontSize:24 }}>💰</span>
            <div style={{ textAlign:'left' }}>
              <span style={{ fontSize:26, fontWeight:700, color:'#10b981', lineHeight:1 }}>{fmtShekel(grandIncome)}</span>
              <div style={{ marginTop:4 }}><Trend current={classIncomeTotal + actIncomeTotal} previous={prevGrandIncome}/></div>
            </div>
          </div>
          <div style={{ fontWeight:700, fontSize:13, color:'#10b981', marginTop:6 }}>הכנסות</div>
          <div style={{ fontSize:11, color:'#10b981', opacity:.7, marginTop:3 }}>חוגים + פעילויות + תשלומים</div>
        </div>
        <div className="stat-card" style={{ background: '#fee2e2', border: '1px solid #ef444422' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <span style={{ fontSize:24 }}>📉</span>
            <div style={{ textAlign:'left' }}>
              <span style={{ fontSize:26, fontWeight:700, color:'#ef4444', lineHeight:1 }}>{fmtShekel(grandExpense)}</span>
              <div style={{ marginTop:4 }}><Trend current={classExpenseTotal + actExpenseTotal} previous={prevGrandExpense} reverse/></div>
            </div>
          </div>
          <div style={{ fontWeight:700, fontSize:13, color:'#ef4444', marginTop:6 }}>הוצאות</div>
          <div style={{ fontSize:11, color:'#ef4444', opacity:.7, marginTop:3 }}>משכורות + הוצאות פעילויות + מדריכים</div>
        </div>
        <div className="stat-card" style={{ background: grandProfit >= 0 ? '#dbeafe' : '#fee2e2', border: `1px solid ${grandProfit >= 0 ? '#3b82f6' : '#ef4444'}22` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <span style={{ fontSize:24 }}>📊</span>
            <span style={{ fontSize:26, fontWeight:700, color: grandProfit >= 0 ? '#3b82f6' : '#ef4444', lineHeight:1 }}>{fmtShekel(grandProfit)}</span>
          </div>
          <div style={{ fontWeight:700, fontSize:13, color: grandProfit >= 0 ? '#3b82f6' : '#ef4444', marginTop:6 }}>רווח</div>
          <div style={{ fontSize:11, color: grandProfit >= 0 ? '#3b82f6' : '#ef4444', opacity:.7, marginTop:3 }}>
            {grandExpense > 0 ? `מרווחיות: ${Math.round((grandProfit / grandIncome) * 100) || 0}%` : 'הכנסות - הוצאות'}
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div style={{ padding: '16px 30px 0' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'income' ? 'on' : ''}`} onClick={() => setTab('income')}>💰 הכנסות</button>
          <button className={`tab ${tab === 'expenses' ? 'on' : ''}`} onClick={() => setTab('expenses')}>📉 הוצאות</button>
          <button className={`tab ${tab === 'activities' ? 'on' : ''}`} onClick={() => setTab('activities')}>🎯 פעילויות</button>
          <button className={`tab ${tab === 'report' ? 'on' : ''}`} onClick={() => setTab('report')}>📊 דוח</button>
        </div>
      </div>

      <div className="pb">
        {/* ════════════════════════════════════════════════════ */}
        {/* ── INCOME TAB ───────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'income' && <>
          {/* Classes income */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <strong style={{ fontSize:13 }}>🏫 הכנסות מחוגים/קורסים</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{classData.length} חוגים</span>
              </div>
              <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(classIncomeTotal)}</span>
            </div>
            {classData.length === 0
              ? <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏫</div>
                  אין חוגים לחודש {mName}
                </div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>תוכנית</th><th>מדריך</th><th>תלמידים</th><th>מחיר לתלמיד</th><th>הכנסה</th><th>סטטוס</th></tr></thead>
                <tbody>{classData.map((c, i) => {
                  const paid = c.paid || c.payment_status
                  const payLabel = paid === 'paid' ? 'שולם' : paid === 'partial' ? 'חלקי' : 'ממתין'
                  const payColor = paid === 'paid' ? '#10b981' : paid === 'partial' ? '#f97316' : '#f59e0b'
                  return (
                    <tr key={c.id} style={zebraRow(i)}>
                      <td><strong>{c.name || c.activity_type}</strong></td>
                      <td>{CLASS_TYPES[c.activity_type] || c.activity_type}</td>
                      <td><span style={{ fontSize:11, color:'var(--accent)' }}>{c.program || '–'}</span></td>
                      <td>{c.instructor_name || '–'}</td>
                      <td style={{ textAlign:'center' }}>{c.students_count || 0}</td>
                      <td>{c.price_per_student ? fmtShekel(c.price_per_student) : '–'}</td>
                      <td style={{ color:'#10b981', fontWeight:600 }}>{fmtShekel(c._income)}</td>
                      <td><span className="badge" style={{ background:payColor+'18', color:payColor, fontSize:11 }}>{payLabel}</span></td>
                    </tr>
                  )
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)', fontWeight:700 }}><td colSpan={6}>סה"כ חוגים</td><td style={{ color:'#10b981' }}>{fmtShekel(classIncomeTotal)}</td><td></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Activities income */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <strong style={{ fontSize:13 }}>🎯 הכנסות מפעילויות</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{monthActivities.length} פעילויות</span>
              </div>
              <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(actIncomeTotal)}</span>
            </div>
            {monthActivities.length === 0
              ? <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                  אין פעילויות לחודש {mName}
                </div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>לקוח</th><th>תאריך</th><th>הכנסה</th><th>תשלום</th><th>אמצעי</th></tr></thead>
                <tbody>{monthActivities.map((a, i) => {
                  const tm = getTypeMeta(a.activityType)
                  const pm = getPayMeta(a.paymentStatus)
                  return (
                    <tr key={a.id} style={zebraRow(i)}>
                      <td><strong>{a.name}</strong></td>
                      <td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td>
                      <td>{a.contactName || '—'}</td>
                      <td style={{ fontSize:12 }}>{a.activityDate || '—'}</td>
                      <td style={{ color:'#10b981', fontWeight:600 }}>{fmtShekel(a.income)}</td>
                      <td><span className="badge" style={{ background:pm.bg, color:pm.color, fontSize:11 }}>{pm.label}</span></td>
                      <td style={{ fontSize:12 }}>{a.paymentMethod || '—'}</td>
                    </tr>
                  )
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)', fontWeight:700 }}><td colSpan={4}>סה"כ פעילויות</td><td style={{ color:'#10b981' }}>{fmtShekel(actIncomeTotal)}</td><td colSpan={2}></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Direct payments */}
          <div className="card">
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <strong style={{ fontSize:13 }}>💳 תשלומים ישירים</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{fin.payments.length} תשלומים</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(paymentTotal)}</span>
                <button className="btn btn-p btn-sm" onClick={() => setModal({ type:'payment', data:null })}><Ico.plus/>הוסף תשלום</button>
              </div>
            </div>
            {!fin.payments.length
              ? <div className="empty"><div className="empty-ico">💳</div><p>אין תשלומים לחודש {mName}</p><p style={{ fontSize:12, color:'var(--muted)' }}>לחץ "הוסף תשלום" כדי להוסיף תשלום ישיר</p></div>
              : <div className="tbl-wrap"><table><thead><tr><th>איש קשר</th><th>תוכנית</th><th>מדריך</th><th>סכום</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>{fin.payments.map((p, i) => {
                  const st = PAY_STATUS.find(x => x.value === p.status)
                  return <tr key={p.id} style={zebraRow(i)}><td>{contName(p.contactId)}</td><td>{p.program || '–'}</td><td>{instName(p.instructorId)}</td><td><strong>{fmtShekel(p.amount)}</strong></td><td><span className={`badge ${st?.badge || 'b-gray'}`}>{st?.label || p.status}</span></td><td><div className="ac-cell"><button className="icon-btn" onClick={() => setModal({ type:'payment', data:p })}><Ico.edit/></button><button className="icon-btn" style={{ color:'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק תשלום?')) await fin.removePayment(p.id) }}><Ico.trash/></button></div></td></tr>
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)' }}><td colSpan={3}><strong>סה"כ תשלומים</strong></td><td><strong>{fmtShekel(paymentTotal)}</strong></td><td colSpan={2}></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Grand total */}
          <div style={{ padding:'16px 0', display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#d1fae5', borderRadius:12, padding:'16px 32px', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#065f46', marginBottom:6 }}>סה"כ הכנסות {mName} {fin.year}</div>
              <div style={{ fontSize:32, fontWeight:800, color:'#10b981' }}>{fmtShekel(grandIncome)}</div>
            </div>
          </div>
        </>}

        {/* ════════════════════════════════════════════════════ */}
        {/* ── EXPENSES TAB ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'expenses' && <>
          {/* Salaries */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <strong style={{ fontSize:13 }}>💰 משכורות מדריכים</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{fin.salaries.length} מדריכים</span>
                <button className="btn btn-o btn-sm" onClick={async () => { if (window.confirm('לייצר רשומות שכר לכל המדריכים?')) await fin.autoGenerate(instructors, fin.month, fin.year) }}>⚡ ייצר אוטומטי</button>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(salaryTotal)}</span>
                <button className="btn btn-p btn-sm" onClick={() => setModal({ type:'salary', data:null })}><Ico.plus/>הוסף ידנית</button>
              </div>
            </div>
            {!fin.salaries.length
              ? <div className="empty"><div className="empty-ico">💰</div><p>אין רשומות שכר לחודש {mName}</p><p style={{ fontSize:12, color:'var(--muted)' }}>השתמש ב"ייצר אוטומטי" או "הוסף ידנית"</p></div>
              : <div className="tbl-wrap"><table><thead><tr><th>מדריך</th><th>תעריף/שעה</th><th>בסיס</th><th>תוספות</th><th>ניכויים</th><th>מס</th><th>בט"ל</th><th>בריאות</th><th>נטו</th><th></th></tr></thead>
                <tbody>{fin.salaries.map((s, i) => {
                  const inst = instructors.find(x => x.id === s.instructorId)
                  const hourlyRate = inst?.price_per_session || inst?.hourlyRate || '–'
                  return (
                    <tr key={s.id} style={zebraRow(i)}>
                      <td><strong>{instName(s.instructorId)}</strong></td>
                      <td style={{ fontSize:12, color:'var(--muted)' }}>{hourlyRate !== '–' ? `₪${fmt(hourlyRate)}` : '–'}</td>
                      <td>{fmtShekel(s.baseSalary)}</td>
                      <td>{fmtShekel(s.additions)}</td>
                      <td>{fmtShekel(s.deductions)}</td>
                      <td>{fmtShekel(s.tax)}</td>
                      <td>{fmtShekel(s.nationalInsurance)}</td>
                      <td>{fmtShekel(s.healthInsurance)}</td>
                      <td><strong style={{ color:'var(--success)' }}>{fmtShekel(s.netSalary)}</strong></td>
                      <td><div className="ac-cell"><button className="icon-btn" onClick={() => setModal({ type:'salary', data:s })}><Ico.edit/></button><button className="icon-btn" style={{ color:'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק רשומת שכר?')) await fin.removeSalary(s.id) }}><Ico.trash/></button></div></td>
                    </tr>
                  )
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)' }}><td colSpan={2}><strong>סה"כ משכורות</strong></td><td colSpan={6}></td><td><strong style={{ color:'var(--success)' }}>{fmtShekel(salaryTotal)}</strong></td><td></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Activity expenses */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <strong style={{ fontSize:13 }}>🎯 הוצאות פעילויות</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{monthActivities.filter(a => a.expenses > 0).length} פעילויות</span>
              </div>
              <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(actExpenseTotal)}</span>
            </div>
            {monthActivities.filter(a => a.expenses > 0).length === 0
              ? <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין הוצאות פעילויות לחודש {mName}</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>לקוח</th><th>הוצאות</th></tr></thead>
                <tbody>{monthActivities.filter(a => a.expenses > 0).map((a, i) => {
                  const tm = getTypeMeta(a.activityType)
                  return <tr key={a.id} style={zebraRow(i)}><td><strong>{a.name}</strong></td><td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td><td>{a.contactName || '—'}</td><td style={{ color:'#ef4444', fontWeight:600 }}>{fmtShekel(a.expenses)}</td></tr>
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)', fontWeight:700 }}><td colSpan={3}>סה"כ הוצאות פעילויות</td><td style={{ color:'#ef4444' }}>{fmtShekel(actExpenseTotal)}</td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Class instructor costs */}
          <div className="card">
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <strong style={{ fontSize:13 }}>🏫 עלויות מדריכים בחוגים</strong>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>{classData.filter(c => c._expense > 0).length} חוגים</span>
              </div>
              <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(classExpenseTotal)}</span>
            </div>
            {classData.filter(c => c._expense > 0).length === 0
              ? <div style={{ padding:'20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין עלויות מדריכים לחודש {mName}</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>מדריך</th><th>תעריף/שיעור</th><th>שעות</th><th>עלות</th></tr></thead>
                <tbody>{classData.filter(c => c._expense > 0).map((c, i) => (
                  <tr key={c.id} style={zebraRow(i)}>
                    <td><strong>{c.name || c.activity_type}</strong></td>
                    <td>{c.instructor_name || '–'}</td>
                    <td style={{ fontSize:12 }}>{c.instructor_price_per_session ? fmtShekel(c.instructor_price_per_session) : '–'}</td>
                    <td>{c.monthly_hours || 4}</td>
                    <td style={{ color:'#ef4444', fontWeight:600 }}>{fmtShekel(c._expense)}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr style={{ background:'var(--bg)', fontWeight:700 }}><td colSpan={4}>סה"כ עלויות מדריכים</td><td style={{ color:'#ef4444' }}>{fmtShekel(classExpenseTotal)}</td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Grand total */}
          <div style={{ padding:'16px 0', display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#fee2e2', borderRadius:12, padding:'16px 32px', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#991b1b', marginBottom:6 }}>סה"כ הוצאות {mName} {fin.year}</div>
              <div style={{ fontSize:32, fontWeight:800, color:'#ef4444' }}>{fmtShekel(grandExpense)}</div>
            </div>
          </div>
        </>}

        {/* ════════════════════════════════════════════════════ */}
        {/* ── ACTIVITIES TAB ───────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'activities' && <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-p" onClick={openNewAct}>+ פעילות חדשה</button>
          </div>

          {/* KPI cards */}
          <div className="stats-grid" style={{ marginBottom:16 }}>
            {[
              { label:'הכנסות', val:fmtShekel(actTotals.income), color:'#10b981', bg:'#d1fae5', icon:'💰' },
              { label:'הוצאות', val:fmtShekel(actTotals.expenses), color:'#ef4444', bg:'#fee2e2', icon:'📉' },
              { label:'רווח', val:fmtShekel(actTotals.profit), color: actTotals.profit >= 0 ? '#3b82f6' : '#ef4444', bg: actTotals.profit >= 0 ? '#dbeafe' : '#fee2e2', icon:'📊' },
            ].map((k, i) => (
              <div key={i} className="stat-card" style={{ background:k.bg, border:`1px solid ${k.color}22` }}>
                <div className="sh"><span style={{ fontSize:24 }}>{k.icon}</span><span className="sv" style={{ color:k.color }}>{k.val}</span></div>
                <div className="sl" style={{ color:k.color }}>{k.label}</div>
                <div className="ss" style={{ color:k.color, opacity:.6 }}>{actFiltered.length} פעילויות</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="filter-bar" style={{ border:'none', padding:'0 0 16px' }}>
            <input className="si-input" placeholder="🔍 חיפוש..." value={actSearch} onChange={e => setActSearch(e.target.value)} style={{ maxWidth:200 }}/>
            <select value={actFilterType} onChange={e => setActFilterType(e.target.value)} style={{ fontSize:13 }}>
              <option value="all">כל הסוגים</option>
              {BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select value={actFilterYear} onChange={e => setActFilterYear(Number(e.target.value))} style={{ fontSize:13 }}>
              {[CY, CY-1, CY-2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ fontSize:12, color:'var(--muted)', marginRight:'auto' }}>{actFiltered.length} תוצאות</span>
          </div>

          {/* Table */}
          {actFiltered.length === 0 ? (
            <div className="card" style={{ padding:40, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
              <p style={{ color:'var(--text)', fontSize:15, fontWeight:600 }}>אין פעילויות עדיין</p>
              <p style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>פעילויות כוללות: צילום סרטון, PIXMIX, הרצאות, ייעוץ ועוד</p>
              <button className="btn btn-p" onClick={openNewAct} style={{ marginTop:16 }}>+ הוסף פעילות ראשונה</button>
            </div>
          ) : (
            <div className="card tbl-wrap"><table><thead><tr>
              <th>סוג</th><th>שם פעילות</th><th>לקוח</th><th>תאריך</th><th>חודש</th><th>הכנסה</th><th>הוצאות</th><th>רווח</th><th>תשלום</th><th>אמצעי</th><th>חשבונית</th><th style={{ width:50 }}></th>
            </tr></thead>
            <tbody>{actFiltered.map((a, i) => {
              const tm = getTypeMeta(a.activityType)
              const pm = getPayMeta(a.paymentStatus)
              const profit = a.income - a.expenses
              return (
                <tr key={a.id} style={{ ...zebraRow(i), cursor:'pointer' }} onClick={() => openEditAct(a)}>
                  <td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.contactName || '—'}</td>
                  <td style={{ fontSize:12 }}>{a.activityDate || '—'}</td>
                  <td style={{ fontSize:12 }}>{a.month ? MONTHS.find(m=>m.v===a.month)?.l + ' ' + a.year : '—'}</td>
                  <td style={{ color:'#10b981', fontWeight:600 }}>₪{fmt(a.income)}</td>
                  <td style={{ color:'#ef4444' }}>{a.expenses ? '₪'+fmt(a.expenses) : '—'}</td>
                  <td style={{ fontWeight:700, color: profit >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(profit)}</td>
                  <td><span className="badge" style={{ background:pm.bg, color:pm.color, fontSize:11 }}>{pm.label}</span></td>
                  <td style={{ fontSize:12 }}>{a.paymentMethod || '—'}</td>
                  <td style={{ fontSize:12 }}>{a.invoiceNumber || '—'}</td>
                  <td onClick={e => e.stopPropagation()}><button className="icon-btn" style={{ color:'var(--danger)' }} onClick={() => deleteAct(a.id)} title="מחק">✕</button></td>
                </tr>
              )
            })}</tbody></table></div>
          )}
        </>}

        {/* ════════════════════════════════════════════════════ */}
        {/* ── REPORT TAB ───────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'report' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* ── Income vs Expenses visual ── */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                📊 יחס הכנסות להוצאות — {mName} {fin.year}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                <div>
                  <ProgressBar value={grandIncome} max={Math.max(grandIncome, grandExpense) || 1} color="#10b981" label={`הכנסות: ${fmtShekel(grandIncome)}`}/>
                </div>
                <div>
                  <ProgressBar value={grandExpense} max={Math.max(grandIncome, grandExpense) || 1} color="#ef4444" label={`הוצאות: ${fmtShekel(grandExpense)}`}/>
                </div>
              </div>
              <div style={{ textAlign:'center', padding:'16px', background: grandProfit >= 0 ? '#d1fae522' : '#fee2e222', borderRadius:10, border:`1px solid ${grandProfit >= 0 ? '#10b98133' : '#ef444433'}` }}>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>רווח גולמי</div>
                <div style={{ fontSize:28, fontWeight:800, color: grandProfit >= 0 ? '#10b981' : '#ef4444' }}>{fmtShekel(grandProfit)}</div>
                {grandIncome > 0 && <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>מרווחיות: {Math.round((grandProfit / grandIncome) * 100)}%</div>}
              </div>
            </div>

            {/* ── Source breakdown ── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Income sources */}
              <div className="card" style={{ padding:'20px 24px' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14, color:'#10b981' }}>💰 מקורות הכנסה</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {sourceBreakdown.map((s, i) => (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>{s.icon} {s.label}</span>
                        <span style={{ fontSize:12, fontWeight:600 }}>{fmtShekel(s.amount)} ({s.pct}%)</span>
                      </div>
                      <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:4, transition:'width .5s' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expense sources */}
              <div className="card" style={{ padding:'20px 24px' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:14, color:'#ef4444' }}>📉 מקורות הוצאות</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {expenseBreakdown.map((s, i) => (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>{s.icon} {s.label}</span>
                        <span style={{ fontSize:12, fontWeight:600 }}>{fmtShekel(s.amount)} ({s.pct}%)</span>
                      </div>
                      <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:4, transition:'width .5s' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Detailed breakdown ── */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>📋 פירוט הכנסות</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}><span>🏫</span><span style={{ fontSize:12 }}>הכנסות מחוגים ({classData.length} חוגים)</span></div>
                  <strong>{fmtShekel(classIncomeTotal)}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}><span>🎯</span><span style={{ fontSize:12 }}>הכנסות מפעילויות ({monthActivities.length} פעילויות)</span></div>
                  <strong>{fmtShekel(actIncomeTotal)}</strong>
                </div>
                {PAY_STATUS.map(st => {
                  const items = fin.payments.filter(p => p.status === st.value)
                  const total = items.reduce((s, p) => s + p.amount, 0)
                  if (!items.length) return null
                  return (
                    <div key={st.value} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>{items.length} תשלומים</span>
                      </div>
                      <strong>{fmtShekel(total)}</strong>
                    </div>
                  )
                })}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 14px', borderTop:'2px solid var(--border)', fontWeight:700, fontSize:15 }}>
                  <span>סה"כ הכנסות</span>
                  <span style={{ color:'var(--success)' }}>{fmtShekel(grandIncome)}</span>
                </div>
              </div>
            </div>

            {/* ── Expense breakdown ── */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>📋 פירוט הוצאות</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {fin.salaries.map(s => (
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                    <span style={{ fontWeight:500 }}>💰 {instName(s.instructorId)}</span>
                    <strong style={{ color:'var(--danger)' }}>{fmtShekel(s.netSalary)}</strong>
                  </div>
                ))}
                {actExpenseTotal > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                    <span style={{ fontWeight:500 }}>🎯 הוצאות פעילויות</span>
                    <strong style={{ color:'var(--danger)' }}>{fmtShekel(actExpenseTotal)}</strong>
                  </div>
                )}
                {classExpenseTotal > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:8 }}>
                    <span style={{ fontWeight:500 }}>🏫 עלויות מדריכים בחוגים</span>
                    <strong style={{ color:'var(--danger)' }}>{fmtShekel(classExpenseTotal)}</strong>
                  </div>
                )}
                {!fin.salaries.length && !actExpenseTotal && !classExpenseTotal && <div style={{ color:'var(--muted)', fontSize:13 }}>אין הוצאות לחודש זה</div>}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 14px', borderTop:'2px solid var(--border)', fontWeight:700, fontSize:15 }}>
                  <span>סה"כ הוצאות</span>
                  <span style={{ color:'var(--danger)' }}>{fmtShekel(grandExpense)}</span>
                </div>
              </div>
            </div>

            {/* ── Year-to-date ── */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>📅 מצטבר שנתי ({fin.year}) — ינואר עד {mName}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                <div style={{ background:'#d1fae5', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#065f46', fontWeight:600, marginBottom:4 }}>הכנסות חוגים</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#10b981' }}>{fmtShekel(ytdData.classIncome)}</div>
                  <div style={{ fontSize:11, color:'#065f46', marginTop:4 }}>{ytdData.classCount} חוגים</div>
                </div>
                <div style={{ background:'#ffedd5', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#9a3412', fontWeight:600, marginBottom:4 }}>הכנסות פעילויות</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#f97316' }}>{fmtShekel(ytdData.actIncome)}</div>
                  <div style={{ fontSize:11, color:'#9a3412', marginTop:4 }}>{ytdData.actCount} פעילויות</div>
                </div>
                <div style={{ background:'#fee2e2', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#991b1b', fontWeight:600, marginBottom:4 }}>הוצאות חוגים</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#ef4444' }}>{fmtShekel(ytdData.classExpense)}</div>
                </div>
                <div style={{ background:'#fef3c7', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#92400e', fontWeight:600, marginBottom:4 }}>הוצאות פעילויות</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#f59e0b' }}>{fmtShekel(ytdData.actExpense)}</div>
                </div>
              </div>
              <div style={{ marginTop:16, textAlign:'center', padding:'14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>רווח מצטבר (חוגים + פעילויות)</div>
                <div style={{ fontSize:24, fontWeight:800, color: (ytdData.classIncome + ytdData.actIncome - ytdData.classExpense - ytdData.actExpense) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtShekel(ytdData.classIncome + ytdData.actIncome - ytdData.classExpense - ytdData.actExpense)}
                </div>
              </div>
            </div>

            {/* ── Month comparison ── */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>📈 השוואה לחודש הקודם</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, textAlign:'center' }}>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>הכנסות (חוגים + פעילויות)</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#10b981' }}>{fmtShekel(classIncomeTotal + actIncomeTotal)}</div>
                  <div style={{ marginTop:6 }}><Trend current={classIncomeTotal + actIncomeTotal} previous={prevGrandIncome}/></div>
                  {prevGrandIncome > 0 && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>חודש קודם: {fmtShekel(prevGrandIncome)}</div>}
                </div>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>הוצאות (חוגים + פעילויות)</div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#ef4444' }}>{fmtShekel(classExpenseTotal + actExpenseTotal)}</div>
                  <div style={{ marginTop:6 }}><Trend current={classExpenseTotal + actExpenseTotal} previous={prevGrandExpense} reverse/></div>
                  {prevGrandExpense > 0 && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>חודש קודם: {fmtShekel(prevGrandExpense)}</div>}
                </div>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>רווח</div>
                  <div style={{ fontSize:18, fontWeight:700, color: (classIncomeTotal + actIncomeTotal - classExpenseTotal - actExpenseTotal) >= 0 ? '#3b82f6' : '#ef4444' }}>
                    {fmtShekel(classIncomeTotal + actIncomeTotal - classExpenseTotal - actExpenseTotal)}
                  </div>
                  <div style={{ marginTop:6 }}>
                    <Trend current={classIncomeTotal + actIncomeTotal - classExpenseTotal - actExpenseTotal} previous={prevGrandIncome - prevGrandExpense}/>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:10, fontSize:11, color:'var(--muted)', textAlign:'center' }}>* ההשוואה מבוססת על נתוני חוגים ופעילויות בלבד (ללא תשלומים ישירים/משכורות)</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Finance modals ────────────────────────────────── */}
      {modal?.type === 'payment' && <PaymentModal data={modal.data} fin={fin} contacts={contacts} instructors={instructors} onClose={() => setModal(null)}/>}
      {modal?.type === 'salary' && <SalaryModal data={modal.data} fin={fin} instructors={instructors} onClose={() => setModal(null)}/>}

      {/* ── Activity modal ────────────────────────────────── */}
      {actModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeAct()}>
          <div className="modal modal-lg" style={{ direction:'rtl' }}>
            <div className="mh"><h3>{actEditId ? 'עריכת פעילות' : 'פעילות חדשה'}</h3><button className="mx" onClick={closeAct}>×</button></div>
            <div className="mb" style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              {actFormError && <div role="alert" style={{ background:'#fee2e2', color:'#dc2626', padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:600 }}>✕ {actFormError}</div>}
              <div style={{ borderBottom:'2px solid var(--accent)', paddingBottom:6, fontSize:13, fontWeight:700, color:'var(--accent)' }}>📋 פרטי פעילות</div>
              <div style={GRP}>
                <div style={{ gridColumn:'1/-1' }}><label style={LBL}>שם הפעילות *</label><input value={actForm.name} onChange={e => { setActForm(f => ({ ...f, name: e.target.value })); setActFormError('') }} placeholder='למשל: "אירוע PIXMIX חנוכה"' style={{ ...INP, borderColor: actFormError && !actForm.name.trim() ? '#ef4444' : undefined }}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>סוג</label><select value={actForm.activityType} onChange={e => setActForm(f => ({ ...f, activityType: e.target.value }))} style={INP}>{BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}</select></div>
                <div><label style={LBL}>לקוח</label><select value={actForm.contactId} onChange={handleActContactChange} style={INP}><option value="">— ללא —</option>{(contacts || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>תאריך פעילות</label><input type="date" value={actForm.activityDate} onChange={e => setActForm(f => ({ ...f, activityDate: e.target.value }))} style={INP}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div><label style={LBL}>חודש</label><select value={actForm.month} onChange={e => setActForm(f => ({ ...f, month: Number(e.target.value) }))} style={INP}>{MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
                  <div><label style={LBL}>שנה</label><select value={actForm.year} onChange={e => setActForm(f => ({ ...f, year: Number(e.target.value) }))} style={INP}>{[CY, CY-1, CY-2].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                </div>
              </div>
              <div style={{ borderBottom:'2px solid #f97316', paddingBottom:6, fontSize:13, fontWeight:700, color:'#f97316' }}>💰 הכנסות והוצאות</div>
              <div style={GRP}>
                <div><label style={LBL}>הכנסה (₪)</label><input type="number" value={actForm.income} onChange={e => setActForm(f => ({ ...f, income: e.target.value }))} placeholder="0" style={INP}/></div>
                <div><label style={LBL}>הוצאות (₪)</label><input type="number" value={actForm.expenses} onChange={e => setActForm(f => ({ ...f, expenses: e.target.value }))} placeholder="0" style={INP}/></div>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:12, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>רווח צפוי:</span>
                <span style={{ fontSize:20, fontWeight:800, color: actProfitCalc >= 0 ? '#10b981' : '#ef4444' }}>{fmtShekel(actProfitCalc)}</span>
              </div>
              <div style={{ borderBottom:'2px solid #3b82f6', paddingBottom:6, fontSize:13, fontWeight:700, color:'#3b82f6' }}>🏦 פרטי תשלום</div>
              <div style={GRP}>
                <div><label style={LBL}>סטטוס תשלום</label><select value={actForm.paymentStatus} onChange={e => setActForm(f => ({ ...f, paymentStatus: e.target.value }))} style={INP}>{PAY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                <div><label style={LBL}>אמצעי תשלום</label><select value={actForm.paymentMethod} onChange={e => setActForm(f => ({ ...f, paymentMethod: e.target.value }))} style={INP}><option value="">—</option>{PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>תאריך תשלום</label><input type="date" value={actForm.paymentDate} onChange={e => setActForm(f => ({ ...f, paymentDate: e.target.value }))} style={INP}/></div>
                <div><label style={LBL}>מס׳ חשבונית</label><input value={actForm.invoiceNumber} onChange={e => setActForm(f => ({ ...f, invoiceNumber: e.target.value }))} style={INP}/></div>
              </div>
              <div><label style={LBL}>הערות</label><textarea value={actForm.notes} onChange={e => setActForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...INP, resize:'vertical' }}/></div>
              <div className="mf">
                <button className="btn btn-p" onClick={saveAct}>{actEditId ? 'שמור' : 'הוסף'}</button>
                <button className="btn btn-o" onClick={closeAct}>ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
