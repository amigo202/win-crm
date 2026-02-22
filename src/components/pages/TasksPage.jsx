import { useState } from 'react'
import { PRIORITIES } from '../../constants'
import { fmtDate } from '../../utils/format'
import { Ico } from '../icons/Ico'

export default function TasksPage({ tasks, contacts, onAdd, onUpdate, onDelete, onToggle }) {
  const [filter, setFilter] = useState('open')
  const [modal, setModal]   = useState(null)
  const today = new Date(); today.setHours(0,0,0,0)

  const cnts = {
    open:    tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < today).length,
    done:    tasks.filter(t => t.completed).length,
    all:     tasks.length,
  }
  const filtered = tasks.filter(t => {
    if (filter === 'open')    return !t.completed
    if (filter === 'overdue') return !t.completed && t.dueDate && new Date(t.dueDate) < today
    if (filter === 'done')    return t.completed
    return true
  })
  const cname = id => contacts.find(c => c.id === id)?.name || ''

  function TaskModal({ task }) {
    const [form, setForm] = useState(() => task || { title: '', contactId: '', priority: 'medium', dueDate: '' })
    const f   = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
    const sub = e => { e.preventDefault(); if (!form.title.trim()) return; task ? onUpdate(task.id, form) : onAdd(form); setModal(null) }
    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal">
          <div className="mh"><h3>{task ? 'עריכת משימה' : 'משימה חדשה'}</h3><button className="mx" onClick={() => setModal(null)}>×</button></div>
          <form onSubmit={sub}><div className="mb"><div className="fg">
            <div className="frow full"><label>כותרת *</label><input required value={form.title} onChange={f('title')} placeholder="תיאור..."/></div>
            <div className="frow"><label>עדיפות</label><select value={form.priority} onChange={f('priority')}>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
            <div className="frow"><label>תאריך יעד</label><input type="date" value={form.dueDate} onChange={f('dueDate')}/></div>
            <div className="frow full"><label>איש קשר</label><select value={form.contactId} onChange={f('contactId')}><option value="">ללא</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div></div>
          <div className="mf">
            <button type="submit" className="btn btn-p">{task ? 'שמור' : 'הוסף'}</button>
            <button type="button" className="btn btn-o" onClick={() => setModal(null)}>ביטול</button>
            {task && <button type="button" className="del-link" onClick={() => { if (window.confirm('למחוק?')) { onDelete(task.id); setModal(null) } }}>מחק</button>}
          </div></form>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="ph"><h2>משימות</h2><button className="btn btn-p" onClick={() => setModal({ task: null })}><Ico.plus/>הוסף</button></div>
      <div className="pb"><div className="card">
        <div className="filter-bar">
          {[{ id: 'open', l: 'פתוחות' }, { id: 'overdue', l: 'באיחור' }, { id: 'done', l: 'הושלמו' }, { id: 'all', l: 'הכל' }].map(f =>
            <button key={f.id} className={`fp ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>{f.l}<span className="fp-cnt">{cnts[f.id]}</span></button>
          )}
        </div>
        {!filtered.length
          ? <div className="empty"><div className="empty-ico">✅</div><p>{filter === 'open' ? 'אין משימות פתוחות' : filter === 'overdue' ? 'אין משימות באיחור' : filter === 'done' ? 'אין שהושלמו' : 'אין משימות'}</p></div>
          : filtered.map(t => {
              const di = fmtDate(t.dueDate)
              const pr = PRIORITIES.find(p => p.value === t.priority) || PRIORITIES[1]
              return (
                <div key={t.id} className="task-row">
                  <div className={`tck ${t.completed ? 'dn' : ''}`} onClick={() => onToggle(t.id)}>{t.completed && <Ico.check/>}</div>
                  <div className="tb">
                    <div className={`tt-txt ${t.completed ? 'dn' : ''}`}>{t.title}</div>
                    <div className="tm">
                      <span className={`badge ${pr.badge}`}>{pr.label}</span>
                      {t.contactId && <span className="badge b-gray">{cname(t.contactId)}</span>}
                      {di && <span style={{ fontSize: 12, color: di.ov ? 'var(--danger)' : 'var(--muted)' }}>{di.text}{di.ov ? ' (באיחור)' : ''}</span>}
                    </div>
                  </div>
                  <div className="ta">
                    <button className="icon-btn" onClick={() => setModal({ task: t })}><Ico.edit/></button>
                    <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm('למחוק?')) onDelete(t.id) }}><Ico.trash/></button>
                  </div>
                </div>
              )
            })}
      </div></div>
      {modal && <TaskModal task={modal.task}/>}
    </>
  )
}
