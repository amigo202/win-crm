import { useState, useEffect } from 'react'
import { PROGRAMS } from '../../constants'
import { fmtShekel, fmtD, ini, avBg } from '../../utils/format'
import { monthlyHours, monthlyPay, noSessionDays } from '../../utils/alerts'
import { exportInstructorsCSV } from '../../utils/csv'
import { Ico } from '../icons/Ico'
import { supabase } from '../../lib/supabase'

function HoursModal({ inst, onClose }) {
  const url = `${window.location.origin}?portal=${inst.id}&n=${encodeURIComponent(inst.name)}`
  const [reports, setReports] = useState([])
  const [fetching, setFetching] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('hour_reports').select('*')
      .eq('instructor_id', inst.id)
      .order('report_date', { ascending: false })
      .then(({ data }) => { setReports(data || []); setFetching(false) })
  }, [inst.id])

  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalHours = reports.reduce((s, r) => s + Number(r.hours || 0), 0)

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
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

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, direction: 'rtl' }}>
            דיווחים שהתקבלו {reports.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({totalHours} שעות סה"כ)</span>}
          </div>

          {fetching ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>טוען...</div>
          ) : !reports.length ? (
            <div className="empty"><p>אין דיווחים עדיין. שלח את הקישור למדריך.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {reports.map(r => (
                <div key={r.id} style={{
                  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                  padding: '8px 12px', background: 'var(--bg)',
                  borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, direction: 'rtl',
                }}>
                  <span style={{ color: 'var(--muted)', minWidth: 85, flexShrink: 0 }}>{r.report_date}</span>
                  <strong style={{ flexShrink: 0 }}>{r.hours}ש׳</strong>
                  {r.program  && <span className="badge b-teal" style={{ fontSize: 11 }}>{r.program}</span>}
                  {r.location && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{r.location}</span>}
                  {r.notes    && <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</span>}
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 'auto', flexShrink: 0 }}>
                    {new Date(r.submitted_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
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
          <button className="btn btn-p" onClick={() => setModal({ inst: null })}><Ico.plus/>הוסף מדריך</button>
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
