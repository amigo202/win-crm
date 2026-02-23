import { useState, useRef, useEffect } from 'react'

const ACTION_ICONS = {
  create_task:    '✅',
  create_contact: '👤',
  create_deal:    '💼',
  create_lead:    '🎯',
  open_whatsapp:  '💬',
}

const HINTS = [
  'להתקשר לדני מחר',
  'הוסף איש קשר שמו יוסי כהן 050-1234567',
  'יש ליד חדש מפייסבוק שמו דנה לוי',
  'עסקה עם משה על סך 5000 ₪',
]

function Bubble({ msg }) {
  const isUser  = msg.role === 'user'
  const isError = msg.role === 'error'

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    isUser ? 'flex-end' : 'flex-start',
      marginBottom:  10,
    }}>
      <div style={{
        maxWidth:     '85%',
        padding:      '9px 13px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background:   isUser ? '#f97316' : isError ? '#fee2e2' : 'var(--card)',
        color:        isUser ? '#fff' : isError ? '#dc2626' : 'var(--fg)',
        fontSize:     13,
        lineHeight:   1.5,
        border:       isUser ? 'none' : '1px solid var(--border)',
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
      }}>
        {msg.text}
      </div>

      {/* Action badges */}
      {msg.actions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5, maxWidth: '85%' }}>
          {msg.actions.map((a, i) => {
            const isErr = a.summary?.startsWith('שגיאה')
            const isWa  = a.type === 'open_whatsapp' && a.url
            const s = {
              fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600,
              background: isErr ? '#fee2e2' : isWa ? '#dcfce7' : '#d1fae5',
              color:      isErr ? '#dc2626' : isWa ? '#15803d' : '#065f46',
              textDecoration: 'none', display: 'inline-block',
            }
            if (isWa) return <a key={i} href={a.url} target="_blank" rel="noreferrer" style={s}>{ACTION_ICONS[a.type]} {a.summary}</a>
            return <span key={i} style={s}>{ACTION_ICONS[a.type] ?? '•'} {a.summary}</span>
          })}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 4px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#f97316',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .5; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function AgentPanel({ open, onClose, contacts, agent }) {
  const [input, setInput]   = useState('')
  const bottomRef           = useRef(null)
  const textareaRef         = useRef(null)
  const { messages, loading, send } = agent

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 250)
  }, [open])

  const submit = () => {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    send(txt, contacts)
  }

  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.25)',
            zIndex: 299,
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position:   'fixed',
        top:        0,
        right:      0,
        bottom:     0,
        width:      360,
        zIndex:     300,
        display:    'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        boxShadow:  '-4px 0 24px rgba(0,0,0,.15)',
        transform:  open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>סוכן AI</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>כתוב בעברית חופשית</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--muted)', lineHeight: 1,
              padding: '4px 6px', borderRadius: 6,
            }}
          >×</button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 14px 8px',
          display: 'flex', flexDirection: 'column',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                כתוב לי מה לעשות — אני אדאג לשאר
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {HINTS.map((h, i) => (
                  <button key={i}
                    onClick={() => { setInput(h); textareaRef.current?.focus() }}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 12, color: 'var(--fg)', textAlign: 'right',
                    }}
                    onMouseEnter={e => e.target.style.borderColor = '#f97316'}
                    onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => <Bubble key={msg.id} msg={msg}/>)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '14px 14px 14px 4px', padding: '4px 12px',
              }}>
                <TypingDots/>
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 12px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: '6px 8px',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="כתוב משימה, איש קשר, עסקה, ליד..."
              rows={2}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                color: 'var(--fg)', fontSize: 13, outline: 'none',
                fontFamily: "inherit", lineHeight: 1.5, direction: 'rtl',
              }}
              disabled={loading}
            />
            <button
              onClick={submit}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? '#f97316' : 'var(--bg2)',
                border: 'none', borderRadius: 7, cursor: input.trim() && !loading ? 'pointer' : 'default',
                padding: '6px 10px', color: input.trim() && !loading ? '#fff' : 'var(--muted)',
                fontSize: 16, transition: 'background .15s',
                flexShrink: 0, alignSelf: 'flex-end',
              }}
            >
              ➤
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
            Ctrl+Enter לשליחה
          </div>
        </div>
      </div>
    </>
  )
}
