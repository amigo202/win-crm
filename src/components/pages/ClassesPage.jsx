import { useState, useMemo, useRef } from 'react'
import { exportClassesCSV } from '../../utils/csv'
import Papa from 'papaparse'

// ── Constants ───────────────────────────────────────────────────────────────
const DAYS_HE    = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const STATUS_OPT = ['פעיל','ממתין','הושלם','בוטל']
const PAY_METHOD = ['מזומן','שיק','העברה','כרטיס אשראי','ביט','פייבוקס','אחר']
const ACT_TYPES  = ['חוג','קורס','סדנה','מחנה','אירוע','הרצאה','אחר']

const now = new Date()
const CUR_YEAR  = now.getFullYear()
const CUR_MONTH = now.getMonth() + 1

function fmt(n)  { return Number(n || 0).toLocaleString('he-IL') }

function payColor(cls) {
  if (!cls.agreed_price && !cls.actual_income) return '#94a3b8'
  if (cls.paid) return '#10b981'
  if ((cls.actual_income || 0) > 0) return '#f59e0b'
  return '#ef4444'
}
function payLabel(cls) {
  if (cls.paid) return '✓ שולם'
  if ((cls.actual_income || 0) > 0) return '⏳ חלקי'
  if (cls.agreed_price) return '⚠ ממתין'
  return '—'
}

// ── Calculated fields for a class row ────────────────────────────────────────
function calcRow(cls) {
  const students       = Number(cls.students_count) || 0
  const pricePerChild  = Number(cls.price_per_student) || 0
  const monthlyPayment = students * pricePerChild || Number(cls.agreed_price) || 0
  const overheadPct    = Number(cls.overhead_pct) ?? 70
  const totalProfit    = overheadPct > 0 ? Math.round(monthlyPayment * (overheadPct / 100)) : monthlyPayment
  const instrHourly    = Number(cls.instructor_price_per_session) || 0
  const monthlyHours   = Number(cls.monthly_hours) || 4
  const instrMonthly   = instrHourly * monthlyHours
  const profitability  = totalProfit - instrMonthly
  return { students, pricePerChild, monthlyPayment, overheadPct, totalProfit, instrHourly, monthlyHours, instrMonthly, profitability }
}

// ── Empty class form ────────────────────────────────────────────────────────
function emptyClass() {
  return {
    class_name: '', activity_type: 'חוג', location: '', city: '',
    contact_name: '', contact_phone: '', contact_id: '',
    coordinator: '',
    year: CUR_YEAR, month: CUR_MONTH,
    day: 'ראשון', time_start: '', subject: '', grades: '',
    groups_count: 1, students_count: '', sessions_count: '', session_length: 60,
    instructor_id: '', instructor_price_per_session: '', total_instructor_cost: '',
    overhead_pct: 70, monthly_hours: 4,
    agreed_price: '', price_per_student: '', price_per_session: '',
    actual_income: '', payment_date: '', payment_method: '', invoice_number: '',
    paid: false,
    status: 'פעיל', responsible: '', notes: '',
  }
}

