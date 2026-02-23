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
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-hd">
          <span>ליד חדש</span>
          <button className="icon-btn" onClick={onClose} style={{ fontSize: 22 }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-bd">
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
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
              ✅ נוצרת אוטומטית: פעילות "ליד נוצר" + משימת פולואפ לעוד 2 ימים
            </div>
          </div>
          <div className="modal-ft">
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
