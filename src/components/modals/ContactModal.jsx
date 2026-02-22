import { useState } from 'react'
import { PROGRAMS, CONTACT_TYPES, STATUS_OPTS, TAG_COLORS, STAGES } from '../../constants'
import { fmtDT, fmtShekel } from '../../utils/format'

export default function ContactModal({ contact, deals, onSave, onClose }) {
  const isE = !!contact
  const [tab, setTab]       = useState('details')
  const [selType, setSelType] = useState(contact?.type || 'school')
  const [nt, setNt]         = useState('')
  const [ti, setTi]         = useState('')
  const [tc, setTc]         = useState(0)
  const [form, setForm]     = useState(() => contact ? { ...contact } : {
    type: 'school', name: '', contactPerson: '', phone: '', email: '', city: '', status: 'lead',
    activePrograms: [], tags: [], notes: [], activities: [],
    principal: '', studentCount: '', department: '', manager: '', targetAudience: '',
    eventTypes: '', age: '', parentName: '', program: PROGRAMS[0],
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const toggleProg = p => setForm(prev => ({
    ...prev,
    activePrograms: (prev.activePrograms || []).includes(p)
      ? (prev.activePrograms || []).filter(x => x !== p)
      : [...(prev.activePrograms || []), p],
  }))

  const addNote = () => {
    if (!nt.trim()) return
    const now = new Date().toISOString()
    const note = { id: crypto.randomUUID(), text: nt.trim(), date: now }
    const act  = { id: crypto.randomUUID(), desc: `הוספת הערה: ${nt.trim().slice(0, 35)}`, date: now }
    setForm(p => ({ ...p, notes: [note, ...(p.notes || [])], activities: [...(p.activities || []), act] }))
    setNt('')
  }

  const addTag = () => {
    if (!ti.trim()) return
    setForm(p => ({ ...p, tags: [...(p.tags || []), { label: ti.trim(), color: TAG_COLORS[tc] }] }))
    setTi('')
  }

  const rmTag = i => setForm(p => ({ ...p, tags: (p.tags || []).filter((_, j) => j !== i) }))

  const save = () => {
    if (!form.name.trim()) return
    onSave({ ...form, type: isE ? form.type : selType, updatedAt: new Date().toISOString() })
    onClose()
  }
  const sub = e => { e.preventDefault(); save() }
  const linked = (deals || []).filter(d => d.contactId === contact?.id)

  function TypeFields({ t }) {
    if (t === 'school') return <><div className="frow"><label>שם מנהל</label><input value={form.principal || ''} onChange={f('principal')} placeholder="שם מנהל"/></div><div className="frow"><label>מספר תלמידים</label><input type="number" value={form.studentCount || ''} onChange={f('studentCount')} placeholder="500"/></div></>
    if (t === 'municipality') return <><div className="frow"><label>איש קשר</label><input value={form.contactPerson || ''} onChange={f('contactPerson')} placeholder="שם"/></div><div className="frow"><label>מחלקה</label><input value={form.department || ''} onChange={f('department')} placeholder="חינוך"/></div></>
    if (t === 'community') return <><div className="frow"><label>מנהל</label><input value={form.manager || ''} onChange={f('manager')} placeholder="שם מנהל"/></div><div className="frow"><label>קהל יעד</label><input value={form.targetAudience || ''} onChange={f('targetAudience')} placeholder="ילדים, נוער"/></div></>
    if (t === 'event_producer') return <><div className="frow"><label>איש קשר</label><input value={form.contactPerson || ''} onChange={f('contactPerson')} placeholder="שם"/></div><div className="frow full"><label>סוגי אירועים</label><input value={form.eventTypes || ''} onChange={f('eventTypes')} placeholder="ימי הולדת, אירועי חברה"/></div></>
    if (t === 'private_student') return <><div className="frow"><label>גיל</label><input type="number" value={form.age || ''} onChange={f('age')} placeholder="12"/></div><div className="frow"><label>שם הורה</label><input value={form.parentName || ''} onChange={f('parentName')} placeholder="שם"/></div><div className="frow full"><label>תוכנית</label><select value={form.program || PROGRAMS[0]} onChange={f('program')}>{PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div></>
    return null
  }

  const DetailForm = ({ curType }) => (
    <form onSubmit={sub}>
      <div className="mb">
        {!isE && <div className="type-tabs">{CONTACT_TYPES.map(t => <button key={t.id} type="button" className={`tt ${selType === t.id ? 'on' : ''}`} onClick={() => setSelType(t.id)}><span className="tt-ico">{t.icon}</span>{t.label}</button>)}</div>}
        <div className="fg">
          <div className="frow full"><label>שם *</label><input required value={form.name} onChange={f('name')} placeholder="שם..."/></div>
          <div className="frow"><label>טלפון</label><input type="tel" value={form.phone || ''} onChange={f('phone')} placeholder="050-0000000"/></div>
          <div className="frow"><label>אימייל</label><input type="email" value={form.email || ''} onChange={f('email')} placeholder="email@..."/></div>
          <div className="frow"><label>עיר</label><input value={form.city || ''} onChange={f('city')} placeholder="תל אביב"/></div>
          <div className="frow"><label>סטטוס</label><select value={form.status} onChange={f('status')}>{STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          {TypeFields({ t: curType })}
          {curType !== 'private_student' && (
            <div className="frow full"><label>תוכניות פעילות</label>
              <div className="prog-grid">{PROGRAMS.map(p => <label key={p} className={`prog-cb ${(form.activePrograms || []).includes(p) ? 'on' : ''}`}><input type="checkbox" checked={(form.activePrograms || []).includes(p)} onChange={() => toggleProg(p)}/>{p}</label>)}</div>
            </div>
          )}
          {isE && (
            <div className="frow full"><label>תגיות</label>
              <div style={{ display: 'flex', gap: 6 }}><input value={ti} onChange={e => setTi(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="תגית + Enter..." style={{ flex: 1 }}/><button type="button" className="btn btn-o btn-sm" onClick={addTag}>+</button></div>
              <div className="cdots">{TAG_COLORS.map((c, i) => <div key={i} className={`cdot ${tc === i ? 'sel' : ''}`} style={{ background: c.dot }} onClick={() => setTc(i)}/>)}</div>
              {(form.tags || []).length > 0 && <div className="tags-wrap">{(form.tags || []).map((tag, i) => <span key={i} className="tag" style={{ background: tag.color?.bg || '#f1f5f9', color: tag.color?.text || '#475569' }}>{tag.label}<span className="tag-x" onClick={() => rmTag(i)}>×</span></span>)}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="mf"><button type="submit" className="btn btn-p">{isE ? 'שמור' : 'הוסף'}</button><button type="button" className="btn btn-o" onClick={onClose}>ביטול</button></div>
    </form>
  )

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${isE ? 'modal-lg' : ''}`}>
        <div className="mh"><h3>{isE ? `עריכת ${form.name}` : 'הוספת איש קשר'}</h3><button className="mx" onClick={onClose}>×</button></div>
        {isE ? (
          <>
            <div className="tabs">{[['details','פרטים'],['notes','הערות'],['deals','עסקאות'],['history','היסטוריה']].map(([id, lb]) => <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{lb}</button>)}</div>
            {tab === 'details' && DetailForm({ curType: form.type })}
            {tab === 'notes' && (
              <div className="mb">
                <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}><textarea value={nt} onChange={e => setNt(e.target.value)} placeholder="הוסף הערה..." style={{ flex: 1, minHeight: 65 }}/><button className="btn btn-p" onClick={addNote} style={{ alignSelf: 'flex-end', flexShrink: 0 }}>הוסף</button></div>
                {!(form.notes || []).length ? <div className="empty"><p>אין הערות</p></div> : (form.notes || []).map(n => <div key={n.id} className="note-item"><div className="note-date">{fmtDT(n.date)}</div><div className="note-text">{n.text}</div></div>)}
                <div className="mf"><button className="btn btn-p" onClick={save}>שמור</button><button className="btn btn-o" onClick={onClose}>סגור</button></div>
              </div>
            )}
            {tab === 'deals' && (
              <div className="mb">
                {!linked.length ? <div className="empty"><div className="empty-ico">💼</div><p>אין עסקאות מקושרות</p></div> : linked.map(d => { const st = STAGES.find(s => s.id === d.stage); return <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}><div><div style={{ fontWeight: 600, fontSize: 13 }}>{d.title}</div><div style={{ fontSize: 12, color: st?.color || 'var(--muted)', marginTop: 2 }}>{st?.label}</div></div><span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtShekel(d.value)}</span></div> })}
                <div className="mf"><button className="btn btn-o" onClick={onClose}>סגור</button></div>
              </div>
            )}
            {tab === 'history' && (
              <div className="mb">
                {!(form.activities || []).length ? <div className="empty"><p>אין היסטוריה</p></div> : [...(form.activities || [])].reverse().map(a => <div key={a.id} className="act-item"><div className="act-dot"/><div><div className="act-d">{a.desc}</div><div className="act-dt">{fmtDT(a.date)}</div></div></div>)}
                <div className="mf"><button className="btn btn-o" onClick={onClose}>סגור</button></div>
              </div>
            )}
          </>
        ) : DetailForm({ curType: selType })}
      </div>
    </div>
  )
}
