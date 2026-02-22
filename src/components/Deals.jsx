import React, { useState } from 'react'

const STAGES = [
  { id: 'lead',        label: 'ליד',               color: '#94a3b8' },
  { id: 'proposal',    label: 'הצעה',              color: '#3b82f6' },
  { id: 'negotiation', label: 'משא ומתן',           color: '#f59e0b' },
  { id: 'won',         label: 'נסגר - זכינו',       color: '#10b981' },
  { id: 'lost',        label: 'נסגר - הפסדנו',      color: '#ef4444' },
]

function formatCurrency(n) {
  return '₪' + Number(n || 0).toLocaleString('he-IL')
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY = { title: '', contactId: '', value: '', stage: 'lead', closeDate: '', notes: '' }

export default function Deals({ deals, contacts, onAddDeal, onUpdateDeal, onDeleteDeal }) {
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(EMPTY)

  const openAdd  = (stage = 'lead') => { setForm({ ...EMPTY, stage }); setModal({ mode: 'add' }) }
  const openEdit = (deal) => { setForm({ ...EMPTY, ...deal }); setModal({ mode: 'edit', deal }) }
  const close    = () => setModal(null)
  const field    = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    modal.mode === 'add' ? onAddDeal(form) : onUpdateDeal(modal.deal.id, form)
    close()
  }

  const handleDelete = (deal) => {
    if (window.confirm(`למחוק את "${deal.title}"?`)) {
      onDeleteDeal(deal.id)
      close()
    }
  }

  const getContactName = (id) => contacts.find(c => c.id === id)?.name || ''

  const pipelineValue = deals
    .filter(d => !['won', 'lost'].includes(d.stage))
    .reduce((s, d) => s + Number(d.value || 0), 0)

  return (
    <>
      <div className="page-header">
        <h2>עסקאות</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            שווי פייפליין: <strong style={{ color: 'var(--text)' }}>{formatCurrency(pipelineValue)}</strong>
          </span>
          <button className="btn btn-primary" onClick={() => openAdd()}>
            <PlusIcon /> הוסף עסקה
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="kanban-board">
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const stageValue = stageDeals.reduce((s, d) => s + Number(d.value || 0), 0)
            return (
              <div key={stage.id} className="kanban-column">
                <div className="kanban-column-header">
                  <span style={{ color: stage.color }}>{stage.label}</span>
                  <span className="kanban-count">{stageDeals.length}</span>
                </div>
                {stageValue > 0 && (
                  <div className="kanban-stage-value">{formatCurrency(stageValue)}</div>
                )}
                <div className="kanban-cards">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="kanban-card" onClick={() => openEdit(deal)}>
                      <div className="kanban-card-title">{deal.title}</div>
                      <div className="kanban-card-meta">
                        {deal.contactId && <span>{getContactName(deal.contactId)}</span>}
                        {deal.closeDate && <span>סגירה: {formatDate(deal.closeDate)}</span>}
                      </div>
                      {deal.value && (
                        <div className="kanban-card-value">{formatCurrency(deal.value)}</div>
                      )}
                    </div>
                  ))}
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '6px 10px', marginTop: 4 }}
                    onClick={() => openAdd(stage.id)}
                  >
                    + הוסף
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
              <h3>{modal.mode === 'add' ? 'הוספת עסקה חדשה' : 'עריכת עסקה'}</h3>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>שם העסקה *</label>
                    <input required value={form.title} onChange={field('title')} placeholder="תיאור העסקה" />
                  </div>
                  <div className="form-group">
                    <label>לקוח</label>
                    <select value={form.contactId} onChange={field('contactId')}>
                      <option value="">בחר לקוח...</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>שלב</label>
                    <select value={form.stage} onChange={field('stage')}>
                      {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>שווי (₪)</label>
                    <input type="number" value={form.value} onChange={field('value')} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label>תאריך סגירה משוער</label>
                    <input type="date" value={form.closeDate} onChange={field('closeDate')} />
                  </div>
                  <div className="form-group full">
                    <label>הערות</label>
                    <textarea value={form.notes} onChange={field('notes')} placeholder="הערות נוספות..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {modal.mode === 'add' ? 'הוסף עסקה' : 'שמור שינויים'}
                </button>
                <button type="button" className="btn btn-outline" onClick={close}>ביטול</button>
                {modal.mode === 'edit' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(modal.deal)}
                    style={{ marginRight: 'auto' }}
                  >
                    מחק עסקה
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
