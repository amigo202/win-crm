import { useState, useEffect } from 'react'
import { PROGRAMS } from '../../constants'
import { fmtShekel, fmtD, ini, avBg } from '../../utils/format'
import { monthlyHours, monthlyPay, noSessionDays } from '../../utils/alerts'
import { exportInstructorsCSV } from '../../utils/csv'
import { Ico } from '../icons/Ico'
import { supabase } from '../../lib/supabase'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function HoursModal({ inst, onClose }) {
  const url = `${window.location.origin}?portal=${inst.id}&n=${encodeURIComponent(inst.name)}`
  const [reports, setReports] = useState([])
  const [fetching, setFetching] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showPayslip, setShowPayslip] = useState(false)
  const now = new Date()
  const [ps, setPs] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), amount: '', notes: '' })
  const [psSt, setPsSt] = useState('idle')
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [filterMonth, setFilterMonth] = useState('')

  const loadReports = () => {
    setFetching(true)
    supabase.from('hour_reports').select('*')
      .eq('instructor_id', inst.id)
      .order('report_date', { ascending: false })
      .then(({ data }) => { setReports(data || []); setFetching(false) })
  }

  useEffect(() => { loadReports() }, [inst.id])

  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendPayslip = async () => {
    if (!ps.amount || Number(ps.amount) <= 0) return
    setPsSt('sending')
    try {
      const { error } = await supabase.from('payslips').insert({
        instructor_id: inst.id, month: Number(ps.month),
        year: Number(ps.year), amount: Number(ps.amount), notes: ps.notes || null,
      })
      if (error) throw error
      setPsSt('sent')
      setTimeout(() => { setPsSt('idle'); setShowPayslip(false); setPs(p => ({ ...p, amount: '', notes: '' })) }, 2500)
    } catch { setPsSt('error'); setTimeout(() => setPsSt('idle'), 3000) }
  }

  // ── Admin actions on reports ──
  const approveReport = async (id) => {
    await supabase.from('hour_reports').update({ status: 'approved' }).eq('id', id)
    loadReports()
  }
  const rejectReport = async (id) => {
    await supabase.from('hour_reports').update({ status: 'rejected' }).eq('id', id)
    loadReports()
  }
  const deleteReport = async (id) => {
    if (!window.confirm('למחוק דיווח זה?')) return
    await supabase.from('hour_reports').delete().eq('id', id)
    loadReports()
  }
  const startEdit = (r) => {
    setEditId(r.id)
    setEditForm({ hours: r.hours, location: r.location || '', subject: r.subject || '', notes: r.notes || '', report_date: r.report_date })
  }
  const saveEdit = async () => {
    await supabase.from('hour_reports').update({
      hours: Number(editForm.hours),
      location: editForm.location,
      subject: editForm.subject,
      notes: editForm.notes,
      report_date: editForm.report_date,
    }).eq('id', editId)
    setEditId(null)
    loadReports()
  }
  const approveAll = async () => {
    const pending = filteredReports.filter(r => (r.status || 'pending') === 'pending')
    if (!pending.length) return
    const ids = pending.map(r => r.id)
    await supabase.from('hour_reports').update({ status: 'approved' }).in('id', ids)
    loadReports()
  }

  const totalHours = reports.reduce((s, r) => s + Number(r.hours || 0), 0)
  const approvedHours = reports.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.hours || 0), 0)
  const pendingCount = reports.filter(r => (r.status || 'pending') === 'pending').length

  // Filter reports by month
  const filteredReports = filterMonth
    ? reports.filter(r => r.report_date && r.report_date.startsWith(filterMonth))
    : reports

  const statusBadge = (status) => {
    const s = status || 'pending'
    const map = {
      pending:  { bg: '#fef3c7', color: '#92400e', label: 'ממתין' },
      approved: { bg: '#d1fae5', color: '#065f46', label: 'אושר' },
      rejected: { bg: '#fee2e2', color: '#dc2626', label: 'נדחה' },
    }
    const st = map[s] || map.pending
    return <span style={{ background: st.bg, color: st.color, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{st.label}</span>
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="mh"><h3>דוח שעות — {inst.name}</h3><button className="mx" onClick={onClose}>×</button></div>
        <div className="mb">
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              🔗 קישור לדיווח שעות — שלח למדריך
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly value={url} style={{
                flex: 1, fontSize: 11, padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--muted)', direction: 'ltr', outline: 'none',
              }}/>
              <button className="btn btn-o btn-sm" onClick={copy} style={{ flexShrink: 0 }}>
                {copied ? '✅ הועתק' : '📋 העתק'}
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, direction: 'rtl' }}>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{totalHours}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>שעות סה"כ</div>
            </div>
            <div style={{ flex: 1, background: '#d1fae5', borderRadius: 8, padding: '8px 12px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46' }}>{approvedHours}</div>
              <div style={{ fontSize: 10, color: '#065f46' }}>שעות מאושרות</div>
            </div>
            <div style={{ flex: 1, background: pendingCount > 0 ? '#fef3c7' : 'var(--bg)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', border: `1px solid ${pendingCount > 0 ? '#fcd34d' : 'var(--border)'}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: pendingCount > 0 ? '#92400e' : 'var(--muted)' }}>{pendingCount}</div>
              <div style={{ fontSize: 10, color: pendingCount > 0 ? '#92400e' : 'var(--muted)' }}>ממתינים לאישור</div>
            </div>
          </div>

          {/* Filter + bulk actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, direction: 'rtl', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>דיווחים</span>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', direction: 'ltr' }}/>
            {filterMonth && <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }} onClick={() => setFilterMonth('')}>הצג הכל</button>}
            <div style={{ marginRight: 'auto' }}>
              {pendingCount > 0 && (
                <button className="btn btn-p btn-sm" onClick={approveAll} style={{ fontSize: 11, padding: '3px 10px' }}>
                  ✅ אשר הכל ({pendingCount})
                </button>
              )}
              <button className="btn btn-o btn-sm" onClick={loadReports} style={{ fontSize: 11, padding: '3px 10px', marginRight: 6 }} title="רענן">
                🔄
              </button>
            </div>
          </div>

          {fetching ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>טוען...</div>
          ) : !filteredReports.length ? (
            <div className="empty"><p>{filterMonth ? 'אין דיווחים בחודש זה' : 'אין דיווחים עדיין. שלח את הקישור למדריך.'}</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 350, overflowY: 'auto' }}>
              {filteredReports.map(r => (
                <div key={r.id} style={{
                  padding: '10px 12px', background: editId === r.id ? '#fffbeb' : 'var(--bg)',
                  borderRadius: 8, border: `1px solid ${editId === r.id ? '#fcd34d' : 'var(--border)'}`, fontSize: 13, direction: 'rtl',
                }}>
                  {editId === r.id ? (
                    /* ── Edit mode ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>תאריך</label>
                          <input type="date" value={editForm.report_date} onChange={e => setEditForm(p => ({ ...p, report_date: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}/>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>שעות</label>
                          <input type="number" value={editForm.hours} min=".5" step=".5" onChange={e => setEditForm(p => ({ ...p, hours: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center' }}/>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>מיקום</label>
                          <input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}/>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>נושא</label>
                          <input value={editForm.subject} onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}/>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>הערות</label>
                          <input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}/>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-p btn-sm" onClick={saveEdit} style={{ fontSize: 11, padding: '3px 12px' }}>💾 שמור</button>
                        <button className="btn btn-o btn-sm" onClick={() => setEditId(null)} style={{ fontSize: 11, padding: '3px 12px' }}>ביטול</button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {statusBadge(r.status)}
                      <span style={{ color: 'var(--muted)', minWidth: 85, flexShrink: 0 }}>{r.report_date}</span>
                      <strong style={{ flexShrink: 0 }}>{r.hours}ש׳</strong>
                      {r.location && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.location}</span>}
                      {r.subject && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.subject}</span>}
                      {r.notes && <span style={{ color: 'var(--muted)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {r.notes}</span>}
                      <div style={{ marginRight: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
                        {(r.status || 'pending') === 'pending' && (
                          <button onClick={() => approveReport(r.id)} title="אשר"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 3px' }}>✅</button>
                        )}
                        {(r.status || 'pending') === 'pending' && (
                          <button onClick={() => rejectReport(r.id)} title="דחה"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 3px' }}>❌</button>
                        )}
                        <button onClick={() => startEdit(r)} title="ערוך"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 3px' }}>✏️</button>
                        <button onClick={() => deleteReport(r.id)} title="מחק"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 3px', color: '#ef4444' }}>🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          {/* ── Send Payslip ── */}
          <div style={{ marginTop:18, borderTop:'1px solid var(--border)', paddingTop:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontWeight:600, fontSize:13 }}>💰 שליחת תלוש שכר</span>
              <button className="btn btn-o btn-sm" onClick={() => setShowPayslip(v => !v)}>
                {showPayslip ? 'ביטול' : '+ שלח תלוש'}
              </button>
            </div>
            {showPayslip && (
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label>חודש</label>
                    <select className="si-input" value={ps.month} onChange={e => setPs(p => ({ ...p, month: e.target.value }))}>
                      {MONTHS_HE.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>שנה</label>
                    <select className="si-input" value={ps.year} onChange={e => setPs(p => ({ ...p, year: e.target.value }))}>
                      {[ps.year-1, ps.year, ps.year+1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label>סכום (₪) *</label>
                    <input type="number" className="si-input" value={ps.amount} min="0" step="10"
                      onChange={e => setPs(p => ({ ...p, amount: e.target.value }))} placeholder="8000"/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label>הערות</label>
                    <input className="si-input" value={ps.notes} onChange={e => setPs(p => ({ ...p, notes: e.target.value }))} placeholder="כולל בונוס, ניכויים וכו'..."/>
                  </div>
                </div>
                {psSt === 'sent'  && <div style={{ color:'#065f46', background:'#d1fae5', borderRadius:7, padding:'7px 12px', fontSize:12, marginBottom:8 }}>✅ התלוש נשלח!</div>}
                {psSt === 'error' && <div style={{ color:'#dc2626', background:'#fee2e2', borderRadius:7, padding:'7px 12px', fontSize:12, marginBottom:8 }}>שגיאה בשמירה</div>}
                <button className="btn btn-p btn-sm" onClick={sendPayslip} disabled={psSt === 'sending'}>
                  {psSt === 'sending' ? '⏳ שולח...' : '💰 שלח תלוש'}
                </button>
              </div>
            )}
          </div>
        <div className="mf"><button className="btn btn-o" onClick={onClose}>סגור</button></div>
      </div>
    </div>
  )
}

export default function InstructorsPage({ instructors, contacts, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null)
  const [hoursInst, setHoursInst] = useState(null)

  function InstructorModal({ inst }) {
    const isE = !!inst
    const [tab, setTab] = useState('details')
    const [form, setForm] = useState(() => inst ? { ...inst } : { name: '', phone: '', email: '', programs: [], hourlyRate: '', sessions: [] })
    const [sf, setSf] = useState({ date: new Date().toISOString().split('T')[0], hours: '', program: PROGRAMS[0], contactId: '', notes: '' })
    const f   = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
    const sff = k => e => setSf(p => ({ ...p, [k]: e.target.value }))
    const toggleP = p => setForm(prev => ({
      ...prev,
      programs: (prev.programs || []).includes(p)
        ? (prev.programs || []).filter(x => x !== p)
        : [...(prev.programs || []), p],
    }))
    const addSession = () => {
      if (!sf.hours) return
      const s = { id: crypto.randomUUID(), ...sf, hours: Number(sf.hours) }
      setForm(p => ({ ...p, sessions: [...(p.sessions || []), s] }))
      setSf(p => ({ ...p, hours: '', notes: '' }))
    }
    const delSession = id => setForm(p => ({ ...p, sessions: (p.sessions || []).filter(s => s.id !== id) }))
    const save = () => { if (!form.name.trim()) return; isE ? onUpdate(inst.id, form) : onAdd(form); setModal(null) }
    const mh   = monthlyHours(form), mp = monthlyPay(form)
    const cname = id => contacts.find(c => c.id === id)?.name || ''

    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal modal-lg">
          <div className="mh"><h3>{isE ? `מדריך: ${form.name}` : 'מדריך חדש'}</h3><button className="mx" onClick={() => setModal(null)}>×</button></div>
          {isE && <div className="tabs"><button className={`tab ${tab === 'details' ? 'on' : ''}`} onClick={() => setTab('details')}>פרטים</button><button className={`tab ${tab === 'sessions' ? 'on' : ''}`} onClick={() => setTab('sessions')}>שיעורים</button></div>}
          {(!isE || tab === 'details') && (
            <div className="mb"><div className="fg">
              <div className="frow full"><label>שם *</label><input required value={form.name} onChange={f('name')} placeholder="שם מדריך"/></div>
              <div className="frow"><label>טלפון</label><input value={form.phone || ''} onChange={f('phone')} placeholder="050-0000000"/></div>
              <div className="frow"><label>אימייל</label><input value={form.email || ''} onChange={f('email')} placeholder="email@..."/></div>
              <div className="frow full"><label>תעריף לשעה (₪)</label><input type="number" value={form.hourlyRate || ''} onChange={f('hourlyRate')} placeholder="150" min="0"/></div>
              <div className="frow full"><label>תוכניות</label><div className="prog-grid">{PROGRAMS.map(p => <label key={p} className={`prog-cb ${(form.programs || []).includes(p) ? 'on' : ''}`}><input type="checkbox" checked={(form.programs || []).includes(p)} onChange={() => toggleP(p)}/>{p}</label>)}</div></div>
            </div>
            <div className="mf">
              <button className="btn btn-p" onClick={save}>{isE ? 'שמור' : 'הוסף'}</button>
              <button className="btn btn-o" onClick={() => setModal(null)}>ביטול</button>
              {isE && <button className="del-link" onClick={() => { if (window.confirm('למחוק?')) { onDelete(inst.id); setModal(null) } }}>מחק</button>}
            </div></div>
          )}
          {isE && tab === 'sessions' && (
            <div className="mb">
              <div className="sumbox"><div>שעות החודש: <span>{mh}</span></div><div>תשלום: <span>{fmtShekel(mp)}</span></div><div>סה"כ שיעורים: <span>{(form.sessions || []).length}</span></div></div>
              <div className="fg" style={{ marginBottom: 12 }}>
                <div className="frow"><label>תאריך</label><input type="date" value={sf.date} onChange={sff('date')}/></div>
                <div className="frow"><label>שעות</label><input type="number" value={sf.hours} onChange={sff('hours')} placeholder="2" min=".5" step=".5"/></div>
                <div className="frow"><label>תוכנית</label><select value={sf.program} onChange={sff('program')}>{PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div className="frow"><label>איש קשר</label><select value={sf.contactId} onChange={sff('contactId')}><option value="">ללא</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="frow full"><label>הערות</label><input value={sf.notes} onChange={sff('notes')} placeholder="הערות..."/></div>
              </div>
              <button className="btn btn-p btn-sm" onClick={addSession} style={{ marginBottom: 12 }}>+ הוסף שיעור</button>
              {!(form.sessions || []).length
                ? <div className="empty"><p>אין שיעורים רשומים</p></div>
                : [...(form.sessions || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => (
                  <div key={s.id} className="sess-row">
                    <span style={{ color: 'var(--muted)', flex: 'none' }}>{fmtD(s.date)}</span>
                    <span style={{ fontWeight: 600 }}>{s.hours}ש׳</span>
                    <span className="badge b-teal" style={{ fontSize: 11 }}>{s.program}</span>
                    {s.contactId && <span className="badge b-gray" style={{ fontSize: 11 }}>{cname(s.contactId)}</span>}
                    {s.notes && <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1 }}>{s.notes}</span>}
                    <button className="icon-btn" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => delSession(s.id)}><Ico.trash/></button>
                  </div>
                ))}
              <div className="mf"><button className="btn btn-p" onClick={save}>שמור</button><button className="btn btn-o" onClick={() => setModal(null)}>סגור</button></div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="ph"><h2>מדריכים</h2>
        <div style={{ display: 'flex', gap: 7 }}>
          <button className="btn btn-o btn-sm" onClick={() => exportInstructorsCSV(instructors)}><Ico.dl/>ייצוא</button>
          <button className="btn btn-p" onClick={() => setModal({ inst: null })} aria-label="הוסף מדריך חדש"><Ico.plus/>הוסף מדריך</button>
        </div>
      </div>
      <div className="pb"><div className="card">
        {!instructors.length
          ? <div className="empty"><div className="empty-ico">👨‍🏫</div><p>אין מדריכים עדיין. לחץ "הוסף מדריך"</p></div>
          : <div className="tbl-wrap"><table><thead><tr><th>שם</th><th>טלפון</th><th>תוכניות</th><th>שעות חודש</th><th>תשלום חודש</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>{instructors.map(i => {
              const mh = monthlyHours(i), mp = monthlyPay(i), alert = noSessionDays(i, 14)
              return (
                <tr key={i.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="av" style={{ width: 30, height: 30, fontSize: 11, background: avBg(i.name) }}>{ini(i.name)}</div><div><div style={{ fontWeight: 600 }}>{i.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{i.email || ''}</div></div></div></td>
                  <td>{i.phone || '–'}</td>
                  <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{(i.programs || []).map((p, j) => <span key={j} className="badge b-teal" style={{ fontSize: 11, padding: '1px 6px' }}>{p}</span>)}</div></td>
                  <td><strong>{mh}</strong>ש׳</td>
                  <td><strong style={{ color: 'var(--accent)' }}>{fmtShekel(mp)}</strong></td>
                  <td><span className={`badge ${alert ? 'b-red' : 'b-green'}`}>{alert ? 'לא דיווח' : 'פעיל'}</span></td>
                  <td><div className="ac-cell">
                    <button className="icon-btn" title="דוח שעות" onClick={() => setHoursInst(i)} style={{ fontSize: 13 }}>📊</button>
                    <button className="icon-btn" onClick={() => setModal({ inst: i })}><Ico.edit/></button>
                    <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm(`למחוק ${i.name}?`)) onDelete(i.id) }}><Ico.trash/></button>
                  </div></td>
                </tr>
              )
            })}</tbody></table></div>}
      </div></div>
      {modal && <InstructorModal inst={modal.inst}/>}
      {hoursInst && <HoursModal inst={hoursInst} onClose={() => setHoursInst(null)}/>}
    </>
  )
}