// ── ClassModal ──────────────────────────────────────────────────────────────
function ClassModal({ cls, instructors, contacts, onSave, onClose, onDel }) {
  const [form, setForm]   = useState(() => cls ? { ...emptyClass(), ...cls } : emptyClass())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const [tab, setTab]       = useState('basic')

  const f  = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const fb = k => e => setForm(p => ({ ...p, [k]: e.target.checked }))
  const fn = k => e => setForm(p => ({ ...p, [k]: e.target.value === '' ? '' : Number(e.target.value) }))

  const sub = async e => {
    e.preventDefault()
    if (!form.class_name.trim() && !form.subject?.trim()) return
    setSaving(true); setErr(null)
    try { await onSave(form); onClose() }
    catch (ex) { setErr(ex?.message ?? 'שגיאה בשמירה'); setSaving(false) }
  }

  const INP = { padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', direction:'rtl', width:'100%', boxSizing:'border-box', background:'var(--bg)', color:'var(--text)' }
  const LBL = { display:'block', fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:4 }
  const GRP = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }
  const GRP3 = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }

  const tabs = [
    { id:'basic',   label:'📋 פרטי חוג' },
    { id:'finance', label:'₪ כספים' },
    { id:'manage',  label:'⚙️ ניהול' },
  ]

  // Live calculation preview
  const calc = calcRow(form)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ direction:'rtl' }}>
        <div className="mh">
          <h3>{cls ? 'עריכת חוג' : 'חוג / קורס חדש'}</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'10px 4px', border:'none', background:'none', cursor:'pointer',
              fontSize:12, fontWeight:600, fontFamily:'inherit',
              color: tab === t.id ? '#f97316' : 'var(--muted)',
              borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={sub} className="mb" style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
          {/* ── BASIC TAB ── */}
          {tab === 'basic' && (
            <>
              <div style={GRP}>
                <div>
                  <label style={LBL}>לקוח משלם</label>
                  <input value={form.contact_name} onChange={f('contact_name')} placeholder="שם הלקוח / רשת" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>יישוב</label>
                  <input value={form.city} onChange={f('city')} placeholder="עיר / יישוב" style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>רכזת</label>
                  <input value={form.coordinator || ''} onChange={f('coordinator')} placeholder="שם רכזת" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>מתנ"ס / בי"ס</label>
                  <input value={form.location} onChange={f('location')} placeholder="שם המוסד" style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>מיקום (תת-מיקום)</label>
                  <input value={form.class_name} onChange={f('class_name')} placeholder="פירוט מיקום / שם חוג" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>סוג פעילות</label>
                  <select value={form.activity_type} onChange={f('activity_type')} style={INP}>
                    {ACT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={GRP3}>
                <div>
                  <label style={LBL}>יום</label>
                  <select value={form.day} onChange={f('day')} style={INP}>
                    {DAYS_HE.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>שעה</label>
                  <input type="time" value={form.time_start} onChange={f('time_start')} style={INP}/>
                </div>
                <div>
                  <label style={LBL}>נושא</label>
                  <input value={form.subject || ''} onChange={f('subject')} placeholder="נושא הפעילות" style={INP}/>
                </div>
              </div>

              <div style={GRP3}>
                <div>
                  <label style={LBL}>כיתה / שכבה</label>
                  <input value={form.grades} onChange={f('grades')} placeholder="א-ב, ג..." style={INP}/>
                </div>
                <div>
                  <label style={LBL}>מדריך</label>
                  <select value={form.instructor_id} onChange={f('instructor_id')} style={INP}>
                    <option value="">ללא</option>
                    {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>מנות ילדים</label>
                  <input type="number" min="0" value={form.students_count} onChange={fn('students_count')} style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>שנה</label>
                  <select value={form.year} onChange={fn('year')} style={INP}>
                    {[CUR_YEAR-1, CUR_YEAR, CUR_YEAR+1].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>חודש</label>
                  <select value={form.month} onChange={fn('month')} style={INP}>
                    {MONTHS_HE.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── FINANCE TAB ── */}
          {tab === 'finance' && (
            <>
              <div style={{ background:'#fff7ed', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400e', fontWeight:600 }}>
                💰 תמחור והכנסות
              </div>

              <div style={GRP3}>
                <div>
                  <label style={LBL}>תשלום פר ילד חודשי (₪)</label>
                  <input type="number" min="0" value={form.price_per_student} onChange={fn('price_per_student')} placeholder="0" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>אחוז תקורה (%)</label>
                  <input type="number" min="0" max="100" value={form.overhead_pct ?? 70} onChange={fn('overhead_pct')} placeholder="70" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>מחיר סוכם (₪)</label>
                  <input type="number" min="0" value={form.agreed_price} onChange={fn('agreed_price')} placeholder="0" style={INP}/>
                </div>
              </div>

              {/* Live calc preview */}
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, textAlign:'center' }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#0ea5e9' }}>₪{fmt(calc.monthlyPayment)}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>תשלום החודש</div>
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#10b981' }}>₪{fmt(calc.totalProfit)}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>סה"כ רווח</div>
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color: calc.profitability >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(calc.profitability)}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>רווחיות חוג</div>
                </div>
              </div>

              <div style={{ background:'#fdf4ff', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#6b21a8', fontWeight:600 }}>
                👨‍🏫 עלות מדריך
              </div>

              <div style={GRP3}>
                <div>
                  <label style={LBL}>עלות מדריך לשעה (₪)</label>
                  <input type="number" min="0" value={form.instructor_price_per_session} onChange={fn('instructor_price_per_session')} placeholder="0" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>שעות חודשיות</label>
                  <input type="number" min="0" value={form.monthly_hours ?? 4} onChange={fn('monthly_hours')} placeholder="4" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>עלות מדריך לחודש</label>
                  <div style={{ ...INP, background:'var(--bg)', fontWeight:700, color:'#8b5cf6', display:'flex', alignItems:'center' }}>
                    ₪{fmt(calc.instrMonthly)}
                  </div>
                </div>
              </div>

              <div style={{ background:'#f0f9ff', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#0c4a6e', fontWeight:600 }}>
                🏦 תשלום בפועל
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>הכנסה בפועל (₪)</label>
                  <input type="number" min="0" value={form.actual_income} onChange={fn('actual_income')} placeholder="0" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>אמצעי תשלום</label>
                  <select value={form.payment_method} onChange={f('payment_method')} style={INP}>
                    <option value="">בחר...</option>
                    {PAY_METHOD.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>חשבונית</label>
                  <input value={form.invoice_number} onChange={f('invoice_number')} placeholder="מספר חשבונית" style={INP}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:20 }}>
                  <input type="checkbox" id="paid_cb" checked={!!form.paid} onChange={fb('paid')} style={{ width:18, height:18, cursor:'pointer' }}/>
                  <label htmlFor="paid_cb" style={{ fontSize:14, fontWeight:600, color: form.paid ? '#10b981' : 'var(--muted)', cursor:'pointer' }}>
                    {form.paid ? '✓ שולם במלואו' : 'סמן כשולם'}
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ── MANAGE TAB ── */}
          {tab === 'manage' && (
            <>
              <div style={GRP}>
                <div>
                  <label style={LBL}>סטטוס</label>
                  <select value={form.status} onChange={f('status')} style={INP}>
                    {STATUS_OPT.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>אחראי</label>
                  <input value={form.responsible} onChange={f('responsible')} placeholder="שם אחראי" style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>טלפון איש קשר</label>
                  <input value={form.contact_phone} onChange={f('contact_phone')} placeholder="050-..." style={INP}/>
                </div>
                <div>
                  <label style={LBL}>קישור CRM</label>
                  <select value={form.contact_id} onChange={f('contact_id')} style={INP}>
                    <option value="">ללא קישור</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={LBL}>הערות</label>
                <textarea value={form.notes} onChange={f('notes')} placeholder="הערות נוספות..." rows={3} style={{ ...INP, resize:'vertical' }}/>
              </div>
            </>
          )}

          {err && <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'8px 12px', fontSize:13 }}>⚠️ {err}</div>}

          <div className="mf">
            <button type="submit" className="btn btn-p" disabled={saving}>
              {saving ? '...' : (cls ? 'שמור' : 'הוסף חוג')}
            </button>
            <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
            {cls && <button type="button" className="del-link" onClick={() => { if(window.confirm('למחוק חוג זה?')) onDel(cls.id) }}>מחק</button>}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Class Import Modal ───────────────────────────────────────────────────────
function ClassImportModal({ onClose, onAdd }) {
  const [step, setStep]   = useState('upload')
  const [rows, setRows]   = useState([])
  const [error, setError] = useState(null)
  const fileRef           = useRef()

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        if (!result.data?.length) { setError('הקובץ ריק'); return }
        const mapped = result.data.map(r => ({
          ...emptyClass(),
          class_name:                  r['מיקום']   || r['שם חוג'] || r['name'] || r['class_name'] || '',
          activity_type:               r['סוג']     || r['activity_type'] || 'חוג',
          location:                    r['מתנס/בי"ס'] || r['מוסד'] || r['location'] || '',
          city:                        r['יישוב']   || r['עיר'] || r['city'] || '',
          contact_name:                r['לקוח משלם'] || r['contact_name'] || '',
          coordinator:                 r['רכזת']    || '',
          subject:                     r['נושא']    || '',
          grades:                      r['כיתה']    || '',
          day:                         r['יום']     || r['day'] || 'ראשון',
          time_start:                  r['שעה']     || r['time_start'] || '',
          students_count:              Number(r['מנות ילדים'] || r['תלמידים'] || r['students_count'] || 0),
          price_per_student:           Number(r['תשלום פר ילד חודשי'] || r['price_per_student'] || 0),
          agreed_price:                Number(r['תשלום החודש'] || r['סוכם'] || r['agreed_price'] || 0),
          overhead_pct:                Number(r['תקורה'] || 70),
          instructor_price_per_session:Number(r['עלות מדריך לשעה'] || 0),
          monthly_hours:               Number(r['שעות חודשיות'] || 4),
          actual_income:               Number(r['בפועל'] || r['actual_income'] || 0),
          status:                      r['סטטוס']   || r['status'] || 'פעיל',
        })).filter(r => r.class_name.trim() || r.subject?.trim() || r.location?.trim())
        if (!mapped.length) { setError('לא נמצאו שורות תקינות'); return }
        setRows(mapped)
        setStep('preview')
      },
      error: () => setError('שגיאה בקריאת הקובץ'),
    })
  }

  const doImport = async () => {
    try {
      for (const r of rows) await onAdd(r)
      setStep('done')
    } catch (e) {
      setError(e?.message || 'שגיאה בייבוא')
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ direction:'rtl' }}>
        <div className="mh">
          <h3>ייבוא חוגים מ-CSV</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          {step === 'upload' && (
            <div style={{ textAlign:'center', padding:24 }}>
              <p style={{ color:'var(--muted)', marginBottom:16, fontSize:13 }}>
                העלה קובץ CSV עם עמודות לפי טבלת האקסל
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display:'none' }}/>
              <button className="btn btn-p" onClick={() => fileRef.current?.click()}>📁 בחר קובץ</button>
              {error && <p style={{ color:'var(--danger)', marginTop:12 }}>{error}</p>}
            </div>
          )}
          {step === 'preview' && (
            <>
              <p style={{ marginBottom:12, fontSize:13, color:'var(--muted)' }}>נמצאו {rows.length} חוגים:</p>
              <div className="tbl-wrap" style={{ maxHeight:300 }}>
                <table>
                  <thead><tr>
                    <th>שם / מיקום</th><th>מוסד</th><th>עיר</th><th>סכום</th>
                  </tr></thead>
                  <tbody>{rows.slice(0,50).map((r,i) => (
                    <tr key={i}>
                      <td>{r.class_name || r.subject}</td>
                      <td>{r.location}</td>
                      <td>{r.city}</td>
                      <td>{r.agreed_price ? `₪${fmt(r.agreed_price)}` : '–'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {error && <p style={{ color:'var(--danger)', marginTop:8 }}>{error}</p>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button className="btn btn-p" onClick={doImport}>✓ ייבא {rows.length} חוגים</button>
                <button className="btn btn-o" onClick={onClose}>ביטול</button>
              </div>
            </>
          )}
          {step === 'done' && (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <p style={{ fontWeight:600 }}>יובאו {rows.length} חוגים בהצלחה!</p>
              <button className="btn btn-p" onClick={onClose} style={{ marginTop:16 }}>סגור</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main ClassesPage ─────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function ClassesPage({ classes, instructors, contacts, onAdd, onUpdate, onDelete, onReload }) {
  const [modal, setModal]         = useState(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch]       = useState('')
  const [filterCity, setFilterCity]         = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPaid, setFilterPaid]         = useState('')

  // ── Filtered ──────────────────────────────────────────────────────────────
  const cities = useMemo(() => [...new Set(classes.map(c => c.city).filter(Boolean))].sort(), [classes])

  const filtered = useMemo(() => {
    let arr = [...classes]
    if (search)       arr = arr.filter(c => [c.class_name, c.location, c.city, c.contact_name, c.subject, c.coordinator].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    if (filterCity)   arr = arr.filter(c => c.city === filterCity)
    if (filterStatus) arr = arr.filter(c => c.status === filterStatus)
    if (filterPaid === 'paid')    arr = arr.filter(c => c.paid)
    if (filterPaid === 'partial') arr = arr.filter(c => !c.paid && (c.actual_income || 0) > 0)
    if (filterPaid === 'unpaid')  arr = arr.filter(c => !c.paid && !(c.actual_income > 0) && (c.agreed_price > 0))
    return arr
  }, [classes, search, filterCity, filterStatus, filterPaid])

  // ── KPI stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalMonthly = 0, totalProfit = 0, totalInstrCost = 0
    for (const c of classes) {
      const r = calcRow(c)
      totalMonthly   += r.monthlyPayment
      totalProfit    += r.profitability
      totalInstrCost += r.instrMonthly
    }
    return {
      count: classes.length,
      totalMonthly,
      totalProfit,
      totalInstrCost,
      totalStudents: classes.reduce((s, c) => s + (Number(c.students_count) || 0), 0),
    }
  }, [classes])

  const handleSave = async form => {
    if (modal?.cls) await onUpdate(modal.cls.id, form)
    else            await onAdd(form)
  }

  const handleDelete = async id => {
    await onDelete(id)
    setModal(null)
  }

  const clearFilters = () => { setFilterCity(''); setFilterStatus(''); setFilterPaid(''); setSearch('') }
  const hasFilters = filterCity || filterStatus || filterPaid || search

  // ── Table column headers matching spreadsheet ─────────────────────────────
  const COLS = [
    'לקוח משלם','יישוב','רכזת','מתנ"ס / בי"ס','מיקום','יום','שעה','נושא','כיתה','מדריך',
    'מנות ילדים','תשלום\nפר ילד','תשלום\nהחודש','תקורה','סה"כ רווח',
    'עלות מדריך\nלשעה','עלות מדריך\nלחודש','רווחיות\nחוג','',
  ]

  return (
    <>
      <div className="ph">
        <h2>🏫 חוגים וקורסים</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-o btn-sm" onClick={() => exportClassesCSV(classes)}>📥 ייצוא</button>
          <button className="btn btn-o btn-sm" onClick={() => setImporting(true)}>📤 ייבוא</button>
          <button className="btn btn-p btn-sm" onClick={() => setModal({ cls: null })}>+ הוסף חוג</button>
        </div>
      </div>

      <div className="pb">
        {/* ── KPI Cards ── */}
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:16 }}>
          {[
            { label:'חוגים',          val: stats.count,                           color:'#0ea5e9', bg:'#e0f2fe', icon:'🏫' },
            { label:'תלמידים',        val: stats.totalStudents,                    color:'#8b5cf6', bg:'#ede9fe', icon:'👨‍🎓' },
            { label:'הכנסות חודשיות',  val: `₪${fmt(stats.totalMonthly)}`,          color:'#10b981', bg:'#d1fae5', icon:'💰' },
            { label:'עלות מדריכים',    val: `₪${fmt(stats.totalInstrCost)}`,         color:'#f59e0b', bg:'#fef3c7', icon:'👨‍🏫' },
            { label:'רווחיות כוללת',   val: `₪${fmt(stats.totalProfit)}`,            color: stats.totalProfit >= 0 ? '#10b981' : '#ef4444', bg: stats.totalProfit >= 0 ? '#d1fae5' : '#fee2e2', icon:'📊' },
          ].map((k, i) => (
            <div key={i} className="stat-card" style={{ textAlign:'center', padding:'14px 10px' }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{k.icon}</div>
              <div style={{ fontSize:18, fontWeight:800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="card" style={{ padding:'10px 14px', marginBottom:14, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש..."
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)', minWidth:160, flex:1 }}/>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל הערים</option>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל הסטטוסים</option>
            {STATUS_OPT.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPaid} onChange={e => setFilterPaid(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל התשלומים</option>
            <option value="paid">שולם</option>
            <option value="partial">חלקי</option>
            <option value="unpaid">ממתין</option>
          </select>
          {hasFilters && <button className="btn btn-o btn-sm" onClick={clearFilters} style={{ color:'var(--danger)' }}>× נקה</button>}
          <span style={{ fontSize:12, color:'var(--muted)', marginRight:'auto' }}>{filtered.length} / {classes.length}</span>
        </div>

        {/* ── Main Table ── */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding:'60px 20px', textAlign:'center' }}>
            <div className="empty">
              <div className="empty-ico">🏫</div>
              <p>{classes.length === 0 ? 'אין חוגים במערכת עדיין' : 'לא נמצאו חוגים לפי הסינון'}</p>
              {classes.length === 0 && (
                <button className="btn btn-p" onClick={() => setModal({ cls: null })} style={{ marginTop:12 }}>+ הוסף חוג ראשון</button>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="tbl-wrap">
              <table style={{ minWidth: 1500 }}>
                <thead>
                  <tr>
                    {COLS.map((h, i) => (
                      <th key={i} style={{ whiteSpace:'pre-line', textAlign:'center', padding:'10px 8px', fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((cls) => {
                    const r   = calcRow(cls)
                    const pc  = payColor(cls)
                    const instrName = cls.instructors?.name || (instructors.find(x => x.id === cls.instructor_id)?.name) || '—'

                    return (
                      <tr key={cls.id} onClick={() => setModal({ cls })} style={{ cursor:'pointer' }}>
                        <td style={{ fontWeight:600, minWidth:100 }}>{cls.contact_name || '—'}</td>
                        <td>{cls.city || '—'}</td>
                        <td>{cls.coordinator || '—'}</td>
                        <td style={{ minWidth:120 }}>{cls.location || '—'}</td>
                        <td style={{ minWidth:110 }}>
                          {cls.class_name || '—'}
                          {cls.activity_type && <div style={{ fontSize:10, color:'var(--muted)' }}>{cls.activity_type}</div>}
                        </td>
                        <td style={{ textAlign:'center' }}>{cls.day || '—'}</td>
                        <td style={{ textAlign:'center' }}>{cls.time_start || '—'}</td>
                        <td>{cls.subject || '—'}</td>
                        <td style={{ textAlign:'center' }}>{cls.grades || '—'}</td>
                        <td>{instrName}</td>
                        <td style={{ textAlign:'center', fontWeight:600 }}>{r.students || '—'}</td>
                        <td style={{ textAlign:'center' }}>{r.pricePerChild ? `₪${fmt(r.pricePerChild)}` : '—'}</td>
                        <td style={{ textAlign:'center', fontWeight:700, color:'#0ea5e9' }}>
                          {r.monthlyPayment ? `₪${fmt(r.monthlyPayment)}` : '—'}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {r.overheadPct ? `${r.overheadPct}%` : '—'}
                        </td>
                        <td style={{ textAlign:'center', fontWeight:700, color:'#10b981' }}>
                          {r.totalProfit ? `₪${fmt(r.totalProfit)}` : '—'}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {r.instrHourly ? `₪${fmt(r.instrHourly)}` : '—'}
                        </td>
                        <td style={{ textAlign:'center', color:'#8b5cf6', fontWeight:600 }}>
                          {r.instrMonthly ? `₪${fmt(r.instrMonthly)}` : '—'}
                        </td>
                        <td style={{ textAlign:'center', fontWeight:800, color: r.profitability >= 0 ? '#10b981' : '#ef4444' }}>
                          {(r.monthlyPayment || r.instrMonthly) ? `₪${fmt(r.profitability)}` : '—'}
                        </td>
                        <td style={{ padding:'8px 6px' }}>
                          <span style={{ background: pc + '20', color: pc, borderRadius:20, padding:'3px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                            {payLabel(cls)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ background:'var(--bg)', fontWeight:700 }}>
                    <td colSpan={10} style={{ textAlign:'right', padding:'10px 12px' }}>סה"כ</td>
                    <td style={{ textAlign:'center' }}>{stats.totalStudents}</td>
                    <td></td>
                    <td style={{ textAlign:'center', color:'#0ea5e9' }}>₪{fmt(stats.totalMonthly)}</td>
                    <td></td>
                    <td style={{ textAlign:'center', color:'#10b981' }}>
                      ₪{fmt(filtered.reduce((s, c) => s + calcRow(c).totalProfit, 0))}
                    </td>
                    <td></td>
                    <td style={{ textAlign:'center', color:'#8b5cf6' }}>₪{fmt(stats.totalInstrCost)}</td>
                    <td style={{ textAlign:'center', color: stats.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                      ₪{fmt(stats.totalProfit)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ClassModal cls={modal.cls} instructors={instructors} contacts={contacts}
          onSave={handleSave} onClose={() => setModal(null)} onDel={handleDelete}/>
      )}
      {importing && (
        <ClassImportModal onClose={() => setImporting(false)} onAdd={onAdd}/>
      )}
    </>
  )
}
