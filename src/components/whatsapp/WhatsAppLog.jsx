import { useState, useEffect } from 'react'
import { fetchMessages } from '../../services/whatsappService'

export default function WhatsAppLog({ contactId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!contactId) return
    setLoading(true)
    fetchMessages(contactId, 30).then(msgs => {
      setMessages(msgs)
      setLoading(false)
    })
  }, [contactId])

  if (loading) return <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)' }}>טוען הודעות...</div>
  if (!messages.length) return <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)' }}>אין הודעות WhatsApp</div>

  return (
    <div style={{ maxHeight: 300, overflowY: 'auto', padding: '8px 0' }}>
      {messages.map(m => (
        <div key={m.id} style={{
          display: 'flex', flexDirection: 'column',
          alignItems: m.direction === 'outgoing' ? 'flex-start' : 'flex-end',
          marginBottom: 8, padding: '0 8px',
        }}>
          <div style={{
            maxWidth: '80%', padding: '8px 12px', borderRadius: 10,
            background: m.direction === 'outgoing' ? '#dcf8c6' : '#e3f2fd',
            fontSize: 13, lineHeight: 1.4,
          }}>
            <div>{m.message}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 4, textAlign: 'left' }}>
              {m.direction === 'outgoing' ? '←' : '→'} {new Date(m.created_at).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {m.status && m.direction === 'outgoing' && (
                <span style={{ marginRight: 6 }}>
                  {m.status === 'sent' ? '✓' : m.status === 'delivered' ? '✓✓' : m.status === 'read' ? '✓✓' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
