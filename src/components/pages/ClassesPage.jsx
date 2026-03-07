import { useState, useMemo, useRef, useCallback } from 'react'
import { exportClassesCSV } from '../../utils/csv'
import { toast_ok, toast_err } from '../Toast'
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

// ── 1) Client color system ─────────────────────────────────────────────────
const CLIENT_PALETTE = [
  '#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#e11d48','#a855f7','#0ea5e9','#d946ef',
  '#22c55e','#eab308','#64748b','#be185d','#7c3aed',
]
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function getClientColor(name) {
  if (!name) return '#94a3b8'
  return CLIENT_PALETTE[hashStr(name) % CLIENT_PALETTE.length]
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
  // instructor_total_override: fixed instructor cost overrides hourly calc
  const hasOverride    = cls.instructor_total_override != null && cls.instructor_total_override !== '' && cls.instructor_total_override !== 0
  const instrMonthly   = hasOverride ? Number(cls.instructor_total_override) : instrHourly * monthlyHours
  const profitability  = totalProfit - instrMonthly
  return { students, pricePerChild, monthlyPayment, overheadPct, totalProfit, instrHourly, monthlyHours, instrMonthly, profitability, hasOverride }
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
    instructor_total_override: '',
    overhead_pct: 70, monthly_hours: 4,
    agreed_price: '', price_per_student: '', price_per_session: '',
    actual_income: '', payment_date: '', payment_method: '', invoice_number: '',
    paid: false,
    status: 'פעיל', responsible: '', notes: '',
  }
}

// ── Grouping helper ─────────────────────────────────────────────────────────
function groupKey(cls) {
  return `${cls.contact_name || ''}|${cls.location || ''}|${cls.subject || ''}`
}

function sortAndGroup(arr) {
  const sorted = [...arr].sort((a, b) => {
    const cmp = (x, y) => (x || '').localeCompare(y || '', 'he')
    return cmp(a.contact_name, b.contact_name)
      || cmp(a.location, b.location)
      || cmp(a.subject, b.subject)
      || cmp(a.day, b.day)
      || cmp(a.time_start, b.time_start)
  })
  return sorted
}

// ── TruncCell — cell with ellipsis + tooltip ────────────────────────────────
function TruncCell({ children, style, width, align, bold, color, className }) {
  const baseStyle = {
    maxWidth: width || 'auto',
    minWidth: width ? Math.min(width, 60) : 'auto',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: align || 'right',
    fontWeight: bold ? 700 : 'normal',
    color: color || 'inherit',
    padding: '8px 8px',
    ...style,
  }
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : ''
  return <td style={baseStyle} title={text} className={className}>{children}</td>
}

// ── Inline edit cell ────────────────────────────────────────────────────────
function EditCell({ value, onChange, type, width, options, placeholder, min, max, step }) {
  const st = {
    width: '100%', padding: '4px 6px', fontSize: 12, fontFamily: 'inherit',
    border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--bg)',
    color: 'var(--text)', direction: 'rtl', outline: 'none', boxSizing: 'border-box',
  }
  if (options) {
    return (
      <td style={{ padding: '4px', width }}>
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={st}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
    )
  }
  return (
    <td style={{ padding: '4px', width }}>
      <input type={type || 'text'} value={value ?? ''} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder} min={min} max={max} step={step} style={st} />
    </td>
  )
}

// ── Group subtotal row ──────────────────────────────────────────────────────
function GroupSubtotalRow({ items, label }) {
  let totStudents = 0, totMonthly = 0, totProfit = 0, totInstrCost = 0, totProfitability = 0, totHours = 0
  for (const c of items) {
    const r = calcRow(c)
    totStudents      += r.students
    totMonthly       += r.monthlyPayment
    totProfit        += r.totalProfit
    totInstrCost     += r.instrMonthly
    totProfitability += r.profitability
    totHours         += r.monthlyHours
  }
  return (
    <tr className="cls-subtotal-row">
      <td className="cls-sticky-col"></td>
      <td colSpan={10} style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, color: 'var(--accent)' }}>
        סיכום: {label} ({items.length} חוגים, {totHours} שעות)
      </td>
      <td style={{ textAlign: 'center', fontWeight: 700 }}>{totStudents}</td>
      <td></td>
      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0ea5e9' }}>₪{fmt(totMonthly)}</td>
      <td></td>
      <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>₪{fmt(totProfit)}</td>
      <td></td>
      <td style={{ textAlign: 'center', fontWeight: 700, color: '#8b5cf6' }}>₪{fmt(totInstrCost)}</td>
      <td style={{ textAlign: 'center', fontWeight: 700, color: totProfitability >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(totProfitability)}</td>
    </tr>
  )
}

