import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────
const DAYS_HE   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function dayName(d) {
  if (!d) return ''
  return 'יום ' + DAYS_HE[new Date(d + 'T12:00:00').getDay()]
}
function newRow() {
  return { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], location: '', hours: '' }
}
function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, sv]
}

const now = new Date()

const INP = {
  padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:7,
  fontSize:13, color:'#1e293b', background:'#f8fafc',
  outline:'none', fontFamily:'inherit', direction:'rtl', width:'100%', boxSizing:'border-box',
}
const CARD = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }

// ── Row ────────────────────────────────────────────────────────────────────
function ReportRow({ row, onChange, onDelete, canDelete }) {
  const f = k => e => onChange(row.id, k, e.target.value)
  return (
    <tr style={{ borderBottom:'1px solid #f1f5f9' }}>
      <td style={{ padding:'7px 6px' }}>
        <input type="date" value={row.date} onChange={f('date')} style={{ ...INP, width:138 }}/>
        {row.date && (
          <div style={{ fontSize:11, color:'#f97316', fontWeight:600, marginTop:2, textAlign:'center' }}>{dayName(row.date)}</div>
        )}
      </td>
      <td style={{ padding:'7px 6px' }}>
        <input value={row.location} onChange={f('location')} placeholder='שם בית ספר / מתנ"ס'
          style={{ ...INP, minWidth:155 }}/>
      </td>
      <td style={{ padding:'7px 6px', width:76 }}>
        <input type="number" value={row.hours} onChange={f('hours')}
          placeholder="2" min=".5" step=".5" style={{ ...INP, textAlign:'center' }}/>
      </td>
      <td style={{ padding:'7px 4px', textAlign:'center', width:32 }}>
        {canDelete && (
          <button onClick={() => onDelete(row.id)}
            style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14, padding:'2px 5px', borderRadius:5, lineHeight:1 }}>
            ✕
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Report Tab ─────────────────────────────────────────────────────────────
function ReportTab({ instructorId }) {
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const draftKey = `portal_draft_${instructorId}_${selYear}_${selMonth}`
  const [rows, setRows]     = useLS(draftKey, [newRow()])
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  const total      = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0)
  const updateRow  = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
  const deleteRow  = id => setRows(rs => rs.filter(r => r.id !== id))
  const addRow     = () => setRows(rs => [...rs, { ...newRow() }])

  const submit = async () => {
    const valid = rows.filter(r => r.location.trim() && Number(r.hours) > 0)
    if (!valid.length) { setErrMsg('יש למלא לפחות שורה אחת עם מיקום ושעות'); setStatus('error'); return }
    setStatus('saving'); setErrMsg('')
    try {
      const inserts = valid.map(r => ({
        instructor_id: instructorId,
        report_date:   r.date,
        hours:         Number(r.hours),
        location:      r.location.trim(),
        notes:         `דוח ${MONTHS_HE[selMonth]} ${selYear}`,
      }))
      const { error } = await supabase.from('hour_reports').insert(inserts)
      if (error) throw error
      localStorage.removeItem(draftKey)
      setRows([newRow()])
      setStatus('success')
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) { setErrMsg(e.message || 'שגיאה'); setStatus('error') }
  }

  return (
    <div>
      {/* Month selector */}
      <div style={{ display:'flex', gap:8, marginBottom:14, direction:'rtl' }}>
        <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={{ ...INP, flex:1 }}>
          {MONTHS_HE.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={{ ...INP, width:88 }}>
          {[selYear - 1, selYear, selYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ ...CARD, overflowX:'auto', marginBottom:12 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              <th style={{ padding:'9px 8px', textAlign:'right', fontSize:11, fontWeight:600, color:'#64748b' }}>תאריך</th>
              <th style={{ padding:'9px 8px', textAlign:'right', fontSize:11, fontWeight:600, color:'#64748b' }}>שם בית ספר / מתנ"ס</th>
              <th style={{ padding:'9px 8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#64748b' }}>שעות</th>
              <th style={{ width:32 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <ReportRow key={row.id} row={row} onChange={updateRow} onDelete={deleteRow} canDelete={rows.length > 1}/>
            ))}
          </tbody>
        </table>
        <div style={{ padding:'8px 8px', borderTop:'1px solid #f1f5f9' }}>
          <button onClick={addRow}
            style={{ width:'100%', background:'none', border:'1px dashed #cbd5e1', borderRadius:7, padding:'7px', color:'#64748b', cursor:'pointer', fontSize:13, fontFamily:'inherit', direction:'rtl', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#f97316'}
            onMouseLeave={e => e.currentTarget.style.borderColor='#cbd5e1'}>
            + הוסף שורה
          </button>
        </div>
      </div>

      {/* Totals + auto-save note */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, direction:'rtl', fontSize:13 }}>
        <span style={{ color:'#94a3b8', fontSize:11 }}>✏️ הטיוטה נשמרת אוטומטית</span>
        <span style={{ fontWeight:700, color:'#1e293b', fontSize:15 }}>
          סה"כ: <span style={{ color:'#f97316', fontSize:19 }}>{total}</span> שעות
        </span>
      </div>

      {status === 'error' && (
        <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, direction:'rtl' }}>⚠ {errMsg}</div>
      )}
      {status === 'success' && (
        <div style={{ background:'#d1fae5', color:'#065f46', borderRadius:8, padding:'12px 16px', marginBottom:12, fontSize:14, fontWeight:600, direction:'rtl', textAlign:'center' }}>
          ✅ הדוח נשלח בהצלחה עבור {MONTHS_HE[selMonth]} {selYear}!
        </div>
      )}

      <button onClick={submit} disabled={status === 'saving'} style={{
        width:'100%', padding:13, border:'none', borderRadius:10,
        background: status === 'saving' ? '#9ca3af' : 'linear-gradient(135deg,#f97316,#ea580c)',
        color:'#fff', fontSize:15, fontWeight:700,
        cursor: status === 'saving' ? 'default' : 'pointer', fontFamily:'inherit',
      }}>
        {status === 'saving' ? '⏳ שולח...' : `📤 שלח דוח ${MONTHS_HE[selMonth]} ${selYear}`}
      </button>
    </div>
  )
}

// ── History Tab ────────────────────────────────────────────────────────────
function HistoryTab({ instructorId }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('hour_reports').select('*')
      .eq('instructor_id', instructorId)
      .order('report_date', { ascending: false })
      .then(({ data }) => {
        const map = {}
        for (const r of (data || [])) {
          const d = new Date(r.report_date + 'T12:00:00')
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
          if (!map[key]) map[key] = { month: d.getMonth(), year: d.getFullYear(), rows: [] }
          map[key].rows.push(r)
        }
        setGroups(Object.entries(map).sort(([a],[b]) => b.localeCompare(a)).map(([,g]) => g))
        setLoading(false)
      })
  }, [instructorId])

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>טוען...</div>
  if (!groups.length) return (
    <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
      <p>אין היסטוריה עדיין. שלח את הדוח הראשון שלך!</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {groups.map((g, gi) => {
        const total = g.rows.reduce((s, r) => s + Number(r.hours), 0)
        return (
          <div key={gi} style={CARD}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', direction:'rtl' }}>
              <span style={{ fontWeight:700, fontSize:14, color:'#1e293b' }}>{MONTHS_HE[g.month]} {g.year}</span>
              <span style={{ fontWeight:700, color:'#f97316' }}>{total} שעות</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <tbody>
                {g.rows.map(r => (
                  <tr key={r.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'8px 14px', color:'#64748b', minWidth:95 }}>{r.report_date}</td>
                    <td style={{ padding:'8px 14px', color:'#1e293b' }}>{r.location || '—'}</td>
                    <td style={{ padding:'8px 14px', fontWeight:600, textAlign:'center', width:55 }}>{r.hours}ש׳</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ── Payslips Tab ───────────────────────────────────────────────────────────
function PayslipsTab({ instructorId }) {
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('payslips').select('*')
      .eq('instructor_id', instructorId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .then(({ data }) => { setPayslips(data || []); setLoading(false) })
  }, [instructorId])

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>טוען...</div>
  if (!payslips.length) return (
    <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>💰</div>
      <p>אין תלושי שכר עדיין</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {payslips.map(p => (
        <div key={p.id} style={{ ...CARD, padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', direction:'rtl' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:'#1e293b' }}>{MONTHS_HE[(p.month||1)-1]} {p.year}</div>
              {p.notes && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{p.notes}</div>}
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>
                {new Date(p.created_at).toLocaleDateString('he-IL')}
              </div>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:'#f97316' }}>
              ₪{Number(p.amount).toLocaleString('he-IL')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function InstructorPortal({ instructorId, instructorName }) {
  const [tab, setTab] = useState('report')
  const tabs = [
    { id: 'report',   label: '📝 דוח חדש'    },
    { id: 'history',  label: '📋 היסטוריה'   },
    { id: 'payslips', label: '💰 תלושי שכר'  },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#fff7ed 0%,#f8fafc 50%,#f1f5f9 100%)', fontFamily:"'Rubik','Segoe UI',Arial,sans-serif", direction:'rtl' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'12px 18px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10, boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#f97316,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, color:'#fff', flexShrink:0 }}>W</div>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', lineHeight:1.2 }}>WIN CRM</div>
          <div style={{ fontSize:11, color:'#94a3b8' }}>דוח שעות — {instructorName || 'מדריך'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1px solid #e2e8f0', position:'sticky', top:58, zIndex:9 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'11px 6px', border:'none', background:'none', cursor:'pointer',
            fontSize:13, fontWeight:600, fontFamily:'inherit',
            color: tab === t.id ? '#f97316' : '#64748b',
            borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:560, margin:'0 auto', padding:'18px 14px 60px' }}>
        {tab === 'report'   && <ReportTab   instructorId={instructorId}/>}
        {tab === 'history'  && <HistoryTab  instructorId={instructorId}/>}
        {tab === 'payslips' && <PayslipsTab instructorId={instructorId}/>}
      </div>
    </div>
  )
}
