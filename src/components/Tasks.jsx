import React, { useState } from 'react'

const PRIORITIES = [
  { value: 'high',   label: 'גבוהה',   badge: 'badge-red'    },
  { value: 'medium', label: 'בינונית', badge: 'badge-yellow' },
  { value: 'low',    label: 'נמוכה',   badge: 'badge-green'  },
]

function formatDate(d) {
  if (!d) return null
  const date  = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (date < today)                        return { text: 'באיחור - ' + date.toLocaleDateString('he-IL'), overdue: true }
  if (date.toDateString() === today.toDateString())    return { text: 'היום', overdue: false }
  if (date.toDateString() === tomorrow.toDateString()) return { text: 'מחר', overdue: false }
  return { text: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }), overdue: false }
}

const EMPTY = { title: '', contactId: '', priority: 'medium', dueDate: '' }

export default function Tasks({ tasks, contacts, onAddTask, onUpdateTask, onDeleteTask, onToggleTask }) {
  const [filter, setFilter] = useState('open')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY)

  const now = new Date()

  const filtered = tasks.filter(t => {
    if (filter === 'open')    return !t.completed
    if (filter === 'done')    return t.completed
    if (filter === 'overdue') return !t.completed && t.dueDate && new Date(t.dueDate) < now
    return true
  })

  const openCount    = tasks.filter(t => !t.completed).length
  const overdueCount = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now).length

  const openAdd  = () => { setForm(EMPTY); setModal({ mode: 'add' }) }
  const openEdit = (t) => { setForm({ ...EMPTY, ...t }); setModal({ mode: 'edit', task: t }) }
  const close    = () => setModal(null)
  const field    = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    modal.mode === 'add' ? onAddTask(form) : onUpdateTask(modal.task.id, form)
    close()
  }

  const handleDelete = (task) => {
    if (window.confirm(`למחוק את "${task.title}"?`)) {
      onDeleteTask(task.id)
      if (modal) close()
    }
  }

  const getContactName = (id) => contacts.find(c => c.id === id)?.name || ''

  const FILTERS = [
    { id: 'open',    label: `פתוחות (${openCount})` },
    { id: 'overdue', label: `באיחור (${overdueCount})` },
    { id: 'done',    label: 'הושלמו' },
    { id: 'all',     label: 'הכל' },
  ]

  return (
    <>
      <div className="page-header">
        <h2>משימות</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <PlusIcon /> הוסף משימה
        </button>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="filter-bar">
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`filter-btn ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>
                {filter === 'open'    ? 'אין משימות פתוחות'
                : filter === 'done'   ? 'אין משימות שהושלמו'
                : filter === 'overdue'? 'אין משימות באיחור'
                : 'אין משימות עדיין'}
              </p>
            </div>
          ) : filtered.map(task => {
            const di = formatDate(task.dueDate)
            const pr = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[1]
            return (
              <div key={task.id} className="task-item">
                <div
                  className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                  onClick={() => onToggleTask(task.id)}
                >
                  {task.completed && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div className="task-content">
                  <div className={`task-title ${task.completed ? 'done' : ''}`}>{task.title}</div>
                  <div className="task-meta">
                    <span className={`badge ${pr.badge}`}>{pr.label}</span>
                    {task.contactId && (
                      <span className="badge badge-gray">{getContactName(task.contactId)}</span>
                    )}
                    {di && (
                      <span style={{ fontSize: 12, color: di.overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {di.text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="task-actions">
                  <button className="btn-icon" onClick={() => openEdit(task)} title="עריכה">
                    <EditIcon />
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(task)} title="מחיקה" style={{ color: 'var(--danger)' }}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? 'הוספת משימה חדשה' : 'עריכת משימה'}</h3>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>כותרת המשימה *</label>
                    <input required value={form.title} onChange={field('title')} placeholder="תיאור המשימה" />
                  </div>
                  <div className="form-group">
                    <label>עדיפות</label>
                    <select value={form.priority} onChange={field('priority')}>
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>תאריך יעד</label>
                    <input type="date" value={form.dueDate} onChange={field('dueDate')} />
                  </div>
                  <div className="form-group full">
                    <label>לקוח קשור</label>
                    <select value={form.contactId} onChange={field('contactId')}>
                      <option value="">ללא לקוח ספציפי</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {modal.mode === 'add' ? 'הוסף משימה' : 'שמור שינויים'}
                </button>
                <button type="button" className="btn btn-outline" onClick={close}>ביטול</button>
                {modal.mode === 'edit' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(modal.task)}
                    style={{ marginRight: 'auto' }}
                  >
                    מחק
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
