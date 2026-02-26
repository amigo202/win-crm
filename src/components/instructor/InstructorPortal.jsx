import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────
const DAYS_HE   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function dayName(d) {
  if (!d) return ''
  return 'יום ' + DAYS_HE[new Date(d + 'T12:00:00').getDay()]
}
function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()} ${MONTHS_HE[dt.getMonth()]} ${dt.getFullYear()}`
}
function newRow() {
  return { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], location: '', subject: '', hours: '', notes: '' }
}
function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, sv]
}

const today = new Date().toISOString().split('T')[0]
const now   = new Date()

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
    <>
      <tr style={{ borderBottom:'1px solid #f1f5f9' }}>
        {/* Date */}
        <td style={{ padding:'7px 6px', width:130, verticalAlign:'top' }}>
          <input type="date" value={row.date} onChange={f('date')} style={{ ...INP }}/>
          <div style={{ fontSize:11, color:'#f97316', fontWeight:600, marginTop:2, textAlign:'center', minHeight:16 }}>
            {row.date ? dayName(row.date) : ''}
          </div>
        </td>
        {/* Location */}
        <td style={{ padding:'7px 6px', verticalAlign:'top' }}>
          <input value={row.location} onChange={f('location')} placeholder='שם בית ספר / מתנ"ס'
            style={{ ...INP }}/>
        </td>
        {/* Subject */}
        <td style={{ padding:'7px 6px', verticalAlign:'top' }}>
          <input value={row.subject} onChange={f('subject')} placeholder="מה לימדת..."
            style={{ ...INP, minWidth:100 }}/>
        </td>
        {/* Hours */}
        <td style={{ padding:'7px 6px', width:70, verticalAlign:'top' }}>
          <input type="number" value={row.hours} onChange={f('hours')}
            placeholder="2" min=".5" step=".5" style={{ ...INP, textAlign:'center' }}/>
        </td>
        {/* Delete */}
        <td style={{ padding:'7px 4px', textAlign:'center', width:30, verticalAlign:'top' }}>
          {canDelete && (
            <button onClick={() => onDelete(row.id)}
              style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14, padding:'2px 5px', borderRadius:5, lineHeight:1 }}>
              ✕
            </button>
          )}
        </td>
      </tr>
      {/* Notes row - spans full width */}
      <tr style={{ borderBottom:'1px solid #e8edf3' }}>
        <td colSpan={5} style={{ padding:'0 8px 8px' }}>
          <input
            value={row.notes}
            onChange={f('notes')}
            placeholder="הערות לשיעור זה (אופציונלי)..."
            style={{ ...INP, fontSize:12, background:'#fff', border:'1px solid #e8edf3', color:'#64748b', paddingTop:6, paddingBottom:6 }}
          />
        </td>
      </tr>
    </>
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

  const total     = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0)
  const updateRow = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
  const deleteRow = id => setRows(rs => rs.filter(r => r.id !== id))
  const addRow    = () => setRows(rs => [...rs, { ...newRow() }])

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
        subject:       r.subject.trim(),
        notes:         r.notes.trim() || null,
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
        <table style={{ tableLayout:'auto', width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
              <th style={{ padding:'9px 8px', textAlign:'right', fontSize:11, fontWeight:600, color:'#64748b', width:130 }}>תאריך</th>
              <th style={{ padding:'9px 8px', textAlign:'right', fontSize:11, fontWeight:600, color:'#64748b' }}>שם בית ספר / מתנ"ס</th>
              <th style={{ padding:'9px 8px', textAlign:'right', fontSize:11, fontWeight:600, color:'#64748b' }}>מה לימדת</th>
              <th style={{ padding:'9px 8px', textAlign:'center', fontSize:11, fontWeight:600, color:'#64748b', width:70 }}>שעות</th>
              <th style={{ width:30 }}></th>
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
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, direction:'rtl' }}>
              <tbody>
                {g.rows.map(r => (
                  <tr key={r.id} style={{ borderBottom:'1px solid #f8fafc' }}>
                    <td style={{ padding:'8px 14px', color:'#64748b', minWidth:95 }}>
                      <div>{fmtDate(r.report_date)}</div>
                      <div style={{ fontSize:10, color:'#f97316', fontWeight:600 }}>{dayName(r.report_date)}</div>
                    </td>
                    <td style={{ padding:'8px 14px', color:'#1e293b', fontWeight:500 }}>{r.location || '—'}</td>
                    <td style={{ padding:'8px 14px', color:'#64748b', fontSize:12 }}>
                      {r.subject && <div>{r.subject}</div>}
                      {r.notes && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>📝 {r.notes}</div>}
                    </td>
                    <td style={{ padding:'8px 14px', fontWeight:600, textAlign:'center', width:55, color:'#f97316' }}>{r.hours}ש׳</td>
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

// ── Attendance Report Tab ──────────────────────────────────────────────────
function AttendanceTab({ instructorId }) {
  const [classes, setClasses]             = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents]           = useState([])
  const [sessionDate, setSessionDate]     = useState(today)
  const [attendance, setAttendance]       = useState({})
  const [sessionNotes, setSessionNotes]   = useState('')
  const [history, setHistory]             = useState([])
  const [status, setStatus]               = useState('idle')
  const [viewMode, setViewMode]           = useState('report') // 'report' | 'log'
  const [expandedSession, setExpandedSession] = useState(null)
  const [loadingHistory, setLoadingHistory]   = useState(false)

  // Fetch classes for this instructor
  useEffect(() => {
    supabase.from('classes').select('*')
      .eq('instructor_id', instructorId)
      .then(({ data }) => {
        setClasses(data || [])
        if (data?.length) setSelectedClass(data[0])
      })
  }, [instructorId])

  // Fetch students for selected class
  useEffect(() => {
    if (!selectedClass) return
    supabase.from('students').select('*')
      .eq('class_id', selectedClass.id)
      .then(({ data }) => {
        setStudents(data || [])
        const init = {}
        ;(data || []).forEach(s => { init[s.id] = true })
        setAttendance(init)
      })
  }, [selectedClass])

  // Fetch attendance history for selected class
  useEffect(() => {
    if (!selectedClass) return
    setLoadingHistory(true)
    supabase.from('class_attendance').select('*')
      .eq('class_id', selectedClass.id)
      .order('session_date', { ascending: false })
      .then(({ data }) => {
        setHistory(data || [])
        setLoadingHistory(false)
      })
  }, [selectedClass, status])

  const submitAttendance = async () => {
    if (!selectedClass) return
    setStatus('saving')
    const studentsData = students.map(s => ({
      student_id: s.id,
      student_name: s.name,
      present: attendance[s.id] ?? true,
    }))
    const { error } = await supabase.from('class_attendance').insert({
      class_id:      selectedClass.id,
      instructor_id: instructorId,
      session_date:  sessionDate,
      students_data: studentsData,
      notes:         sessionNotes || null,
    })
    if (error) { setStatus('error'); return }
    setStatus('success')
    setSessionNotes('')
    setTimeout(() => { setStatus('idle'); setViewMode('report') }, 2500)
  }

  if (!classes.length) return (
    <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
      <p>לא שויכת לאף חוג עדיין</p>
    </div>
  )

  const presentCount = students.filter(s => attendance[s.id] ?? true).length

  return (
    <div style={{ direction:'rtl' }}>
      {/* Class selector */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:5 }}>בחר חוג</label>
        <select
          value={selectedClass?.id || ''}
          onChange={e => { setSelectedClass(classes.find(c => c.id === e.target.value)); setExpandedSession(null) }}
          style={{ ...INP }}
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.class_name || c.subject} — {c.location} ({c.day})</option>
          ))}
        </select>
      </div>

      {/* View toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button
          onClick={() => setViewMode('report')}
          style={{
            flex:1, padding:'9px 0', border:'none', borderRadius:9, cursor:'pointer',
            fontSize:13, fontWeight:600, fontFamily:'inherit',
            background: viewMode === 'report' ? '#f97316' : '#f1f5f9',
            color: viewMode === 'report' ? '#fff' : '#64748b',
          }}>
          📊 דוח נוכחות
        </button>
        <button
          onClick={() => setViewMode('log')}
          style={{
            flex:1, padding:'9px 0', border:'none', borderRadius:9, cursor:'pointer',
            fontSize:13, fontWeight:600, fontFamily:'inherit',
            background: viewMode === 'log' ? '#f97316' : '#f1f5f9',
            color: viewMode === 'log' ? '#fff' : '#64748b',
          }}>
          ✏️ רשום נוכחות
        </button>
      </div>

      {/* ── REPORT VIEW ─────────────────────────────────── */}
      {viewMode === 'report' && (
        <div>
          {loadingHistory && (
            <div style={{ textAlign:'center', padding:30, color:'#64748b', fontSize:13 }}>טוען נוכחות...</div>
          )}
          {!loadingHistory && history.length === 0 && (
            <div style={{ ...CARD, padding:'32px 20px', textAlign:'center', color:'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
              <p style={{ margin:0, fontSize:14 }}>אין עדיין שיעורים מתועדים לחוג זה</p>
              <button onClick={() => setViewMode('log')} style={{ marginTop:14, padding:'8px 20px', background:'#f97316', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:600, fontSize:13 }}>
                רשום שיעור ראשון +
              </button>
            </div>
          )}
          {!loadingHistory && history.length > 0 && (
            <>
              {/* Summary card */}
              <div style={{ ...CARD, padding:'14px 16px', marginBottom:12, display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                <div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#f97316' }}>{history.length}</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>שיעורים</div>
                </div>
                <div style={{ width:1, background:'#e2e8f0' }}/>
                <div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#0ea5e9' }}>
                    {history.length ? Math.round(history.reduce((s,h) => {
                      const data = h.students_data || []
                      return s + data.filter(x => x.present).length / Math.max(data.length,1)
                    }, 0) / history.length * 100) : 0}%
                  </div>
                  <div style={{ fontSize:11, color:'#64748b' }}>נוכחות ממוצעת</div>
                </div>
                <div style={{ width:1, background:'#e2e8f0' }}/>
                <div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#10b981' }}>{students.length}</div>
                  <div style={{ fontSize:11, color:'#64748b' }}>תלמידים</div>
                </div>
              </div>

              {/* Sessions list */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {history.map(h => {
                  const data     = h.students_data || []
                  const pres     = data.filter(s => s.present).length
                  const pct      = data.length ? Math.round(pres / data.length * 100) : 0
                  const isOpen   = expandedSession === h.id
                  const absent   = data.filter(s => !s.present)

                  return (
                    <div key={h.id} style={{ ...CARD, overflow:'hidden' }}>
                      {/* Row header */}
                      <div
                        onClick={() => setExpandedSession(isOpen ? null : h.id)}
                        style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>
                            {fmtDate(h.session_date)}
                          </div>
                          <div style={{ fontSize:11, color:'#f97316', fontWeight:600 }}>{dayName(h.session_date)}</div>
                          {h.notes && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>📝 {h.notes}</div>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {/* Attendance pill */}
                          <div style={{ textAlign:'center', background: pct >= 80 ? '#d1fae5' : pct >= 60 ? '#fef3c7' : '#fee2e2', borderRadius:20, padding:'3px 10px' }}>
                            <span style={{ fontWeight:700, fontSize:13, color: pct >= 80 ? '#065f46' : pct >= 60 ? '#92400e' : '#dc2626' }}>
                              {pres}/{data.length}
                            </span>
                            <span style={{ fontSize:10, color: pct >= 80 ? '#065f46' : pct >= 60 ? '#92400e' : '#dc2626', marginRight:3 }}>
                              ({pct}%)
                            </span>
                          </div>
                          <span style={{ color:'#94a3b8', fontSize:12, transform: isOpen ? 'rotate(180deg)' : 'none', display:'inline-block', transition:'transform .2s' }}>▼</span>
                        </div>
                      </div>
                      {/* Expanded: show absent students */}
                      {isOpen && (
                        <div style={{ borderTop:'1px solid #f1f5f9', padding:'10px 14px', background:'#fafafa' }}>
                          {data.length === 0 && <div style={{ fontSize:12, color:'#94a3b8' }}>אין נתוני תלמידים</div>}
                          {data.length > 0 && (
                            <>
                              <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:6 }}>נכחו ({pres}):</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom: absent.length ? 10 : 0 }}>
                                {data.filter(s => s.present).map((s,i) => (
                                  <span key={i} style={{ background:'#d1fae5', color:'#065f46', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:500 }}>{s.student_name}</span>
                                ))}
                              </div>
                              {absent.length > 0 && (
                                <>
                                  <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:6 }}>נעדרו ({absent.length}):</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                    {absent.map((s,i) => (
                                      <span key={i} style={{ background:'#fee2e2', color:'#dc2626', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:500 }}>{s.student_name}</span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LOG VIEW ────────────────────────────────────── */}
      {viewMode === 'log' && (
        <div>
          {/* Session date */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:5 }}>תאריך השיעור</label>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{ ...INP }}/>
            {sessionDate && (
              <div style={{ fontSize:11, color:'#f97316', fontWeight:600, marginTop:4 }}>{dayName(sessionDate)}</div>
            )}
          </div>

          {/* Students attendance */}
          {students.length > 0 ? (
            <div style={{ ...CARD, marginBottom:14 }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>רשימת תלמידים</span>
                <span style={{ fontSize:12, color:'#64748b' }}>{presentCount}/{students.length} נוכחים</span>
              </div>
              {students.map(s => {
                const present = attendance[s.id] ?? true
                return (
                  <div key={s.id} style={{ padding:'10px 14px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                    <span style={{ fontWeight:500, fontSize:14, color:'#1e293b' }}>{s.name}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <button
                        onClick={() => setAttendance(p => ({ ...p, [s.id]: true }))}
                        style={{
                          padding:'5px 12px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
                          background: present ? '#d1fae5' : '#f1f5f9',
                          color: present ? '#065f46' : '#94a3b8',
                        }}>
                        נכח ✓
                      </button>
                      <button
                        onClick={() => setAttendance(p => ({ ...p, [s.id]: false }))}
                        style={{
                          padding:'5px 12px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
                          background: !present ? '#fee2e2' : '#f1f5f9',
                          color: !present ? '#dc2626' : '#94a3b8',
                        }}>
                        נעדר ✗
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ ...CARD, padding:'20px', marginBottom:14, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
              אין תלמידים משויכים לחוג זה
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:5 }}>הערות לשיעור</label>
            <textarea
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              placeholder="הערות על השיעור..."
              rows={2}
              style={{ ...INP, resize:'vertical' }}
            />
          </div>

          {status === 'error' && (
            <div style={{ background:'#fee2e2', color:'#dc2626', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13 }}>
              ⚠ שגיאה בשמירה, נסה שוב
            </div>
          )}
          {status === 'success' && (
            <div style={{ background:'#d1fae5', color:'#065f46', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, fontWeight:600, textAlign:'center' }}>
              ✅ הנוכחות נשמרה בהצלחה!
            </div>
          )}

          <button onClick={submitAttendance} disabled={status === 'saving' || !selectedClass || students.length === 0}
            style={{
              width:'100%', padding:13, border:'none', borderRadius:10,
              background: (status === 'saving' || !selectedClass || students.length === 0) ? '#9ca3af' : 'linear-gradient(135deg,#f97316,#ea580c)',
              color:'#fff', fontSize:15, fontWeight:700,
              cursor: (status === 'saving' || !selectedClass || students.length === 0) ? 'default' : 'pointer',
              fontFamily:'inherit',
            }}>
            {status === 'saving' ? '⏳ שומר...' : '📅 שמור נוכחות'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function InstructorPortal({ instructorId, instructorName }) {
  const [tab, setTab] = useState('report')
  const tabs = [
    { id: 'report',     label: '📝 דוח חדש'       },
    { id: 'history',    label: '📋 היסטוריה'      },
    { id: 'attendance', label: '📊 דוח נוכחות'    },
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#fff7ed 0%,#f8fafc 50%,#f1f5f9 100%)', fontFamily:"'Rubik','Segoe UI',Arial,sans-serif", direction:'rtl' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'12px 18px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10, boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#f97316,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, color:'#fff', flexShrink:0 }}>W</div>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', lineHeight:1.2 }}>WIN CRM</div>
          <div style={{ fontSize:11, color:'#94a3b8' }}>פורטל מדריך — {instructorName || 'מדריך'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1px solid #e2e8f0', position:'sticky', top:58, zIndex:9 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'11px 4px', border:'none', background:'none', cursor:'pointer',
            fontSize:12, fontWeight:600, fontFamily:'inherit',
            color: tab === t.id ? '#f97316' : '#64748b',
            borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:560, margin:'0 auto', padding:'18px 14px 60px' }}>
        {tab === 'report'     && <ReportTab     instructorId={instructorId}/>}
        {tab === 'history'    && <HistoryTab    instructorId={instructorId}/>}
        {tab === 'attendance' && <AttendanceTab instructorId={instructorId}/>}
      </div>
    </div>
  )
}
