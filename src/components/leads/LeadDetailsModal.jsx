import { useState } from 'react'
import { LEAD_STAGES, LEAD_SOURCES, ACTIVITY_TYPES } from '../../constants'
import { useActivities } from '../../hooks/useActivities'
import { fmtDT } from '../../utils/format'

function stageInfo(id) { return LEAD_STAGES.find(s => s.id === id) || { label: id, color: '#94a3b8', bg: '#f1f5f9' } }
function sourceInfo(id) { return LEAD_SOURCES.find(s => s.id === id) || { icon: '✍️', label: id } }
function typeInfo(id)   { return ACTIVITY_TYPES.find(t => t.id === id) || { icon: '📝', label: id } }

// ── Activity timeline ─────────────────────────────────────────────
function Timeline({ activities, loading, onAdd }) {
  const [text, setText]   = useState('')
  const [type, setType]   = useState('note')
  const [saving, setSaving] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try { await onAdd({ type, description: text.trim() }); setText('') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>היסטוריית פעילות</div>

      {/* Add activity */}
      <form onSubmit={submit} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {[
            { id: 'note',    icon: '📝' },
            { id: 'call',    icon: '📞' },
            { id: 'meeting', icon: '🤝' },
            { id: 'email',   icon: '✉️'  },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              style={{
                padding:      '4px 10px',
                borderRadius: 6,
                border:       `1px solid ${type === t.id ? '#f97316' : 'var(--border)'}`,
                background:   type === t.id ? '#fff7ed' : 'var(--bg2)',
                color:        type === t.id ? '#f97316' : 'var(--muted)',
                cursor:       'pointer',
                fontSize:     13,
              }}
            >{t.icon} {typeInfo(t.id).label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="הוסף הערה, שיחה, פגישה..."
            style={{
              flex: 1, padding: '8px 12px',
              borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--fg)', fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={saving || !text.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: '#f97316', color: '#fff', cursor: 'pointer',
              fontSize: 13, opacity: saving ? .6 : 1,
            }}
          >{saving ? '...' : '+ הוסף'}</button>
        </div>
      </form>

      {/* Timeline list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>טוען...</div>}
        {!loading && activities.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>
            אין פעילות עדיין
          </div>
        )}
        {activities.map((a, i) => {
          const ti = typeInfo(a.type)
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
              {/* Vertical line */}
              {i < activities.length - 1 && (
                <div style={{
                  position: 'absolute', right: 15, top: 28, bottom: -14,
                  width: 1, background: 'var(--border)',
                }}/>
              )}
              {/* Icon bubble */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, zIndex: 1,
              }}>{ti.icon}</div>
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{a.description}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {ti.label} • {fmtDT(a.createdAt)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────
export default function LeadDetailsModal({ lead, onClose, onUpdate, onMoveStage, onDelete }) {
  const { activities, loading, add } = useActivities(lead.id)
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ name: lead.name, phone: lead.phone || '', email: lead.email || '', city: lead.city || '', source: lead.source || 'manual' })

  const si = stageInfo(lead.leadStage)
  const src = sourceInfo(lead.source)

  const saveEdit = async () => {
    await onUpdate(lead.id, form)
    setEditing(false)
  }

  return (
    <div
      className="overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ width: 760, maxWidth: '97vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="modal-hd" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{lead.name}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 10px',
              borderRadius: 20, background: si.bg, color: si.color,
            }}>{si.label}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{src.icon} {src.label}</span>
            {lead.atRisk && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>⚠ בסיכון</span>}
          </div>
          <button className="icon-btn" onClick={onClose} style={{ fontSize: 22 }}>×</button>
        </div>

        {/* ── Body: two columns ────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: info + actions */}
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            padding: '18px 16px',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            {/* Stage selector */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>שלב בפייפליין</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LEAD_STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onMoveStage(lead.id, s.id)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: `1px solid ${lead.leadStage === s.id ? s.color : 'var(--border)'}`,
                      background: lead.leadStage === s.id ? s.bg : 'transparent',
                      color: lead.leadStage === s.id ? s.color : 'var(--muted)',
                      fontWeight: lead.leadStage === s.id ? 700 : 400,
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* Contact info */}
            {!editing ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>פרטי קשר</div>
                  <button className="icon-btn" onClick={() => setEditing(true)} style={{ fontSize: 12 }}>✏️ עריכה</button>
                </div>
                {[
                  lead.phone && { icon: '📞', label: lead.phone, href: `tel:${lead.phone}` },
                  lead.email && { icon: '✉️', label: lead.email, href: `mailto:${lead.email}` },
                  lead.city  && { icon: '📍', label: lead.city },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 6, color: 'var(--muted)' }}>
                    {item.icon}{' '}
                    {item.href
                      ? <a href={item.href} style={{ color: '#f97316', textDecoration: 'none' }}>{item.label}</a>
                      : item.label}
                  </div>
                ))}
                {!lead.phone && !lead.email && !lead.city && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>אין פרטי קשר</div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase' }}>עריכת פרטים</div>
                {['name','phone','email','city'].map(k => (
                  <input
                    key={k}
                    value={form[k]}
                    onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                    placeholder={{ name:'שם', phone:'טלפון', email:'אימייל', city:'עיר' }[k]}
                    style={{ display: 'block', width: '100%', marginBottom: 8, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveEdit} style={{ flex:1, padding:'7px', borderRadius:7, border:'none', background:'#f97316', color:'#fff', cursor:'pointer', fontSize:13 }}>שמור</button>
                  <button onClick={() => setEditing(false)} style={{ flex:1, padding:'7px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:13 }}>ביטול</button>
                </div>
              </div>
            )}

            {/* Quick action buttons */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>פעולות מהירות</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lead.phone && (
                  <a href={`https://wa.me/972${lead.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'#dcfce7', color:'#15803d', textDecoration:'none', fontSize:13, fontWeight:600 }}>
                    💬 שלח WhatsApp
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'var(--bg2)', color:'var(--fg)', textDecoration:'none', fontSize:13, border:'1px solid var(--border)' }}>
                    📞 חייג
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'var(--bg2)', color:'var(--fg)', textDecoration:'none', fontSize:13, border:'1px solid var(--border)' }}>
                    ✉️ שלח מייל
                  </a>
                )}
              </div>
            </div>

            {/* Danger zone */}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { if (window.confirm(`למחוק את ${lead.name} מהפייפליין?`)) onDelete(lead.id) }}
                style={{ width:'100%', padding:'8px', borderRadius:8, border:'1px solid #fca5a5', background:'transparent', color:'#ef4444', cursor:'pointer', fontSize:12 }}
              >
                🗑 מחק ליד
              </button>
            </div>
          </div>

          {/* Right: activity timeline */}
          <div style={{ flex: 1, padding: '18px 20px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Timeline activities={activities} loading={loading} onAdd={add} />
          </div>
        </div>
      </div>
    </div>
  )
}
