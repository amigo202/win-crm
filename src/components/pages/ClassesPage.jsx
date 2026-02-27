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

function pct(a, b) { return b ? Math.round(a / b * 100) : 0 }
function fmt(n)    { return Number(n || 0).toLocaleString('he-IL') }

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

// ── Empty class form ────────────────────────────────────────────────────────
function emptyClass() {
  return {
    class_name: '', activity_type: 'חוג', location: '', city: '',
    contact_name: '', contact_phone: '', contact_id: '',
    year: CUR_YEAR, month: CUR_MONTH,
    day: 'ראשון', time_start: '', groups_count: 1,
    students_count: '', grades: '', sessions_count: '', session_length: 60,
    instructor_id: '', instructor_price_per_session: '', total_instructor_cost: '',
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
  const [tab, setTab]       = useState('basic') // basic | income | management

  const f  = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const fb = k => e => setForm(p => ({ ...p, [k]: e.target.checked }))
  const fn = k => e => setForm(p => ({ ...p, [k]: e.target.value === '' ? '' : Number(e.target.value) }))

  // Auto-calc total instructor cost
  const calcInstructor = () => {
    const sessions = Number(form.sessions_count) || 0
    const price    = Number(form.instructor_price_per_session) || 0
    if (sessions && price) setForm(p => ({ ...p, total_instructor_cost: sessions * price }))
  }

  const sub = async e => {
    e.preventDefault()
    if (!form.class_name.trim()) return
    setSaving(true); setErr(null)
    try { await onSave(form); onClose() }
    catch (ex) { setErr(ex?.message ?? 'שגיאה בשמירה'); setSaving(false) }
  }

  const INP = { padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', direction:'rtl', width:'100%', boxSizing:'border-box', background:'#f8fafc', color:'#1e293b' }
  const LBL = { display:'block', fontSize:11, fontWeight:600, color:'#64748b', marginBottom:4 }
  const GRP = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }

  const tabs = [
    { id:'basic',      label:'📋 פרטי חוג' },
    { id:'income',     label:'₪ כספים' },
    { id:'management', label:'⚙️ ניהול' },
  ]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.2)', direction:'rtl', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>{cls ? 'עריכת חוג' : 'חוג / קורס חדש'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'10px 4px', border:'none', background:'none', cursor:'pointer',
              fontSize:12, fontWeight:600, fontFamily:'inherit',
              color: tab === t.id ? '#f97316' : '#64748b',
              borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={sub} style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          {/* ── BASIC TAB ── */}
          {tab === 'basic' && (
            <>
              <div style={GRP}>
                <div>
                  <label style={LBL}>שם חוג / קורס *</label>
                  <input required value={form.class_name} onChange={f('class_name')} placeholder="שם הפעילות" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>סוג פעילות</label>
                  <select value={form.activity_type} onChange={f('activity_type')} style={INP}>
                    {ACT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>שם בית ספר / מתנ"ס</label>
                  <input value={form.location} onChange={f('location')} placeholder='מיקום' style={INP}/>
                </div>
                <div>
                  <label style={LBL}>עיר</label>
                  <input value={form.city} onChange={f('city')} placeholder='עיר' style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>איש קשר</label>
                  <input value={form.contact_name} onChange={f('contact_name')} placeholder='שם איש קשר' style={INP}/>
                </div>
                <div>
                  <label style={LBL}>טלפון</label>
                  <input value={form.contact_phone} onChange={f('contact_phone')} placeholder='050-...' style={INP}/>
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

              <div style={GRP}>
                <div>
                  <label style={LBL}>יום בשבוע</label>
                  <select value={form.day} onChange={f('day')} style={INP}>
                    {DAYS_HE.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>שעת התחלה</label>
                  <input type="time" value={form.time_start} onChange={f('time_start')} style={INP}/>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div>
                  <label style={LBL}>כמות קבוצות</label>
                  <input type="number" min="1" value={form.groups_count} onChange={fn('groups_count')} style={INP}/>
                </div>
                <div>
                  <label style={LBL}>כמות תלמידים</label>
                  <input type="number" min="0" value={form.students_count} onChange={fn('students_count')} style={INP}/>
                </div>
                <div>
                  <label style={LBL}>כיתות / שכבות</label>
                  <input value={form.grades} onChange={f('grades')} placeholder='א-ב, ג...' style={INP}/>
                </div>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>כמות מפגשים</label>
                  <input type="number" min="0" value={form.sessions_count} onChange={fn('sessions_count')} style={INP}/>
                </div>
                <div>
                  <label style={LBL}>אורך מפגש (דק')</label>
                  <input type="number" min="15" step="15" value={form.session_length} onChange={fn('session_length')} style={INP}/>
                </div>
              </div>

              <div>
                <label style={LBL}>מדריך</label>
                <select value={form.instructor_id} onChange={f('instructor_id')} style={INP}>
                  <option value="">ללא מדריך</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── INCOME TAB ── */}
          {tab === 'income' && (
            <>
              <div style={{ background:'#fff7ed', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#92400e', marginBottom:4 }}>
                💰 הכנסות
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>מחיר לתלמיד (₪)</label>
                  <input type="number" min="0" value={form.price_per_student} onChange={fn('price_per_student')} placeholder="0" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>מחיר למפגש (₪)</label>
                  <input type="number" min="0" value={form.price_per_session} onChange={fn('price_per_session')} placeholder="0" style={INP}/>
                </div>
              </div>

              <div>
                <label style={LBL}>מחיר סוכם כולל (₪)</label>
                <input type="number" min="0" value={form.agreed_price} onChange={fn('agreed_price')} placeholder="0" style={{ ...INP, fontWeight:600 }}/>
              </div>

              {/* Auto-calc expected */}
              {(form.students_count && form.price_per_student) && (
                <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#065f46' }}>
                  💡 הכנסה צפויה: ₪{fmt(Number(form.students_count) * Number(form.price_per_student))}
                </div>
              )}

              <div style={{ background:'#f0f9ff', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#0c4a6e', marginTop:4 }}>
                🏦 תשלום בפועל
              </div>

              <div>
                <label style={LBL}>הכנסה בפועל (₪)</label>
                <input type="number" min="0" value={form.actual_income} onChange={fn('actual_income')} placeholder="0" style={INP}/>
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>תאריך תשלום</label>
                  <input type="date" value={form.payment_date} onChange={f('payment_date')} style={INP}/>
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
                  <label style={LBL}>מספר חשבונית</label>
                  <input value={form.invoice_number} onChange={f('invoice_number')} placeholder="חשבונית..." style={INP}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:20 }}>
                  <input type="checkbox" id="paid_cb" checked={!!form.paid} onChange={fb('paid')} style={{ width:18, height:18, cursor:'pointer' }}/>
                  <label htmlFor="paid_cb" style={{ fontSize:14, fontWeight:600, color: form.paid ? '#10b981' : '#64748b', cursor:'pointer' }}>
                    {form.paid ? '✓ שולם במלואו' : 'סמן כשולם'}
                  </label>
                </div>
              </div>

              <div style={{ background:'#fdf4ff', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#6b21a8', marginTop:4 }}>
                👨‍🏫 עלות מדריך
              </div>

              <div style={GRP}>
                <div>
                  <label style={LBL}>מחיר למפגש - מדריך (₪)</label>
                  <input type="number" min="0" value={form.instructor_price_per_session}
                    onChange={fn('instructor_price_per_session')}
                    onBlur={calcInstructor}
                    placeholder="0" style={INP}/>
                </div>
                <div>
                  <label style={LBL}>עלות מדריך סה"כ (₪)</label>
                  <input type="number" min="0" value={form.total_instructor_cost} onChange={fn('total_instructor_cost')} placeholder="0" style={INP}/>
                </div>
              </div>

              {/* Profit preview */}
              {(form.agreed_price || form.actual_income) && (
                <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:'#10b981' }}>
                      ₪{fmt((form.actual_income || form.agreed_price || 0) - (form.total_instructor_cost || 0))}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b' }}>רווח גולמי</div>
                  </div>
                  <div style={{ width:1, background:'#e2e8f0' }}/>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:'#0ea5e9' }}>
                      ₪{fmt((form.agreed_price || 0) - (form.total_instructor_cost || 0))}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b' }}>רווח צפוי</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── MANAGEMENT TAB ── */}
          {tab === 'management' && (
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
                  <input value={form.responsible} onChange={f('responsible')} placeholder='שם אחראי' style={INP}/>
                </div>
              </div>

              <div>
                <label style={LBL}>קישור CRM — איש קשר</label>
                <select value={form.contact_id} onChange={f('contact_id')} style={INP}>
                  <option value="">ללא קישור</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
              </div>

              <div>
                <label style={LBL}>הערות</label>
                <textarea value={form.notes} onChange={f('notes')} placeholder="הערות נוספות..." rows={4}
                  style={{ ...INP, resize:'vertical' }}/>
              </div>
            </>
          )}

          {err && <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'8px 12px', fontSize:13 }}>⚠️ {err}</div>}

          <div style={{ display:'flex', gap:10, paddingTop:4 }}>
            <button type="submit" disabled={saving} style={{
              flex:1, padding:'11px', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor: saving?'default':'pointer', fontFamily:'inherit',
              background: saving ? '#9ca3af' : 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff',
            }}>{saving ? '...' : (cls ? 'שמור שינויים' : 'הוסף חוג')}</button>
            <button type="button" onClick={onClose} style={{ padding:'11px 18px', border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:14, color:'#64748b' }}>ביטול</button>
            {cls && (
              <button type="button" onClick={() => { if(window.confirm('למחוק חוג זה?')) onDel(cls.id) }}
                style={{ padding:'11px', border:'none', background:'none', color:'#ef4444', cursor:'pointer', fontSize:13, fontFamily:'inherit', fontWeight:600 }}>🗑 מחק</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ClassesPage ─────────────────────────────────────────────────────────
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
          class_name:     r['שם חוג'] || r['name'] || r['class_name'] || '',
          activity_type:  r['סוג'] || r['activity_type'] || 'חוג',
          location:       r['מוסד'] || r['location'] || '',
          city:           r['עיר'] || r['city'] || '',
          day:            r['יום'] || r['day'] || 'ראשון',
          time_start:     r['שעה'] || r['time_start'] || '',
          students_count: Number(r['תלמידים'] || r['students_count'] || 0),
          sessions_count: Number(r['מפגשים'] || r['sessions_count'] || 0),
          agreed_price:   Number(r['סוכם'] || r['agreed_price'] || 0),
          actual_income:  Number(r['בפועל'] || r['actual_income'] || 0),
          status:         r['סטטוס'] || r['status'] || 'פעיל',
        })).filter(r => r.class_name.trim())
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.2)', direction:'rtl', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>ייבוא חוגים מ-CSV</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
        </div>
        <div style={{ padding:20 }}>
          {step === 'upload' && (
            <div style={{ textAlign:'center', padding:24 }}>
              <p style={{ color:'#64748b', marginBottom:16, fontSize:13 }}>
                העלה קובץ CSV עם עמודות: שם חוג, סוג, מוסד, עיר, יום, שעה, תלמידים, מפגשים, סוכם, בפועל, סטטוס
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display:'none' }}/>
              <button onClick={() => fileRef.current?.click()}
                style={{ padding:'10px 20px', background:'#f97316', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                📁 בחר קובץ
              </button>
              {error && <p style={{ color:'#ef4444', marginTop:12 }}>{error}</p>}
            </div>
          )}
          {step === 'preview' && (
            <>
              <p style={{ marginBottom:12, fontSize:13, color:'#64748b' }}>נמצאו {rows.length} חוגים:</p>
              <div style={{ maxHeight:300, overflowY:'auto', borderRadius:8, border:'1px solid #e2e8f0' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'8px', textAlign:'right' }}>שם</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>מוסד</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>עיר</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>סוכם</th>
                  </tr></thead>
                  <tbody>{rows.slice(0,50).map((r,i) => (
                    <tr key={i} style={{ borderTop:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'6px 8px' }}>{r.class_name}</td>
                      <td style={{ padding:'6px 8px' }}>{r.location}</td>
                      <td style={{ padding:'6px 8px' }}>{r.city}</td>
                      <td style={{ padding:'6px 8px' }}>{r.agreed_price ? `₪${r.agreed_price}` : '–'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {error && <p style={{ color:'#ef4444', marginTop:8 }}>{error}</p>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button onClick={doImport}
                  style={{ flex:1, padding:'10px', background:'#f97316', color:'#fff', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  ✓ ייבא {rows.length} חוגים
                </button>
                <button onClick={onClose}
                  style={{ padding:'10px 18px', border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', cursor:'pointer', fontFamily:'inherit', color:'#64748b' }}>ביטול</button>
              </div>
            </>
          )}
          {step === 'done' && (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <p style={{ fontWeight:600 }}>יובאו {rows.length} חוגים בהצלחה!</p>
              <button onClick={onClose}
                style={{ marginTop:16, padding:'10px 24px', background:'#f97316', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>סגור</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ClassesPage({ classes, instructors, contacts, onAdd, onUpdate, onDelete, onReload }) {
  const [modal, setModal]       = useState(null) // null | { cls }
  const [importing, setImporting] = useState(false)
  const [filterCity, setFilterCity]         = useState('')
  const [filterInstructor, setFilterInstructor] = useState('')
  const [filterMonth, setFilterMonth]       = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPaid, setFilterPaid]         = useState('')
  const [search, setSearch]                 = useState('')

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total        = classes.length
    const paid         = classes.filter(c => c.paid).length
    const partial      = classes.filter(c => !c.paid && (c.actual_income || 0) > 0).length
    const unpaid       = classes.filter(c => !c.paid && !(c.actual_income > 0) && (c.agreed_price > 0)).length
    const totalAgreed  = classes.reduce((s, c) => s + (Number(c.agreed_price) || 0), 0)
    const totalActual  = classes.reduce((s, c) => s + (Number(c.actual_income) || 0), 0)
    const totalInstr   = classes.reduce((s, c) => s + (Number(c.total_instructor_cost) || 0), 0)
    const outstanding  = totalAgreed - totalActual
    return { total, paid, partial, unpaid, totalAgreed, totalActual, totalInstr, outstanding }
  }, [classes])

  // ── Unique filter options ──────────────────────────────────────────────────
  const cities       = useMemo(() => [...new Set(classes.map(c => c.city).filter(Boolean))].sort(), [classes])
  const instrOptions = useMemo(() => [...new Set(classes.map(c => c.instructors?.name).filter(Boolean))].sort(), [classes])

  // ── Filtered classes ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = [...classes]
    if (search)           arr = arr.filter(c => [c.class_name, c.location, c.city, c.contact_name].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    if (filterCity)       arr = arr.filter(c => c.city === filterCity)
    if (filterInstructor) arr = arr.filter(c => c.instructors?.name === filterInstructor)
    if (filterMonth)      arr = arr.filter(c => String(c.month) === filterMonth)
    if (filterStatus)     arr = arr.filter(c => c.status === filterStatus)
    if (filterPaid === 'paid')    arr = arr.filter(c => c.paid)
    if (filterPaid === 'partial') arr = arr.filter(c => !c.paid && (c.actual_income || 0) > 0)
    if (filterPaid === 'unpaid')  arr = arr.filter(c => !c.paid && !(c.actual_income > 0) && (c.agreed_price > 0))
    return arr
  }, [classes, search, filterCity, filterInstructor, filterMonth, filterStatus, filterPaid])

  // ── School summary ─────────────────────────────────────────────────────────
  const schoolSummary = useMemo(() => {
    const map = {}
    for (const c of classes) {
      const key = c.location || 'לא צוין'
      if (!map[key]) map[key] = { name: key, count: 0, agreed: 0, actual: 0 }
      map[key].count++
      map[key].agreed  += Number(c.agreed_price)  || 0
      map[key].actual  += Number(c.actual_income) || 0
    }
    return Object.values(map).sort((a, b) => b.agreed - a.agreed).slice(0, 5)
  }, [classes])

  const handleSave = async form => {
    if (modal?.cls) await onUpdate(modal.cls.id, form)
    else            await onAdd(form)
  }

  const handleDelete = async id => {
    await onDelete(id)
    setModal(null)
  }

  const clearFilters = () => {
    setFilterCity(''); setFilterInstructor(''); setFilterMonth('')
    setFilterStatus(''); setFilterPaid(''); setSearch('')
  }
  const hasFilters = filterCity || filterInstructor || filterMonth || filterStatus || filterPaid || search

  const INP_SM = { padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, outline:'none', fontFamily:'inherit', direction:'rtl', background:'#f8fafc', color:'#1e293b', cursor:'pointer' }

  return (
    <div style={{ padding:'20px 18px', direction:'rtl', fontFamily:"'Rubik','Segoe UI',Arial,sans-serif", maxWidth:1300, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'#0f172a' }}>🏫 חוגים וקורסים</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#64748b' }}>{classes.length} חוגים במערכת</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button
            onClick={() => exportClassesCSV(classes)}
            style={{ padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:'#64748b', fontWeight:600 }}>
            📥 ייצוא CSV
          </button>
          <button
            onClick={() => setImporting(true)}
            style={{ padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:12, color:'#64748b', fontWeight:600 }}>
            📤 ייבוא
          </button>
          <button
            onClick={() => setModal({ cls: null })}
            style={{ padding:'10px 20px', background:'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            + הוסף חוג
          </button>
        </div>
      </div>

      {/* ── KPI Dashboard ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'סה"כ חוגים',       value: stats.total,                       color:'#0ea5e9', icon:'🏫' },
          { label:'שולמו',            value: stats.paid,                         color:'#10b981', icon:'✅' },
          { label:'חלקי',             value: stats.partial,                       color:'#f59e0b', icon:'⏳' },
          { label:'ממתין לתשלום',     value: stats.unpaid,                        color:'#ef4444', icon:'⚠️' },
          { label:'סוכם (₪)',         value: '₪' + fmt(stats.totalAgreed),        color:'#6366f1', icon:'📋' },
          { label:'התקבל (₪)',        value: '₪' + fmt(stats.totalActual),        color:'#10b981', icon:'💰' },
          { label:'חוב פתוח (₪)',     value: '₪' + fmt(stats.outstanding),        color: stats.outstanding > 0 ? '#ef4444' : '#10b981', icon:'🔴' },
          { label:'עלות מדריכים (₪)', value: '₪' + fmt(stats.totalInstr),         color:'#8b5cf6', icon:'👨‍🏫' },
        ].map((k, i) => (
          <div key={i} style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontSize:16, fontWeight:800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── School Summary ── */}
      {schoolSummary.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'14px 16px', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', marginBottom:10 }}>📊 סיכום לפי מוסד</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {schoolSummary.map((s, i) => (
              <div key={i} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 14px', flex:'1 1 140px', minWidth:120 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#1e293b', marginBottom:3 }} title={s.name}>
                  {s.name.length > 20 ? s.name.slice(0, 18) + '...' : s.name}
                </div>
                <div style={{ fontSize:11, color:'#64748b' }}>{s.count} חוגים</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#f97316', marginTop:2 }}>₪{fmt(s.agreed)}</div>
                {s.agreed > s.actual && (
                  <div style={{ fontSize:10, color:'#ef4444' }}>חוב: ₪{fmt(s.agreed - s.actual)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'12px 14px', marginBottom:16, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 חיפוש..."
          style={{ ...INP_SM, minWidth:160, flexGrow:1 }}
        />
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={INP_SM}>
          <option value="">כל הערים</option>
          {cities.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} style={INP_SM}>
          <option value="">כל המדריכים</option>
          {instrOptions.map(i => <option key={i}>{i}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={INP_SM}>
          <option value="">כל החודשים</option>
          {MONTHS_HE.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={INP_SM}>
          <option value="">כל הסטטוסים</option>
          {STATUS_OPT.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPaid} onChange={e => setFilterPaid(e.target.value)} style={INP_SM}>
          <option value="">כל התשלומים</option>
          <option value="paid">שולם</option>
          <option value="partial">חלקי</option>
          <option value="unpaid">ממתין</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ padding:'7px 12px', border:'none', background:'#fee2e2', color:'#dc2626', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600 }}>
            × נקה
          </button>
        )}
        <span style={{ fontSize:12, color:'#94a3b8', marginRight:'auto' }}>
          {filtered.length} מתוך {classes.length}
        </span>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'60px 20px', textAlign:'center', color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>
            {classes.length === 0 ? 'אין חוגים במערכת עדיין' : 'לא נמצאו חוגים לפי הסינון'}
          </div>
          {classes.length === 0 && (
            <button onClick={() => setModal({ cls: null })} style={{ marginTop:12, padding:'10px 24px', background:'#f97316', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:14 }}>
              + הוסף חוג ראשון
            </button>
          )}
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, direction:'rtl' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  {['שם חוג','מוסד','עיר','מדריך','יום + שעה','תלמידים','מפגשים','סוכם','בפועל','רווח','תשלום','סטטוס',''].map((h, i) => (
                    <th key={i} style={{ padding:'10px 10px', textAlign:'right', fontSize:11, fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cls, i) => {
                  const gross    = (Number(cls.actual_income) || 0) - (Number(cls.total_instructor_cost) || 0)
                  const expected = (Number(cls.agreed_price) || 0) - (Number(cls.total_instructor_cost) || 0)
                  const pc       = payColor(cls)
                  const pl       = payLabel(cls)
                  const instrName = cls.instructors?.name || (instructors.find(x => x.id === cls.instructor_id)?.name) || '—'

                  return (
                    <tr key={cls.id} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => e.currentTarget.style.background='#fff7ed'}
                      onMouseLeave={e => e.currentTarget.style.background = i%2===0 ? '#fff' : '#fafafa'}>
                      <td style={{ padding:'10px 10px', fontWeight:600, color:'#0f172a', minWidth:140 }}>
                        <div>{cls.class_name}</div>
                        {cls.activity_type && <div style={{ fontSize:10, color:'#94a3b8' }}>{cls.activity_type}</div>}
                      </td>
                      <td style={{ padding:'10px 10px', color:'#1e293b', minWidth:130 }}>{cls.location || '—'}</td>
                      <td style={{ padding:'10px 10px', color:'#64748b' }}>{cls.city || '—'}</td>
                      <td style={{ padding:'10px 10px', color:'#1e293b' }}>{instrName}</td>
                      <td style={{ padding:'10px 10px', whiteSpace:'nowrap', color:'#1e293b' }}>
                        <div>{cls.day}</div>
                        {cls.time_start && <div style={{ fontSize:11, color:'#64748b' }}>{cls.time_start}</div>}
                      </td>
                      <td style={{ padding:'10px 10px', textAlign:'center', color:'#1e293b' }}>{cls.students_count || '—'}</td>
                      <td style={{ padding:'10px 10px', textAlign:'center', color:'#1e293b' }}>{cls.sessions_count || '—'}</td>
                      <td style={{ padding:'10px 10px', fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>
                        {cls.agreed_price ? `₪${fmt(cls.agreed_price)}` : '—'}
                      </td>
                      <td style={{ padding:'10px 10px', fontWeight:600, color: (cls.actual_income || 0) > 0 ? '#10b981' : '#94a3b8', whiteSpace:'nowrap' }}>
                        {cls.actual_income ? `₪${fmt(cls.actual_income)}` : '—'}
                      </td>
                      <td style={{ padding:'10px 10px', fontWeight:700, whiteSpace:'nowrap', color: gross > 0 ? '#10b981' : gross < 0 ? '#ef4444' : '#94a3b8' }}>
                        {cls.agreed_price || cls.actual_income ? `₪${fmt(gross)}` : '—'}
                      </td>
                      <td style={{ padding:'10px 10px' }}>
                        <span style={{ background: pc + '20', color: pc, borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                          {pl}
                        </span>
                      </td>
                      <td style={{ padding:'10px 10px' }}>
                        {cls.status && (
                          <span style={{
                            background: cls.status==='פעיל'?'#dcfce7':cls.status==='ממתין'?'#fef3c7':cls.status==='הושלם'?'#dbeafe':'#fee2e2',
                            color: cls.status==='פעיל'?'#166534':cls.status==='ממתין'?'#92400e':cls.status==='הושלם'?'#1d4ed8':'#dc2626',
                            borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:600,
                          }}>{cls.status}</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 8px' }}>
                        <button
                          onClick={() => setModal({ cls })}
                          style={{ padding:'5px 12px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#64748b', fontWeight:600 }}>
                          ✏️ ערוך
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ClassModal
          cls={modal.cls}
          instructors={instructors}
          contacts={contacts}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDel={handleDelete}
        />
      )}

      {/* Import Modal */}
      {importing && (
        <ClassImportModal
          onClose={() => setImporting(false)}
          onAdd={onAdd}
        />
      )}
    </div>
  )
}