// ── ClassModal (kept for "new class" — inline edit used for existing) ──────
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

  const calc = calcRow(form)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ direction:'rtl' }}>
        <div className="mh">
          <h3>{cls ? 'עריכת חוג' : 'חוג / קורס חדש'}</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
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
          {tab === 'basic' && (
            <>
              <div style={GRP}>
                <div><label style={LBL}>לקוח משלם</label><input value={form.contact_name} onChange={f('contact_name')} placeholder="שם הלקוח / רשת" style={INP}/></div>
                <div><label style={LBL}>יישוב</label><input value={form.city} onChange={f('city')} placeholder="עיר / יישוב" style={INP}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>רכזת</label><input value={form.coordinator || ''} onChange={f('coordinator')} placeholder="שם רכזת" style={INP}/></div>
                <div><label style={LBL}>מתנ"ס / בי"ס</label><input value={form.location} onChange={f('location')} placeholder="שם המוסד" style={INP}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>מיקום (תת-מיקום)</label><input value={form.class_name} onChange={f('class_name')} placeholder="פירוט מיקום / שם חוג" style={INP}/></div>
                <div><label style={LBL}>סוג פעילות</label>
                  <select value={form.activity_type} onChange={f('activity_type')} style={INP}>{ACT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                </div>
              </div>
              <div style={GRP3}>
                <div><label style={LBL}>יום</label><select value={form.day} onChange={f('day')} style={INP}>{DAYS_HE.map(d => <option key={d}>{d}</option>)}</select></div>
                <div><label style={LBL}>שעה</label><input type="time" value={form.time_start} onChange={f('time_start')} style={INP}/></div>
                <div><label style={LBL}>נושא</label><input value={form.subject || ''} onChange={f('subject')} placeholder="נושא הפעילות" style={INP}/></div>
              </div>
              <div style={GRP3}>
                <div><label style={LBL}>כיתה / שכבה</label><input value={form.grades} onChange={f('grades')} placeholder="א-ב, ג..." style={INP}/></div>
                <div><label style={LBL}>מדריך</label>
                  <select value={form.instructor_id} onChange={f('instructor_id')} style={INP}>
                    <option value="">ללא</option>
                    {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div><label style={LBL}>מנות ילדים</label><input type="number" min="0" value={form.students_count} onChange={fn('students_count')} style={INP}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>שנה</label><select value={form.year} onChange={fn('year')} style={INP}>{[CUR_YEAR-1, CUR_YEAR, CUR_YEAR+1].map(y => <option key={y}>{y}</option>)}</select></div>
                <div><label style={LBL}>חודש</label><select value={form.month} onChange={fn('month')} style={INP}>{MONTHS_HE.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}</select></div>
              </div>
            </>
          )}
          {tab === 'finance' && (
            <>
              <div style={{ background:'#fff7ed', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400e', fontWeight:600 }}>💰 תמחור והכנסות</div>
              <div style={GRP3}>
                <div><label style={LBL}>תשלום פר ילד חודשי (₪)</label><input type="number" min="0" value={form.price_per_student} onChange={fn('price_per_student')} placeholder="0" style={INP}/></div>
                <div><label style={LBL}>אחוז תקורה (%)</label><input type="number" min="0" max="100" value={form.overhead_pct ?? 70} onChange={fn('overhead_pct')} placeholder="70" style={INP}/></div>
                <div><label style={LBL}>מחיר סוכם (₪)</label><input type="number" min="0" value={form.agreed_price} onChange={fn('agreed_price')} placeholder="0" style={INP}/></div>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, textAlign:'center' }}>
                <div><div style={{ fontSize:16, fontWeight:800, color:'#0ea5e9' }}>₪{fmt(calc.monthlyPayment)}</div><div style={{ fontSize:10, color:'var(--muted)' }}>תשלום החודש</div></div>
                <div><div style={{ fontSize:16, fontWeight:800, color:'#10b981' }}>₪{fmt(calc.totalProfit)}</div><div style={{ fontSize:10, color:'var(--muted)' }}>סה"כ רווח</div></div>
                <div><div style={{ fontSize:16, fontWeight:800, color: calc.profitability >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(calc.profitability)}</div><div style={{ fontSize:10, color:'var(--muted)' }}>רווחיות חוג</div></div>
              </div>
              <div style={{ background:'#fdf4ff', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#6b21a8', fontWeight:600 }}>👨‍🏫 עלות מדריך</div>
              <div style={GRP3}>
                <div><label style={LBL}>עלות מדריך לשעה (₪)</label><input type="number" min="0" value={form.instructor_price_per_session} onChange={fn('instructor_price_per_session')} placeholder="0" style={INP}/></div>
                <div><label style={LBL}>שעות חודשיות</label><input type="number" min="0" value={form.monthly_hours ?? 4} onChange={fn('monthly_hours')} placeholder="4" style={INP}/></div>
                <div><label style={LBL}>עלות מדריך קבועה (₪)</label><input type="number" min="0" value={form.instructor_total_override ?? ''} onChange={fn('instructor_total_override')} placeholder="עוקף חישוב" style={INP}/></div>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>עלות מדריך לחודש:</span>
                <span style={{ fontSize:16, fontWeight:700, color:'#8b5cf6' }}>₪{fmt(calc.instrMonthly)}</span>
                {calc.hasOverride && <span style={{ fontSize:10, color:'#f59e0b', fontWeight:600 }}>(סכום קבוע)</span>}
              </div>
              <div style={{ background:'#f0f9ff', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#0c4a6e', fontWeight:600 }}>🏦 תשלום בפועל</div>
              <div style={GRP}>
                <div><label style={LBL}>הכנסה בפועל (₪)</label><input type="number" min="0" value={form.actual_income} onChange={fn('actual_income')} placeholder="0" style={INP}/></div>
                <div><label style={LBL}>אמצעי תשלום</label><select value={form.payment_method} onChange={f('payment_method')} style={INP}><option value="">בחר...</option>{PAY_METHOD.map(m => <option key={m}>{m}</option>)}</select></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>חשבונית</label><input value={form.invoice_number} onChange={f('invoice_number')} placeholder="מספר חשבונית" style={INP}/></div>
                <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:20 }}>
                  <input type="checkbox" id="paid_cb" checked={!!form.paid} onChange={fb('paid')} style={{ width:18, height:18, cursor:'pointer' }}/>
                  <label htmlFor="paid_cb" style={{ fontSize:14, fontWeight:600, color: form.paid ? '#10b981' : 'var(--muted)', cursor:'pointer' }}>{form.paid ? '✓ שולם במלואו' : 'סמן כשולם'}</label>
                </div>
              </div>
            </>
          )}
          {tab === 'manage' && (
            <>
              <div style={GRP}>
                <div><label style={LBL}>סטטוס</label><select value={form.status} onChange={f('status')} style={INP}>{STATUS_OPT.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label style={LBL}>אחראי</label><input value={form.responsible} onChange={f('responsible')} placeholder="שם אחראי" style={INP}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>טלפון איש קשר</label><input value={form.contact_phone} onChange={f('contact_phone')} placeholder="050-..." style={INP}/></div>
                <div><label style={LBL}>קישור CRM</label>
                  <select value={form.contact_id} onChange={f('contact_id')} style={INP}><option value="">ללא קישור</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
              </div>
              <div><label style={LBL}>הערות</label><textarea value={form.notes} onChange={f('notes')} placeholder="הערות נוספות..." rows={3} style={{ ...INP, resize:'vertical' }}/></div>
            </>
          )}
          {err && <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'8px 12px', fontSize:13 }}>⚠️ {err}</div>}
          <div className="mf">
            <button type="submit" className="btn btn-p" disabled={saving}>{saving ? '...' : (cls ? 'שמור' : 'הוסף חוג')}</button>
            <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
            {cls && <button type="button" className="del-link" onClick={() => { if(window.confirm('למחוק חוג זה?')) onDel(cls.id) }}>מחק</button>}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Class Import Modal ───────────────────────────────────────────────────────
function ClassImportModal({ onClose, onAdd, onReload }) {
  const [step, setStep]   = useState('upload')
  const [rows, setRows]   = useState([])
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const fileRef           = useRef()

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: result => {
        if (!result.data?.length) { setError('הקובץ ריק'); return }
        const mapped = result.data.map(r => ({
          ...emptyClass(),
          class_name:                  r['מיקום']   || r['שם חוג'] || r['name'] || r['class_name'] || '',
          activity_type:               r['סוג']     || r['activity_type'] || 'חוג',
          location:                    r['מתנס/בי"ס'] || r['מתנ"ס/בי"ס'] || r['מוסד'] || r['location'] || '',
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
          overhead_pct:                Number(r['תקורה'] || r['תקורה%'] || 70),
          instructor_price_per_session:Number(r['עלות מדריך לשעה'] || 0),
          instructor_total_override:   r['עלות מדריך קבועה'] ? Number(r['עלות מדריך קבועה']) : '',
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
    setStep('importing')
    setError(null)
    let success = 0
    try {
      for (let i = 0; i < rows.length; i++) {
        await onAdd(rows[i])
        success++
        setProgress(Math.round(((i + 1) / rows.length) * 100))
      }
      if (onReload) await onReload()
      setStep('done')
    } catch (e) {
      setError(`יובאו ${success} מתוך ${rows.length}. שגיאה: ${e?.message || 'לא ידוע'}`)
      if (success > 0 && onReload) await onReload()
      setStep('preview')
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ direction:'rtl' }}>
        <div className="mh"><h3>ייבוא חוגים מ-CSV</h3><button className="mx" onClick={onClose}>×</button></div>
        <div className="mb">
          {step === 'upload' && (
            <div style={{ textAlign:'center', padding:24 }}>
              <p style={{ color:'var(--muted)', marginBottom:16, fontSize:13 }}>העלה קובץ CSV עם עמודות לפי טבלת האקסל</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display:'none' }}/>
              <button className="btn btn-p" onClick={() => fileRef.current?.click()}>📁 בחר קובץ</button>
              {error && <p style={{ color:'var(--danger)', marginTop:12 }}>{error}</p>}
            </div>
          )}
          {step === 'preview' && (
            <>
              <p style={{ marginBottom:12, fontSize:13, color:'var(--muted)' }}>נמצאו {rows.length} חוגים:</p>
              <div className="tbl-wrap" style={{ maxHeight:300 }}>
                <table><thead><tr><th>שם / מיקום</th><th>מוסד</th><th>עיר</th><th>סכום</th></tr></thead>
                  <tbody>{rows.slice(0,50).map((r,i) => (
                    <tr key={i}><td>{r.class_name || r.subject}</td><td>{r.location}</td><td>{r.city}</td><td>{r.agreed_price ? `₪${fmt(r.agreed_price)}` : '–'}</td></tr>
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
          {step === 'importing' && (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
              <p style={{ fontWeight:600, marginBottom:12 }}>מייבא חוגים... {progress}%</p>
              <div style={{ background:'var(--border)', borderRadius:8, height:8, overflow:'hidden' }}>
                <div style={{ background:'#f97316', height:'100%', width:`${progress}%`, transition:'width 0.3s' }}/>
              </div>
            </div>
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
// ── Main ClassesPage — Monthly Report ────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function ClassesPage({ classes, instructors, contacts, onAdd, onUpdate, onDelete, onDuplicate, onReload, finance }) {
  const [modal, setModal]         = useState(null)
  const [importing, setImporting] = useState(false)
  const [copyModal, setCopyModal] = useState(false)
  const [copyTargets, setCopyTargets] = useState([])
  const [search, setSearch]       = useState('')
  const [filterCity, setFilterCity]         = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterPaid, setFilterPaid]         = useState('')
  const [filterInstructor, setFilterInstructor] = useState('')
  const [filterSubject, setFilterSubject]   = useState('')
  // Month/Year — mandatory monthly report
  const [filterMonth, setFilterMonth]       = useState(CUR_MONTH)
  const [filterYear, setFilterYear]         = useState(CUR_YEAR)
  // Multi-select
  const [selected, setSelected]   = useState(new Set())
  const [deleting, setDeleting]   = useState(false)
  // Inline editing
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})
  // Drag-to-scroll
  const scrollRef = useRef(null)
  const [scrollHint, setScrollHint] = useState(true)
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 })
  const onMouseDown = e => {
    if (e.target.closest('input,select,button,.cls-action-btn')) return
    const el = scrollRef.current; if (!el) return
    dragState.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
  }
  const onMouseUp = () => { dragState.current.isDown = false; if (scrollRef.current) scrollRef.current.style.cursor = 'grab' }
  const onMouseMove = e => {
    if (!dragState.current.isDown) return; e.preventDefault()
    const el = scrollRef.current; if (!el) return
    const x = e.pageX - el.offsetLeft
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX)
    if (scrollHint) setScrollHint(false)
  }
  const onScroll = () => { if (scrollHint) setScrollHint(false) }
  const [saving, setSaving]       = useState(false)

  const cities = useMemo(() => [...new Set(classes.map(c => c.city).filter(Boolean))].sort(), [classes])
  const subjects = useMemo(() => [...new Set(classes.map(c => c.subject).filter(Boolean))].sort(), [classes])
  const instrList = useMemo(() => [...new Set(classes.map(c => c.instructors?.name || '').filter(Boolean))].sort(), [classes])

  // Filter by month/year first (mandatory), then other filters
  const filtered = useMemo(() => {
    let arr = classes.filter(c => Number(c.month) === filterMonth && Number(c.year) === filterYear)
    if (search)           arr = arr.filter(c => [c.class_name, c.location, c.city, c.contact_name, c.subject, c.coordinator].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    if (filterCity)       arr = arr.filter(c => c.city === filterCity)
    if (filterStatus)     arr = arr.filter(c => c.status === filterStatus)
    if (filterInstructor) arr = arr.filter(c => (c.instructors?.name || '') === filterInstructor)
    if (filterSubject)    arr = arr.filter(c => c.subject === filterSubject)
    if (filterPaid === 'paid')    arr = arr.filter(c => c.paid)
    if (filterPaid === 'partial') arr = arr.filter(c => !c.paid && (c.actual_income || 0) > 0)
    if (filterPaid === 'unpaid')  arr = arr.filter(c => !c.paid && !(c.actual_income > 0) && (c.agreed_price > 0))
    return sortAndGroup(arr)
  }, [classes, search, filterCity, filterStatus, filterPaid, filterInstructor, filterSubject, filterMonth, filterYear])

  // Build grouped items for subtotals
  const groupedItems = useMemo(() => {
    const groups = []
    let currentKey = null
    let currentGroup = []
    for (const cls of filtered) {
      const key = groupKey(cls)
      if (key !== currentKey) {
        if (currentGroup.length > 0) groups.push({ key: currentKey, items: currentGroup })
        currentKey = key
        currentGroup = [cls]
      } else {
        currentGroup.push(cls)
      }
    }
    if (currentGroup.length > 0) groups.push({ key: currentKey, items: currentGroup })
    return groups
  }, [filtered])

  // Stats for KPI cards — uses filtered (monthly) data
  const stats = useMemo(() => {
    let totalMonthly = 0, totalProfit = 0, totalInstrCost = 0, totalProfitability = 0
    for (const c of filtered) {
      const r = calcRow(c)
      totalMonthly       += r.monthlyPayment
      totalProfit        += r.totalProfit
      totalInstrCost     += r.instrMonthly
      totalProfitability += r.profitability
    }
    return {
      count: filtered.length,
      totalMonthly, totalProfit, totalInstrCost, totalProfitability,
      totalStudents: filtered.reduce((s, c) => s + (Number(c.students_count) || 0), 0),
    }
  }, [filtered])

  const handleSave = async form => {
    if (modal?.cls) await onUpdate(modal.cls.id, form)
    else            await onAdd(form)
  }
  const handleDelete = async id => { await onDelete(id); setModal(null) }

  // Inline edit handlers
  const startEdit = useCallback((cls) => {
    setEditingId(cls.id)
    setEditForm({ ...cls })
  }, [])
  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({})
  }, [])
  const updateField = useCallback((key, val) => {
    setEditForm(prev => ({ ...prev, [key]: val }))
  }, [])
  const saveInlineEdit = useCallback(async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await onUpdate(editingId, editForm)
      setEditingId(null)
      setEditForm({})
    } catch (e) {
      toast_err('שגיאה בשמירה: ' + (e?.message || ''))
    } finally {
      setSaving(false)
    }
  }, [editingId, editForm, onUpdate])

  // Selection handlers
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.id)))
  }, [filtered, selected.size])
  const bulkDelete = async () => {
    if (!window.confirm(`למחוק ${selected.size} חוגים?`)) return
    setDeleting(true)
    for (const id of selected) { try { await onDelete(id) } catch {} }
    setSelected(new Set())
    setDeleting(false)
  }
  // Duplicate selected classes
  const bulkDuplicate = async () => {
    if (!onDuplicate) return
    const toDup = filtered.filter(c => selected.has(c.id))
    if (!window.confirm(`לשכפל ${toDup.length} חוגים?`)) return
    setSaving(true)
    for (const cls of toDup) {
      try { await onDuplicate(cls) } catch (e) { console.error('dup error', e) }
    }
    setSelected(new Set())
    setSaving(false)
    if (onReload) await onReload()
  }

  // Copy current month's classes to other months
  const copyToMonths = async () => {
    if (!copyTargets.length) return
    const source = filtered
    if (!source.length) { toast_err('אין חוגים בחודש הנוכחי לשכפול'); setCopyModal(false); return }
    // Check which targets already have classes
    const existingMonths = copyTargets.filter(t =>
      classes.some(c => Number(c.month) === t.month && Number(c.year) === t.year)
    )
    const msg = existingMonths.length
      ? `לשכפל ${source.length} חוגים ל-${copyTargets.length} חודשים?\n⚠ ${existingMonths.length} חודשים כבר מכילים חוגים — ייווצרו כפילויות`
      : `לשכפל ${source.length} חוגים ל-${copyTargets.length} חודשים?`
    if (!window.confirm(msg)) return
    setSaving(true)
    let count = 0
    for (const target of copyTargets) {
      for (const cls of source) {
        const copy = { ...cls }
        delete copy.id; delete copy.created_at; delete copy.updated_at
        delete copy.instructors; delete copy.linked_payment_id; delete copy.owner_id
        copy.month = target.month
        copy.year = target.year
        // Reset payment fields for new month
        copy.paid = false; copy.payment_date = ''; copy.invoice_number = ''; copy.actual_income = ''
        try { await onAdd(copy); count++ } catch (e) { console.error('copy error', e) }
      }
    }
    setSaving(false)
    setCopyModal(false)
    setCopyTargets([])
    if (onReload) await onReload()
    toast_ok(`שוכפלו ${count} חוגים בהצלחה`)
  }

  const toggleCopyTarget = (m, y) => {
    setCopyTargets(prev => {
      const exists = prev.find(t => t.month === m && t.year === y)
      if (exists) return prev.filter(t => !(t.month === m && t.year === y))
      return [...prev, { month: m, year: y }]
    })
  }

  const clearFilters = () => { setFilterCity(''); setFilterStatus(''); setFilterPaid(''); setSearch(''); setFilterInstructor(''); setFilterSubject('') }
  const hasFilters = filterCity || filterStatus || filterPaid || search || filterInstructor || filterSubject

  // Navigate months
  const prevMonth = () => {
    if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1) }
    else setFilterMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1) }
    else setFilterMonth(m => m + 1)
  }

  return (
    <>
      <div className="ph">
        <h2>📊 דוח חוגים חודשי</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-o btn-sm" onClick={() => exportClassesCSV(filtered)}>📥 ייצוא CSV</button>
          <button className="btn btn-o btn-sm" onClick={() => setImporting(true)}>📤 ייבוא</button>
          {filtered.length > 0 && <button className="btn btn-o btn-sm" onClick={() => { setCopyTargets([]); setCopyModal(true) }}>📋 העתק לחודשים</button>}
          <button className="btn btn-p btn-sm" onClick={() => setModal({ cls: null })}>+ הוסף חוג</button>
        </div>
      </div>

      <div className="pb">
        {/* Month/Year Navigation */}
        <div className="card" style={{ padding:'12px 18px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:16 }}>
          <button className="btn btn-o btn-sm" onClick={prevMonth} style={{ fontSize:18, padding:'4px 12px' }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
              style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, fontWeight:700, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)' }}>
              {MONTHS_HE.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, fontWeight:700, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}>
              {[CUR_YEAR-2, CUR_YEAR-1, CUR_YEAR, CUR_YEAR+1].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn-o btn-sm" onClick={nextMonth} style={{ fontSize:18, padding:'4px 12px' }}>›</button>
          <button className="btn btn-o btn-sm" onClick={() => { setFilterMonth(CUR_MONTH); setFilterYear(CUR_YEAR) }}
            style={{ marginRight:8, fontSize:11 }}>החודש</button>
        </div>

        {/* KPI Cards — monthly */}
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:16 }}>
          {[
            { label:'חוגים',          val: stats.count,                   color:'#0ea5e9', icon:'🏫' },
            { label:'תלמידים',        val: stats.totalStudents,            color:'#8b5cf6', icon:'👨‍🎓' },
            { label:'הכנסות חודשיות',  val: `₪${fmt(stats.totalMonthly)}`,  color:'#10b981', icon:'💰' },
            { label:'עלות מדריכים',    val: `₪${fmt(stats.totalInstrCost)}`, color:'#f59e0b', icon:'👨‍🏫' },
            { label:'רווחיות כוללת',   val: `₪${fmt(stats.totalProfitability)}`, color: stats.totalProfitability >= 0 ? '#10b981' : '#ef4444', icon:'📊' },
          ].map((k, i) => (
            <div key={i} className="stat-card" style={{ textAlign:'center', padding:'14px 10px' }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{k.icon}</div>
              <div style={{ fontSize:18, fontWeight:800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Bulk actions toolbar */}
        {selected.size > 0 && (
          <div className="cls-bulk-bar">
            <span>נבחרו {selected.size} חוגים</span>
            <button className="btn btn-sm" onClick={bulkDuplicate} disabled={saving}
              style={{ background:'#0ea5e9', color:'#fff', border:'none' }}>
              {saving ? '...משכפל' : '📋 שכפל'}
            </button>
            <button className="btn btn-sm" onClick={bulkDelete} disabled={deleting}
              style={{ background:'#ef4444', color:'#fff', border:'none' }}>
              {deleting ? '...מוחק' : '🗑️ מחיקה'}
            </button>
            <button className="btn btn-o btn-sm" onClick={() => setSelected(new Set())}>✕ בטל</button>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding:'10px 14px', marginBottom:14, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש..."
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)', minWidth:140, flex:1 }}/>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל הערים</option>{cities.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל המדריכים</option>{instrList.map(n => <option key={n}>{n}</option>)}
          </select>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', direction:'rtl', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל הנושאים</option>{subjects.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל הסטטוסים</option>{STATUS_OPT.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterPaid} onChange={e => setFilterPaid(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}>
            <option value="">כל התשלומים</option>
            <option value="paid">שולם</option><option value="partial">חלקי</option><option value="unpaid">ממתין</option>
          </select>
          {hasFilters && <button className="btn btn-o btn-sm" onClick={clearFilters} style={{ color:'var(--danger)' }}>× נקה</button>}
          <span style={{ fontSize:12, color:'var(--muted)', marginRight:'auto' }}>{filtered.length} חוגים</span>
        </div>

        {/* Main Table */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding:'60px 20px', textAlign:'center' }}>
            <div className="empty">
              <div className="empty-ico">🏫</div>
              <p>אין חוגים ב{MONTHS_HE[filterMonth - 1]} {filterYear}</p>
              <button className="btn btn-p" onClick={() => setModal({ cls: null })} style={{ marginTop:12 }}>+ הוסף חוג</button>
            </div>
          </div>
        ) : (
          <div className="card cls-table-card">
            {scrollHint && <div className="cls-scroll-hint">← גלול ימינה ושמאלה לעוד עמודות →</div>}
            <div className="cls-table-scroll" ref={scrollRef}
              onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onMouseMove={onMouseMove} onScroll={onScroll}>
              <table className="cls-table">
                <thead>
                  <tr>
                    <th className="cls-col-actions cls-sticky-col">
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} style={{ cursor:'pointer' }}/>
                    </th>
                    <th className="cls-col-client">לקוח משלם</th>
                    <th className="cls-col-sm">יישוב</th>
                    <th className="cls-col-sm">רכזת</th>
                    <th className="cls-col-md">מתנ"ס / בי"ס</th>
                    <th className="cls-col-md">מיקום</th>
                    <th className="cls-col-xs">יום</th>
                    <th className="cls-col-xs">שעה</th>
                    <th className="cls-col-sm">נושא</th>
                    <th className="cls-col-xs">כיתה</th>
                    <th className="cls-col-sm">מדריך</th>
                    <th className="cls-col-num">מנות<br/>ילדים</th>
                    <th className="cls-col-num">תשלום<br/>פר ילד</th>
                    <th className="cls-col-num">תשלום<br/>החודש</th>
                    <th className="cls-col-num">תקורה</th>
                    <th className="cls-col-num">סה"כ<br/>רווח</th>
                    <th className="cls-col-num">עלות מדריך<br/>לשעה</th>
                    <th className="cls-col-num">עלות מדריך<br/>לחודש</th>
                    <th className="cls-col-num">רווחיות<br/>חוג</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((group) => {
                    const groupLabel = group.items[0]?.contact_name || group.items[0]?.location || '—'
                    const rows = []

                    group.items.forEach((cls, idxInGroup) => {
                      const isEditing = editingId === cls.id
                      const r   = isEditing ? calcRow(editForm) : calcRow(cls)
                      const instrName = cls.instructors?.name || (instructors.find(x => x.id === cls.instructor_id)?.name) || '—'
                      const clientClr = getClientColor(cls.contact_name)
                      const isNewGroup = idxInGroup === 0

                      if (isEditing) {
                        // ── Inline edit row ──
                        rows.push(
                          <tr key={cls.id} className={`cls-row cls-editing ${isNewGroup ? 'cls-group-start' : ''}`}
                            style={{ borderRight: `5px solid ${clientClr}` }}>
                            <td className="cls-col-actions cls-sticky-col" onClick={e => e.stopPropagation()}>
                              <div className="cls-actions-cell">
                                <button className="cls-action-btn" onClick={saveInlineEdit} disabled={saving} title="שמור"
                                  style={{ color:'#10b981', opacity:1, fontWeight:700 }}>✓</button>
                                <button className="cls-action-btn" onClick={cancelEdit} title="ביטול"
                                  style={{ color:'#ef4444', opacity:1 }}>✕</button>
                              </div>
                            </td>
                            <EditCell value={editForm.contact_name} onChange={v => updateField('contact_name', v)} width={130} placeholder="לקוח" />
                            <EditCell value={editForm.city} onChange={v => updateField('city', v)} width={80} placeholder="עיר" />
                            <EditCell value={editForm.coordinator} onChange={v => updateField('coordinator', v)} width={80} placeholder="רכזת" />
                            <EditCell value={editForm.location} onChange={v => updateField('location', v)} width={130} placeholder="מוסד" />
                            <EditCell value={editForm.class_name} onChange={v => updateField('class_name', v)} width={120} placeholder="מיקום" />
                            <EditCell value={editForm.day} onChange={v => updateField('day', v)} width={55} options={DAYS_HE} />
                            <EditCell value={editForm.time_start} onChange={v => updateField('time_start', v)} width={55} type="time" />
                            <EditCell value={editForm.subject} onChange={v => updateField('subject', v)} width={80} placeholder="נושא" />
                            <EditCell value={editForm.grades} onChange={v => updateField('grades', v)} width={55} placeholder="כיתה" />
                            <td style={{ padding:4, width:90 }}>
                              <select value={editForm.instructor_id || ''} onChange={e => updateField('instructor_id', e.target.value)}
                                style={{ width:'100%', padding:'4px 4px', fontSize:11, fontFamily:'inherit', border:'1px solid var(--accent)', borderRadius:4, background:'var(--bg)', color:'var(--text)', direction:'rtl' }}>
                                <option value="">ללא</option>
                                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                            </td>
                            <EditCell value={editForm.students_count} onChange={v => updateField('students_count', v)} width={55} type="number" min={0} />
                            <EditCell value={editForm.price_per_student} onChange={v => updateField('price_per_student', v)} width={70} type="number" min={0} />
                            <TruncCell width={80} align="center" bold color="#0ea5e9">{r.monthlyPayment ? `₪${fmt(r.monthlyPayment)}` : '—'}</TruncCell>
                            <EditCell value={editForm.overhead_pct ?? 70} onChange={v => updateField('overhead_pct', v)} width={55} type="number" min={0} max={100} />
                            <TruncCell width={80} align="center" bold color="#10b981">{r.totalProfit ? `₪${fmt(r.totalProfit)}` : '—'}</TruncCell>
                            <EditCell value={editForm.instructor_price_per_session} onChange={v => updateField('instructor_price_per_session', v)} width={70} type="number" min={0} />
                            <TruncCell width={80} align="center" color="#8b5cf6" bold>
                              {r.instrMonthly ? `₪${fmt(r.instrMonthly)}` : '—'}
                              {r.hasOverride && <span style={{ fontSize:8, color:'#f59e0b' }}> *</span>}
                            </TruncCell>
                            <TruncCell width={80} align="center" bold
                              color={r.profitability >= 0 ? '#10b981' : '#ef4444'}>
                              {(r.monthlyPayment || r.instrMonthly) ? `₪${fmt(r.profitability)}` : '—'}
                            </TruncCell>
                          </tr>
                        )
                      } else {
                        // ── Normal display row ──
                        rows.push(
                          <tr key={cls.id}
                            className={`cls-row ${isNewGroup ? 'cls-group-start' : ''} ${selected.has(cls.id) ? 'cls-selected' : ''}`}
                            style={{ borderRight: `5px solid ${clientClr}` }}
                            onDoubleClick={() => startEdit(cls)}>
                            <td className="cls-col-actions cls-sticky-col" onClick={e => e.stopPropagation()}>
                              <div className="cls-actions-cell">
                                <input type="checkbox" checked={selected.has(cls.id)}
                                  onChange={() => toggleSelect(cls.id)} style={{ cursor:'pointer' }}/>
                                <button className="cls-action-btn" onClick={() => startEdit(cls)} title="עריכה">✏️</button>
                                <button className="cls-action-btn cls-action-del" onClick={() => {
                                  if(window.confirm('למחוק חוג זה?')) handleDelete(cls.id)
                                }} title="מחיקה">🗑️</button>
                              </div>
                            </td>
                            <TruncCell width={130} bold color={clientClr}>{cls.contact_name || '—'}</TruncCell>
                            <TruncCell width={80}>{cls.city || '—'}</TruncCell>
                            <TruncCell width={80}>{cls.coordinator || '—'}</TruncCell>
                            <TruncCell width={130}>{cls.location || '—'}</TruncCell>
                            <TruncCell width={120}>
                              {cls.class_name || '—'}
                              {cls.activity_type && <span style={{ fontSize:9, color:'var(--muted)', marginRight:4 }}>({cls.activity_type})</span>}
                            </TruncCell>
                            <TruncCell width={55} align="center">{cls.day || '—'}</TruncCell>
                            <TruncCell width={55} align="center">{cls.time_start || '—'}</TruncCell>
                            <TruncCell width={80}>{cls.subject || '—'}</TruncCell>
                            <TruncCell width={55} align="center">{cls.grades || '—'}</TruncCell>
                            <TruncCell width={90}>{instrName}</TruncCell>
                            <TruncCell width={55} align="center" bold>{r.students || '—'}</TruncCell>
                            <TruncCell width={70} align="center">{r.pricePerChild ? `₪${fmt(r.pricePerChild)}` : '—'}</TruncCell>
                            <TruncCell width={80} align="center" bold color="#0ea5e9">{r.monthlyPayment ? `₪${fmt(r.monthlyPayment)}` : '—'}</TruncCell>
                            <TruncCell width={55} align="center">{r.overheadPct ? `${r.overheadPct}%` : '—'}</TruncCell>
                            <TruncCell width={80} align="center" bold color="#10b981">{r.totalProfit ? `₪${fmt(r.totalProfit)}` : '—'}</TruncCell>
                            <TruncCell width={70} align="center">{r.instrHourly ? `₪${fmt(r.instrHourly)}` : '—'}</TruncCell>
                            <TruncCell width={80} align="center" color="#8b5cf6" bold>
                              {r.instrMonthly ? `₪${fmt(r.instrMonthly)}` : '—'}
                              {r.hasOverride && <span style={{ fontSize:8, color:'#f59e0b' }}> *</span>}
                            </TruncCell>
                            <TruncCell width={80} align="center" bold
                              color={r.profitability >= 0 ? '#10b981' : '#ef4444'}>
                              {(r.monthlyPayment || r.instrMonthly) ? `₪${fmt(r.profitability)}` : '—'}
                            </TruncCell>
                          </tr>
                        )
                      }
                    })

                    // Add group subtotal after each group (only if more than 1 group)
                    if (groupedItems.length > 1 && group.items.length >= 1) {
                      rows.push(
                        <GroupSubtotalRow key={`sub-${group.key}`} items={group.items} label={groupLabel} />
                      )
                    }

                    return rows
                  })}
                </tbody>
                <tfoot>
                  <tr className="cls-totals-row">
                    <td className="cls-sticky-col"></td>
                    <td colSpan={10} style={{ textAlign:'right', fontWeight:700 }}>
                      סה"כ — {MONTHS_HE[filterMonth - 1]} {filterYear}
                    </td>
                    <td style={{ textAlign:'center', fontWeight:700 }}>{stats.totalStudents}</td>
                    <td></td>
                    <td style={{ textAlign:'center', fontWeight:700, color:'#0ea5e9' }}>₪{fmt(stats.totalMonthly)}</td>
                    <td></td>
                    <td style={{ textAlign:'center', fontWeight:700, color:'#10b981' }}>₪{fmt(stats.totalProfit)}</td>
                    <td></td>
                    <td style={{ textAlign:'center', fontWeight:700, color:'#8b5cf6' }}>₪{fmt(stats.totalInstrCost)}</td>
                    <td style={{ textAlign:'center', fontWeight:800, color: stats.totalProfitability >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(stats.totalProfitability)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <ClassModal cls={modal.cls} instructors={instructors} contacts={contacts}
          onSave={handleSave} onClose={() => setModal(null)} onDel={handleDelete}/>
      )}
      {importing && (
        <ClassImportModal onClose={() => setImporting(false)} onAdd={onAdd} onReload={onReload}/>
      )}
      {/* ── Copy to Months Modal ──────────────────────────── */}
      {copyModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setCopyModal(false)}>
          <div className="modal" style={{ direction:'rtl', maxWidth:420 }}>
            <div className="mh">
              <h3>📋 העתק חוגים לחודשים</h3>
              <button className="mx" onClick={() => setCopyModal(false)}>×</button>
            </div>
            <div className="mb" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ background:'var(--bg)', padding:'10px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:13 }}>
                מעתיק <strong>{filtered.length} חוגים</strong> מ-<strong>{MONTHS_HE[filterMonth - 1]} {filterYear}</strong>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>פרטי תשלום (שולם, תאריך תשלום, חשבונית) יאופסו בחודשים החדשים</div>
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)' }}>בחר חודשי יעד:</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1, y = filterYear
                  const isCurrent = m === filterMonth && y === filterYear
                  const hasData = classes.some(c => Number(c.month) === m && Number(c.year) === y)
                  const isSelected = copyTargets.some(t => t.month === m && t.year === y)
                  return (
                    <button key={m} disabled={isCurrent} onClick={() => toggleCopyTarget(m, y)}
                      style={{
                        padding:'8px 6px', borderRadius:8, fontSize:12, fontWeight:600, cursor: isCurrent ? 'not-allowed' : 'pointer',
                        border: isSelected ? '2px solid #f97316' : '1px solid var(--border)',
                        background: isCurrent ? 'var(--border)' : isSelected ? '#fff7ed' : 'var(--bg)',
                        color: isCurrent ? 'var(--muted)' : isSelected ? '#f97316' : 'var(--text)',
                        opacity: isCurrent ? .5 : 1,
                        position: 'relative',
                      }}>
                      {MONTHS_HE[i]}
                      {hasData && !isCurrent && <span style={{ position:'absolute', top:2, left:4, fontSize:8, color:'#f59e0b' }} title="כבר מכיל חוגים">●</span>}
                    </button>
                  )
                })}
              </div>
              {/* Next year row */}
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', marginTop:4 }}>{filterYear + 1}:</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {Array.from({ length: 6 }, (_, i) => {
                  const m = i + 1, y = filterYear + 1
                  const hasData = classes.some(c => Number(c.month) === m && Number(c.year) === y)
                  const isSelected = copyTargets.some(t => t.month === m && t.year === y)
                  return (
                    <button key={`n${m}`} onClick={() => toggleCopyTarget(m, y)}
                      style={{
                        padding:'8px 6px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                        border: isSelected ? '2px solid #f97316' : '1px solid var(--border)',
                        background: isSelected ? '#fff7ed' : 'var(--bg)',
                        color: isSelected ? '#f97316' : 'var(--text)',
                        position: 'relative',
                      }}>
                      {MONTHS_HE[i]}
                      {hasData && <span style={{ position:'absolute', top:2, left:4, fontSize:8, color:'#f59e0b' }} title="כבר מכיל חוגים">●</span>}
                    </button>
                  )
                })}
              </div>
              <div className="mf">
                <button className="btn btn-p" disabled={!copyTargets.length || saving}
                  onClick={copyToMonths}>
                  {saving ? 'מעתיק...' : `העתק ל-${copyTargets.length || 0} חודשים`}
                </button>
                <button className="btn btn-o" onClick={() => setCopyModal(false)}>ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
