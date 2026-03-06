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

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="ph">
        <h2>פיננסים</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={fin.month} onChange={e => fin.setMonth(Number(e.target.value))} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={fin.year} onChange={e => fin.setYear(Number(e.target.value))} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, padding: '18px 30px 0' }}>
        <div className="stat-card" style={{ background: '#d1fae5', border: '1px solid #10b98122' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <span style={{ fontSize:24 }}>💰</span>
            <span style={{ fontSize:26, fontWeight:700, color:'#10b981', lineHeight:1 }}>{fmtShekel(grandIncome)}</span>
          </div>
          <div style={{ fontWeight:700, fontSize:13, color:'#10b981', marginTop:6 }}>הכנסות</div>
          <div style={{ fontSize:11, color:'#10b981', opacity:.7, marginTop:3 }}>חוגים + פעילויות + תשלומים</div>
        </div>
        <div className="stat-card" style={{ background: '#fee2e2', border: '1px solid #ef444422' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <span style={{ fontSize:24 }}>📉</span>
            <span style={{ fontSize:26, fontWeight:700, color:'#ef4444', lineHeight:1 }}>{fmtShekel(grandExpense)}</span>
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
          <div style={{ fontSize:11, color: grandProfit >= 0 ? '#3b82f6' : '#ef4444', opacity:.7, marginTop:3 }}>הכנסות - הוצאות</div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div style={{ padding: '16px 30px 0' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'income' ? 'on' : ''}`} onClick={() => setTab('income')}>הכנסות</button>
          <button className={`tab ${tab === 'expenses' ? 'on' : ''}`} onClick={() => setTab('expenses')}>הוצאות</button>
          <button className={`tab ${tab === 'activities' ? 'on' : ''}`} onClick={() => setTab('activities')}>פעילויות</button>
          <button className={`tab ${tab === 'report' ? 'on' : ''}`} onClick={() => setTab('report')}>דוח</button>
        </div>
      </div>

      <div className="pb">
        {/* ════════════════════════════════════════════════════ */}
        {/* ── INCOME TAB ───────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'income' && <>
          {/* Classes income (read-only) */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:13 }}>🏫 הכנסות מחוגים/קורסים</strong>
              <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(classIncomeTotal)}</span>
            </div>
            {classData.length === 0
              ? <div style={{ padding:'16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין חוגים לחודש זה</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>תלמידים</th><th>הכנסה</th></tr></thead>
                <tbody>{classData.map(c => (
                  <tr key={c.id}><td><strong>{c.name || c.activity_type}</strong></td><td>{CLASS_TYPES[c.activity_type] || c.activity_type}</td><td>{c.students_count || 0}</td><td style={{ color:'#10b981', fontWeight:600 }}>{fmtShekel(c._income)}</td></tr>
                ))}</tbody></table></div>
            }
          </div>

          {/* Activities income (read-only) */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:13 }}>🎯 הכנסות מפעילויות</strong>
              <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(actIncomeTotal)}</span>
            </div>
            {monthActivities.length === 0
              ? <div style={{ padding:'16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין פעילויות לחודש זה</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>לקוח</th><th>הכנסה</th></tr></thead>
                <tbody>{monthActivities.map(a => {
                  const tm = getTypeMeta(a.activityType)
                  return <tr key={a.id}><td><strong>{a.name}</strong></td><td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td><td>{a.contactName || '—'}</td><td style={{ color:'#10b981', fontWeight:600 }}>{fmtShekel(a.income)}</td></tr>
                })}</tbody></table></div>
            }
          </div>

          {/* Direct payments (editable) */}
          <div className="card">
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:13 }}>💳 תשלומים ישירים</strong>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'#10b981' }}>{fmtShekel(paymentTotal)}</span>
                <button className="btn btn-p btn-sm" onClick={() => setModal({ type:'payment', data:null })}><Ico.plus/>הוסף תשלום</button>
              </div>
            </div>
            {!fin.payments.length
              ? <div className="empty"><div className="empty-ico">💳</div><p>אין תשלומים לחודש זה</p></div>
              : <div className="tbl-wrap"><table><thead><tr><th>איש קשר</th><th>תוכנית</th><th>מדריך</th><th>סכום</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>{fin.payments.map(p => {
                  const st = PAY_STATUS.find(x => x.value === p.status)
                  return <tr key={p.id}><td>{contName(p.contactId)}</td><td>{p.program || '–'}</td><td>{instName(p.instructorId)}</td><td><strong>{fmtShekel(p.amount)}</strong></td><td><span className={`badge ${st?.badge || 'b-gray'}`}>{st?.label || p.status}</span></td><td><div className="ac-cell"><button className="icon-btn" onClick={() => setModal({ type:'payment', data:p })}><Ico.edit/></button><button className="icon-btn" style={{ color:'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק תשלום?')) await fin.removePayment(p.id) }}><Ico.trash/></button></div></td></tr>
                })}</tbody>
                <tfoot><tr style={{ background:'var(--bg)' }}><td colSpan={3}><strong>סה"כ תשלומים</strong></td><td><strong>{fmtShekel(paymentTotal)}</strong></td><td colSpan={2}></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Grand total */}
          <div style={{ padding:'16px 0', display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#d1fae5', borderRadius:12, padding:'16px 32px', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#065f46', marginBottom:6 }}>סה"כ הכנסות החודש</div>
              <div style={{ fontSize:32, fontWeight:800, color:'#10b981' }}>{fmtShekel(grandIncome)}</div>
            </div>
          </div>
        </>}

        {/* ════════════════════════════════════════════════════ */}
        {/* ── EXPENSES TAB ─────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════ */}
        {tab === 'expenses' && <>
          {/* Salaries (editable) */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <strong style={{ fontSize:13 }}>💰 משכורות מדריכים</strong>
                <button className="btn btn-o btn-sm" onClick={async () => { if (window.confirm('לייצר רשומות שכר לכל המדריכים?')) await fin.autoGenerate(instructors, fin.month, fin.year) }}>⚡ ייצר אוטומטי</button>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(salaryTotal)}</span>
                <button className="btn btn-p btn-sm" onClick={() => setModal({ type:'salary', data:null })}><Ico.plus/>הוסף ידנית</button>
              </div>
            </div>
            {!fin.salaries.length
              ? <div className="empty"><div className="empty-ico">💰</div><p>אין רשומות שכר לחודש זה</p></div>
              : <div className="tbl-wrap"><table><thead><tr><th>מדריך</th><th>בסיס</th><th>תוספות</th><th>ניכויים</th><th>מס</th><th>בט"ל</th><th>בריאות</th><th>נטו</th><th></th></tr></thead>
                <tbody>{fin.salaries.map(s => (
                  <tr key={s.id}><td><strong>{instName(s.instructorId)}</strong></td><td>{fmtShekel(s.baseSalary)}</td><td>{fmtShekel(s.additions)}</td><td>{fmtShekel(s.deductions)}</td><td>{fmtShekel(s.tax)}</td><td>{fmtShekel(s.nationalInsurance)}</td><td>{fmtShekel(s.healthInsurance)}</td><td><strong style={{ color:'var(--success)' }}>{fmtShekel(s.netSalary)}</strong></td><td><div className="ac-cell"><button className="icon-btn" onClick={() => setModal({ type:'salary', data:s })}><Ico.edit/></button><button className="icon-btn" style={{ color:'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק רשומת שכר?')) await fin.removeSalary(s.id) }}><Ico.trash/></button></div></td></tr>
                ))}</tbody>
                <tfoot><tr style={{ background:'var(--bg)' }}><td><strong>סה"כ</strong></td><td colSpan={6}></td><td><strong style={{ color:'var(--success)' }}>{fmtShekel(salaryTotal)}</strong></td><td></td></tr></tfoot>
              </table></div>
            }
          </div>

          {/* Activity expenses (read-only) */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:13 }}>🎯 הוצאות פעילויות</strong>
              <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(actExpenseTotal)}</span>
            </div>
            {monthActivities.filter(a => a.expenses > 0).length === 0
              ? <div style={{ padding:'16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין הוצאות פעילויות לחודש זה</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>סוג</th><th>הוצאות</th></tr></thead>
                <tbody>{monthActivities.filter(a => a.expenses > 0).map(a => {
                  const tm = getTypeMeta(a.activityType)
                  return <tr key={a.id}><td><strong>{a.name}</strong></td><td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td><td style={{ color:'#ef4444', fontWeight:600 }}>{fmtShekel(a.expenses)}</td></tr>
                })}</tbody></table></div>
            }
          </div>

          {/* Class instructor costs (read-only) */}
          <div className="card">
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:13 }}>🏫 עלויות מדריכים בחוגים</strong>
              <span style={{ fontWeight:700, color:'#ef4444' }}>{fmtShekel(classExpenseTotal)}</span>
            </div>
            {classData.filter(c => c._expense > 0).length === 0
              ? <div style={{ padding:'16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>אין עלויות מדריכים לחודש זה</div>
              : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>מדריך</th><th>שעות</th><th>עלות</th></tr></thead>
                <tbody>{classData.filter(c => c._expense > 0).map(c => (
                  <tr key={c.id}><td><strong>{c.name || c.activity_type}</strong></td><td>{c.instructor_name || '–'}</td><td>{c.monthly_hours || 4}</td><td style={{ color:'#ef4444', fontWeight:600 }}>{fmtShekel(c._expense)}</td></tr>
                ))}</tbody></table></div>
            }
          </div>

          {/* Grand total */}
          <div style={{ padding:'16px 0', display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#fee2e2', borderRadius:12, padding:'16px 32px', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#991b1b', marginBottom:6 }}>סה"כ הוצאות החודש</div>
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
              <p style={{ color:'var(--muted)', fontSize:14 }}>אין פעילויות עדיין</p>
              <button className="btn btn-p" onClick={openNewAct} style={{ marginTop:12 }}>+ הוסף פעילות ראשונה</button>
            </div>
          ) : (
            <div className="card tbl-wrap"><table><thead><tr>
              <th>סוג</th><th>שם פעילות</th><th>לקוח</th><th>חודש</th><th>הכנסה</th><th>הוצאות</th><th>רווח</th><th>תשלום</th><th style={{ width:50 }}></th>
            </tr></thead>
            <tbody>{actFiltered.map(a => {
              const tm = getTypeMeta(a.activityType)
              const pm = getPayMeta(a.paymentStatus)
              const profit = a.income - a.expenses
              return (
                <tr key={a.id} style={{ cursor:'pointer' }} onClick={() => openEditAct(a)}>
                  <td><span className="badge" style={{ background:tm.color+'18', color:tm.color }}>{tm.icon} {tm.label}</span></td>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.contactName || '—'}</td>
                  <td>{a.month ? MONTHS.find(m=>m.v===a.month)?.l + ' ' + a.year : '—'}</td>
                  <td style={{ color:'#10b981', fontWeight:600 }}>₪{fmt(a.income)}</td>
                  <td style={{ color:'#ef4444' }}>{a.expenses ? '₪'+fmt(a.expenses) : '—'}</td>
                  <td style={{ fontWeight:700, color: profit >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(profit)}</td>
                  <td><span className="badge" style={{ background:pm.bg, color:pm.color }}>{pm.label}</span></td>
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
          <div className="card">
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:24 }}>
              {/* Income breakdown */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>סה"כ הכנסות</div>
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

              {/* Expense breakdown */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>סה"כ הוצאות</div>
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

              {/* Gross Profit */}
              <div style={{ padding:24, background: grandProfit >= 0 ? '#d1fae5' : '#fee2e2', borderRadius:12, textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:600, color: grandProfit >= 0 ? '#065f46' : '#991b1b', marginBottom:8 }}>רווח גולמי</div>
                <div style={{ fontSize:36, fontWeight:800, color: grandProfit >= 0 ? '#10b981' : '#ef4444' }}>{fmtShekel(grandProfit)}</div>
                <div style={{ fontSize:12, color: grandProfit >= 0 ? '#065f46' : '#991b1b', marginTop:8 }}>
                  {grandExpense > 0 ? `יחס הכנסה להוצאה: ${Math.round((grandIncome / grandExpense) * 100)}%` : grandIncome > 0 ? 'אין הוצאות לחודש זה' : 'אין נתונים לחודש זה'}
                </div>
              </div>
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
