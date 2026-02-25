import { useState, useRef, useEffect } from 'react'

// ── localStorage hook ──────────────────────────────────────────────────────
function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : init }
    catch { return init }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key, v])
  return [v, sv]
}

// ── Constants ──────────────────────────────────────────────────────────────
const ACTION_ICONS = {
  create_task:       '✅',
  create_contact:    '👤',
  create_deal:       '💼',
  create_lead:       '🎯',
  open_whatsapp:     '💬',
  create_instructor: '🏋️',
  create_salary:     '💰',
}

const MODELS = [
  { id: 'gemini-3-pro-preview',   label: 'Gemini 3 Pro 🧠',   desc: 'חכם ומדויק יותר' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash ⚡',  desc: 'מהיר יותר' },
]

const HINTS = [
  'להתקשר לדני מחר',
  'הוסף איש קשר שמו יוסי כהן 050-1234567',
  'יש ליד חדש מפייסבוק שמו דנה לוי',
  'עסקה עם משה על סך 5000 ₪',
]

// ── Bubble component ───────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser     = msg.role === 'user'
  const isError    = msg.role === 'error'
  const isQuestion = msg.role === 'agent' && !msg.actions?.length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      {msg.preview && (
        <img src={msg.preview} alt="" style={{ maxWidth: 150, maxHeight: 110, borderRadius: 8, marginBottom: 4, objectFit: 'cover' }}/>
      )}
      <div style={{
        maxWidth:     '85%',
        padding:      '8px 12px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background:   isUser ? '#f97316' : isError ? '#fee2e2' : isQuestion ? '#fff7ed' : 'var(--card)',
        color:        isUser ? '#fff' : isError ? '#dc2626' : 'var(--fg)',
        fontSize:     13,
        lineHeight:   1.55,
        border:       isUser ? 'none' : isQuestion ? '1px solid #fed7aa' : '1px solid var(--border)',
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
        direction:    'rtl',
        textAlign:    'right',
      }}>
        {isQuestion && <span style={{ marginLeft: 5 }}>❓</span>}
        {msg.text}
      </div>

      {msg.actions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, maxWidth: '85%', direction: 'rtl' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 4px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#f97316',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .5; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl  = e.target.result
      const base64   = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      resolve({ base64, mimeType, preview: dataUrl })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Settings Panel ─────────────────────────────────────────────────────────
function SettingsPanel({ model, setModel, onClear }) {
  return (
    <div style={{
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 14px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, direction: 'rtl', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        מודל AI
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            style={{
              flex: 1, padding: '7px 6px', borderRadius: 9, cursor: 'pointer',
              border: `2px solid ${model === m.id ? '#f97316' : 'var(--border)'}`,
              background: model === m.id ? 'rgba(249,115,22,.1)' : 'var(--bg)',
              color: model === m.id ? '#f97316' : 'var(--muted)',
              fontSize: 11, fontWeight: 700, textAlign: 'center',
              transition: 'all .15s', direction: 'rtl',
            }}
          >
            <div style={{ fontSize: 12 }}>{m.label}</div>
            <div style={{ fontWeight: 400, fontSize: 10, marginTop: 2, opacity: .8 }}>{m.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        style={{
          width: '100%', padding: '7px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid #fca5a5', background: '#fff1f2',
          color: '#ef4444', fontSize: 12, fontWeight: 600, direction: 'rtl',
        }}
      >
        🗑️ נקה היסטוריית שיחה
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AgentPanel({ open, onToggle, contacts, instructors = [], agent }) {
  const [input, setInput]           = useState('')
  const [image, setImage]           = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [model, setModel]           = useLS('crm_agent_model', 'gemini-3-pro-preview')
  const [fabPos, setFabPos]         = useLS('crm_fab_pos', { bottom: 20, right: 20 })
  const bottomRef    = useRef(null)
  const textareaRef  = useRef(null)
  const fileInputRef = useRef(null)
  const fabDragRef   = useRef({ active: false, startX: 0, startY: 0, startRight: 20, startBottom: 20, moved: false })
  const { messages, loading, send, clear } = agent

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200)
    else setShowSettings(false)
  }, [open])

  const submit = () => {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    setImage(null)
    send(txt, contacts, image, instructors, model)
  }

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onFabDown = e => {
    e.preventDefault()
    const d = fabDragRef.current
    d.active = true; d.startX = e.clientX; d.startY = e.clientY
    d.startRight = fabPos.right; d.startBottom = fabPos.bottom; d.moved = false
    const move = ev => {
      if (!fabDragRef.current.active) return
      const dx = ev.clientX - fabDragRef.current.startX
      const dy = ev.clientY - fabDragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) fabDragRef.current.moved = true
      const r = Math.max(10, Math.min(window.innerWidth  - 64, fabDragRef.current.startRight  - dx))
      const b = Math.max(10, Math.min(window.innerHeight - 64, fabDragRef.current.startBottom - dy))
      setFabPos({ right: r, bottom: b })
    }
    const up = () => {
      fabDragRef.current.active = false
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      if (!fabDragRef.current.moved) onToggle()
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const onPaste = async e => {
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    try { setImage(await readImage(item.getAsFile())) } catch {}
  }

  const onFileChange = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    try { setImage(await readImage(file)) } catch {}
    e.target.value = ''
  }

  const handleClear = () => { clear(); setShowSettings(false) }

  return (
    <>
      {/* ── Floating chat window ───────────────────────────────────── */}
      <div style={{
        position:      'fixed',
        bottom:        fabPos.bottom + 64,
        right:         fabPos.right,
        width:         370,
        height:        520,
        zIndex:        300,
        display:       'flex',
        flexDirection: 'column',
        background:    'var(--bg)',
        border:        '1px solid var(--border)',
        borderRadius:  16,
        boxShadow:     '0 8px 48px rgba(0,0,0,.28)',
        overflow:      'hidden',
        transform:     open ? 'scale(1) translateY(0)' : 'scale(.96) translateY(14px)',
        opacity:       open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition:    'transform .22s cubic-bezier(.4,0,.2,1), opacity .22s ease',
        transformOrigin: 'bottom right',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 13px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)', lineHeight: 1.2 }}>סוכן AI</div>
              <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>{currentModel.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button
              onClick={() => setShowSettings(s => !s)}
              title="הגדרות"
              style={{
                background: showSettings ? 'rgba(249,115,22,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '5px 7px',
                borderRadius: 7, fontSize: 14, lineHeight: 1,
                color: showSettings ? '#f97316' : 'var(--muted)',
                transition: 'background .15s',
              }}
            >⚙️</button>
            <button
              onClick={onToggle}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 18, color: 'var(--muted)', lineHeight: 1,
                padding: '5px 7px', borderRadius: 7,
              }}
            >×</button>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <SettingsPanel model={model} setModel={setModel} onClear={handleClear}/>
        )}

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 12px 6px',
          display: 'flex', flexDirection: 'column',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🤖</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, direction: 'rtl' }}>
                כתוב לי מה לעשות — אני אדאג לשאר
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {HINTS.map((h, i) => (
                  <button key={i}
                    onClick={() => { setInput(h); textareaRef.current?.focus() }}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                      fontSize: 11, color: 'var(--fg)', textAlign: 'right',
                      direction: 'rtl', transition: 'border-color .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >{h}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => <Bubble key={msg.id} msg={msg}/>)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '14px 14px 14px 4px', padding: '3px 12px',
              }}>
                <TypingDots/>
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 10px 10px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}>
          {image && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
              <img src={image.preview} alt="" style={{ height: 52, borderRadius: 7, objectFit: 'cover', maxWidth: '100%' }}/>
              <button
                onClick={() => setImage(null)}
                style={{
                  position: 'absolute', top: -5, right: -5,
                  background: '#ef4444', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 15, height: 15, fontSize: 9,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 5, alignItems: 'flex-end',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '5px 7px',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="צרף תמונה (Ctrl+V להדבקה)"
              style={{
                background: image ? 'rgba(249,115,22,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '3px 4px',
                color: image ? '#f97316' : 'var(--muted)', fontSize: 15,
                borderRadius: 6, flexShrink: 0, alignSelf: 'flex-end',
              }}
            >📎</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange}/>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              placeholder="כתוב משימה, איש קשר, עסקה, ליד..."
              rows={2}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                color: 'var(--fg)', fontSize: 12, outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5, direction: 'rtl',
              }}
              disabled={loading}
            />
            <button
              onClick={submit}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? '#f97316' : 'var(--bg2)',
                border: 'none', borderRadius: 7,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                padding: '5px 9px', color: input.trim() && !loading ? '#fff' : 'var(--muted)',
                fontSize: 15, transition: 'background .15s',
                flexShrink: 0, alignSelf: 'flex-end',
              }}
            >➤</button>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, textAlign: 'center', direction: 'rtl' }}>
            Enter לשלוח · Shift+Enter שורה חדשה · 📎 תמונה · Ctrl+K פתח/סגור
          </div>
        </div>
      </div>

      {/* ── FAB toggle button (draggable) ──────────────────────────── */}
      <button
        onPointerDown={onFabDown}
        title="סוכן AI (Ctrl+K) — גרור להזזה"
        style={{
          position:     'fixed',
          bottom:       isMobile ? Math.max(fabPos.bottom, 68) : fabPos.bottom,
          right:        fabPos.right,
          width:        54,
          height:       54,
          borderRadius: '50%',
          background:   open ? '#1e293b' : 'linear-gradient(135deg,#f97316,#ea580c)',
          border:       'none',
          cursor:       'grab',
          boxShadow:    open ? '0 4px 16px rgba(0,0,0,.35)' : '0 4px 22px rgba(249,115,22,.5)',
          fontSize:     open ? 22 : 20,
          zIndex:       301,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          transition:   'background .2s ease, box-shadow .2s ease',
          color:        '#fff',
          userSelect:   'none',
          touchAction:  'none',
        }}
        onMouseEnter={e => { if (!fabDragRef.current.active) e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {open ? '✕' : '🤖'}
      </button>
    </>
  )
}
