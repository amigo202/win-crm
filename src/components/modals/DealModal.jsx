import { useState } from 'react'
import { PROGRAMS, STAGES } from '../../constants'

export default function DealModal({ deal, contacts, initStage, onSave, onClose, onDel }) {
  const [form, setForm] = useState(() => deal ? { ...deal } : {
    title: '', contactId: '', value: '', stage: initStage || 'lead',
    program: '', closeDate: '', notes: '',
  })
  const f   = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const sub = e => { e.preventDefault(); if (!form.title.trim()) return; onSave(form); onClose() }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="mh"><h3>{deal ? 'עריכת עסקה' : 'עסקה חדשה'}</h3><button className="mx" onClick={onClose}>×</button></div>
        <form onSubmit={sub}>
          <div className="mb"><div className="fg">
            <div className="frow full"><label>שם *</label><input required value={form.title} onChange={f('title')} placeholder="שם העסקה"/></div>
            <div className="frow"><label>איש קשר</label><select value={form.contactId} onChange={f('contactId')}><option value="">בחר...</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="frow"><label>שלב</label><select value={form.stage} onChange={f('stage')}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="frow"><label>שווי ₪</label><input type="number" value={form.value} onChange={f('value')} placeholder="0" min="0"/></div>
            <div className="frow"><label>תוכנית</label><select value={form.program} onChange={f('program')}><option value="">ללא</option>{PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="frow full"><label>תאריך סגירה</label><input type="date" value={form.closeDate} onChange={f('closeDate')}/></div>
            <div className="frow full"><label>הערות</label><textarea value={form.notes} onChange={f('notes')} placeholder="הערות..."/></div>
          </div></div>
          <div className="mf">
            <button type="submit" className="btn btn-p">{deal ? 'שמור' : 'הוסף'}</button>
            <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
            {deal && <button type="button" className="del-link" onClick={() => { if (window.confirm('למחוק?')) onDel(deal.id) }}>מחק</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
