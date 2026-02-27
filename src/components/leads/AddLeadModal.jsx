import { useState } from 'react'
import { LEAD_SOURCES } from '../../constants'

export default function AddLeadModal({ onSave, onClose }) {
  const [form, setForm]   = useState({ name: '', phone: '', email: '', city: '', source: 'manual' })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) }
    finally { setSaving(false) }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="mh">
          <h3>ליד חדש</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="mb">
            <div className="fg">
              <div className="frow full"><label>שם *</label><input required value={form.name} onChange={f('name')} placeholder="שם מלא..."/></div>
              <div className="frow"><label>טלפון</label><input value={form.phone} onChange={f('phone')} placeholder="05x-xxxxxxx"/></div>
              <div className="frow"><label>אימייל</label><input type="email" value={form.email} onChange={f('email')} placeholder="name@example.com"/></div>
              <div className="frow"><label>עיר</label><input value={form.city} onChange={f('city')} placeholder="תל אביב"/></div>
              <div className="frow full">
                <label>מקור</label>
                <select value={form.source} onChange={f('source')}>
                  {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
              ✅ נוצרת אוטומטית: פעילות "ליד נוצר" + משימת פולואפ לעוד 2 ימים
            </div>
          </div>
          <div className="mf">
            <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn btn-p" disabled={saving}>
              {saving ? 'שומר...' : '+ הוסף ליד'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
