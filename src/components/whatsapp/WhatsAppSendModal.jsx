import { useState, useEffect } from 'react'
import { fetchTemplates, interpolateTemplate, openWhatsAppLink, sendWhatsApp } from '../../services/whatsappService'

export default function WhatsAppSendModal({ contact, onClose, onSent }) {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)
  const [mode, setMode]         = useState('template') // template | free | link

  useEffect(() => {
    fetchTemplates().then(setTemplates)
  }, [])

  const vars = {
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    date: new Date().toLocaleDateString('he-IL'),
  }

  const selectTemplate = t => {
    setSelectedTemplate(t)
    setMessage(interpolateTemplate(t.body, vars))
  }

  const handleSend = async () => {
    if (!message.trim() || !contact?.phone) return
    setSending(true)
    try {
      await sendWhatsApp({
        contactId:    contact.id,
        phone:        contact.phone,
        message,
        templateId:   selectedTemplate?.id,
        templateVars: vars,
      })
      onSent?.()
      onClose()
    } catch (err) {
      // Fallback to wa.me link if Edge Function fails
      console.warn('Edge Function failed, opening wa.me link:', err)
      openWhatsAppLink(contact.phone, message)
      onClose()
    } finally {
      setSending(false)
    }
  }

  const handleWaLink = () => {
    openWhatsAppLink(contact?.phone, message)
    onClose()
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="mh">
          <h3>💬 שלח הודעת WhatsApp</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          {/* Contact info */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{contact?.name || 'ללא שם'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{contact?.phone || 'ללא טלפון'}</div>
            </div>
          </div>

          {!contact?.phone && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              ⚠️ אין מספר טלפון לאיש קשר זה
            </div>
          )}

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[
              { id: 'template', label: '📋 תבנית' },
              { id: 'free', label: '✍️ חופשי' },
              { id: 'link', label: '🔗 קישור' },
            ].map(m => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                  background: mode === m.id ? '#f97316' : 'var(--surface)',
                  color: mode === m.id ? '#fff' : 'var(--text)',
                }}>{m.label}</button>
            ))}
          </div>

          {/* Template list */}
          {mode === 'template' && (
            <div style={{ marginBottom: 12 }}>
              {templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13 }}>
                  אין תבניות עדיין. צור תבניות בדף האוטומציות.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => selectTemplate(t)}
                      style={{
                        textAlign: 'right', padding: '10px 12px', borderRadius: 8,
                        border: selectedTemplate?.id === t.id ? '2px solid #f97316' : '1px solid var(--border)',
                        background: selectedTemplate?.id === t.id ? '#fff7ed' : 'var(--surface)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {t.body?.slice(0, 60)}{t.body?.length > 60 ? '...' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message textarea */}
          {(mode === 'template' || mode === 'free') && (
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="הקלד הודעה..." rows={4}
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}/>
          )}

          {mode === 'link' && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <p style={{ fontSize: 14, marginBottom: 12 }}>לחיצה תפתח את WhatsApp Web / אפליקציה</p>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="הודעה ראשונית (אופציונלי)..." rows={3}
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }}/>
            </div>
          )}
        </div>
        <div className="mf">
          {mode === 'link' ? (
            <button type="button" className="btn btn-p" onClick={handleWaLink} disabled={!contact?.phone}
              style={{ background: '#25D366' }}>
              🔗 פתח WhatsApp
            </button>
          ) : (
            <button type="button" className="btn btn-p" onClick={handleSend}
              disabled={!message.trim() || !contact?.phone || sending}
              style={{ background: '#25D366' }}>
              {sending ? '⏳ שולח...' : '💬 שלח הודעה'}
            </button>
          )}
          <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
