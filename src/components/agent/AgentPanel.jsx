import { useState, useRef, useEffect, useCallback } from 'react'

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
function Bubble({ msg, isMobile }) {
  const isUser     = msg.role === 'user'
  const isError    = msg.role === 'error'
  const isQuestion = msg.role === 'agent' && !msg.actions?.length
  const fontSize   = isMobile ? 15 : 13

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: isMobile ? 6 : 10,
    }}>
      {msg.preview && (
        <img src={msg.preview} alt="" style={{ maxWidth: isMobile ? 200 : 150, maxHeight: 140, borderRadius: 10, marginBottom: 4, objectFit: 'cover' }}/>
      )}
      {msg.isAudio && (
        <div style={{ background:'#ede9fe', borderRadius:8, padding:'4px 10px', marginBottom:4, fontSize: isMobile ? 13 : 11, color:'#7c3aed', fontWeight:600 }}>
          🎤 הודעה קולית {msg.audioDur ? `(${msg.audioDur}ש׳)` : ''}
        </div>
      )}
      <div style={{
        maxWidth:     isMobile ? '80%' : '85%',
        padding:      isMobile ? '9px 13px' : '8px 12px',
        borderRadius: isUser
          ? (isMobile ? '18px 18px 4px 18px' : '14px 14px 4px 14px')
          : (isMobile ? '18px 18px 18px 4px' : '14px 14px 14px 4px'),
        background:   isUser
          ? '#f97316'
          : isError
            ? '#fee2e2'
            : isMobile
              ? (isQuestion ? '#fff7ed' : '#ffffff')
              : (isQuestion ? '#fff7ed' : 'var(--card)'),
        color:        isUser ? '#fff' : isError ? '#dc2626' : 'var(--fg)',
        fontSize,
        lineHeight:   isMobile ? 1.5 : 1.55,
        fontFamily:   isMobile ? '-apple-system, "Helvetica Neue", Arial, sans-serif' : 'inherit',
        boxShadow:    isMobile ? '0 1px 1px rgba(0,0,0,.1)' : 'none',
        border:       isUser ? 'none' : isQuestion ? '1px solid #fed7aa' : (isMobile ? 'none' : '1px solid var(--border)'),
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
        direction:    'rtl',
        textAlign:    'right',
      }}>
        {isQuestion && <span style={{ marginLeft: 5 }}>❓</span>}
        {msg.text}
      </div>

      {msg.actions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 5 : 4, marginTop: isMobile ? 5 : 5, maxWidth: isMobile ? '80%' : '85%', direction: 'rtl' }}>
          {msg.actions.map((a, i) => {
            const isErr = a.summary?.startsWith('שגיאה')
            const isWa  = a.type === 'open_whatsapp' && a.url
            const s = {
              fontSize: isMobile ? 12 : 11,
              padding: isMobile ? '5px 11px' : '3px 8px',
              borderRadius: 20, fontWeight: 600,
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
export default function AgentPanel({ open, onToggle, contacts, instructors = [], tasks = [], deals = [], leads = [], students = [], agent }) {
  const [input, setInput]               = useState('')
  const [image, setImage]               = useState(null)
  const [audio, setAudio]               = useState(null)   // { base64, mimeType, durationSec }
  const [recording, setRecording]       = useState(false)
  const [recSec, setRecSec]             = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [model, setModel]               = useLS('crm_agent_model', 'gemini-3-pro-preview')
  const [fabPos, setFabPos]             = useLS('crm_fab_pos', { bottom: 20, right: 20 })
  const bottomRef      = useRef(null)
  const textareaRef    = useRef(null)
  const fileInputRef   = useRef(null)
  const mediaRecRef    = useRef(null)
  const recTimerRef    = useRef(null)
  const fabDragRef     = useRef({ active: false, startX: 0, startY: 0, startRight: 20, startBottom: 20, moved: false })
  const { messages, loading, send, clear } = agent

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = windowWidth <= 768

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200)
    else setShowSettings(false)
  }, [open])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(recTimerRef.current)
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = e => {
          setAudio({ base64: e.target.result.split(',')[1], mimeType: 'audio/webm', durationSec: recTimerRef._sec || 0 })
        }
        reader.readAsDataURL(blob)
        setRecording(false)
      }
      mr.start()
      mediaRecRef.current = mr
      recTimerRef._sec = 0
      setRecSec(0)
      setRecording(true)
      recTimerRef.current = setInterval(() => { recTimerRef._sec = (recTimerRef._sec || 0) + 1; setRecSec(s => s + 1) }, 1000)
    } catch { alert('לא ניתן לגשת למיקרופון. בדוק הרשאות דפדפן.') }
  }

  const stopRecording = () => { mediaRecRef.current?.stop() }

  const submit = () => {
    const media = audio || image
    const txt   = input.trim() || (audio ? '🎤 הודעה קולית' : '')
    if (!txt || loading) return
    setInput('')
    setImage(null)
    setAudio(null)
    send(txt, contacts, media, instructors, model, { tasks, deals, leads, students })
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
        bottom:        isMobile ? 0 : fabPos.bottom + 64,
        right:         isMobile ? 0 : fabPos.right,
        left:          isMobile ? 0 : 'auto',
        top:           isMobile ? 0 : 'auto',
        width:         isMobile ? '100%' : 370,
        height:        isMobile ? '100%' : 520,
        zIndex:        300,
        display:       'flex',
        flexDirection: 'column',
        background:    isMobile ? '#ece5dd' : 'var(--bg)',
        border:        isMobile ? 'none' : '1px solid var(--border)',
        borderRadius:  isMobile ? 0 : 16,
        boxShadow:     isMobile ? 'none' : '0 8px 48px rgba(0,0,0,.28)',
        overflow:      'hidden',
        transform:     open ? 'scale(1) translateY(0)' : isMobile ? 'translateY(100%)' : 'scale(.96) translateY(14px)',
        opacity:       open ? 1 : (isMobile ? 1 : 0),
        pointerEvents: open ? 'auto' : 'none',
        transition:    isMobile
          ? 'transform .28s cubic-bezier(.4,0,.2,1)'
          : 'transform .22s cubic-bezier(.4,0,.2,1), opacity .22s ease',
        transformOrigin: 'bottom right',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '11px 13px',
          paddingTop: isMobile ? 'max(12px, env(safe-area-inset-top))' : '11px',
          borderBottom: '1px solid var(--border)',
          background: isMobile ? '#075e54' : 'var(--card)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 8 }}>
            {isMobile && (
              <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '0 2px', lineHeight: 1 }}>←</button>
            )}
            <div style={{
              width: isMobile ? 40 : 32, height: isMobile ? 40 : 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? 20 : 16, flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 16 : 13, color: isMobile ? '#fff' : 'var(--fg)', lineHeight: 1.2 }}>סוכן AI</div>
              <div style={{ fontSize: isMobile ? 12 : 10, color: isMobile ? '#b2dfdb' : '#f97316', fontWeight: 500 }}>{currentModel.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button
              onClick={() => setShowSettings(s => !s)}
              title="הגדרות"
              style={{
                background: showSettings ? 'rgba(255,255,255,.2)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '5px 7px',
                borderRadius: 7, fontSize: 16, lineHeight: 1,
                color: isMobile ? '#fff' : (showSettings ? '#f97316' : 'var(--muted)'),
                transition: 'background .15s',
              }}
            >⚙️</button>
            {!isMobile && (
              <button
                onClick={onToggle}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 18, color: 'var(--muted)', lineHeight: 1,
                  padding: '5px 7px', borderRadius: 7,
                }}
              >×</button>
            )}
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <SettingsPanel model={model} setModel={setModel} onClear={handleClear}/>
        )}

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? '10px 10px 6px' : '12px 12px 6px',
          display: 'flex', flexDirection: 'column',
          backgroundImage: isMobile
            ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23ece5dd\'/%3E%3C/svg%3E")'
            : 'none',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: isMobile ? 30 : 14 }}>
              <div style={{ fontSize: isMobile ? 48 : 30, marginBottom: isMobile ? 12 : 6 }}>🤖</div>
              <div style={{ fontSize: isMobile ? 15 : 12, color: isMobile ? '#555' : 'var(--muted)', marginBottom: 16, direction: 'rtl', fontWeight: isMobile ? 500 : 400 }}>
                שלום! אני הסוכן החכם שלך — כתוב לי מה לעשות
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 5 }}>
                {HINTS.map((h, i) => (
                  <button key={i}
                    onClick={() => { setInput(h); textareaRef.current?.focus() }}
                    style={{
                      background: isMobile ? '#fff' : 'var(--bg2)',
                      border: isMobile ? 'none' : '1px solid var(--border)',
                      borderRadius: isMobile ? 12 : 8,
                      padding: isMobile ? '10px 14px' : '6px 10px',
                      cursor: 'pointer',
                      fontSize: isMobile ? 14 : 11,
                      color: 'var(--fg)', textAlign: 'right',
                      direction: 'rtl', transition: 'border-color .15s',
                      boxShadow: isMobile ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
                    }}
                    onMouseEnter={e => !isMobile && (e.currentTarget.style.borderColor = '#f97316')}
                    onMouseLeave={e => !isMobile && (e.currentTarget.style.borderColor = 'var(--border)')}
                  >{h}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => <Bubble key={msg.id} msg={msg} isMobile={isMobile}/>)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                background: isMobile ? '#fff' : 'var(--card)',
                border: isMobile ? 'none' : '1px solid var(--border)',
                borderRadius: isMobile ? '18px 18px 18px 4px' : '14px 14px 14px 4px',
                padding: '3px 12px',
                boxShadow: isMobile ? '0 1px 1px rgba(0,0,0,.1)' : 'none',
              }}>
                <TypingDots/>
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{
          padding: isMobile ? '8px 10px' : '8px 10px 10px',
          paddingBottom: isMobile ? 'max(8px, env(safe-area-inset-bottom))' : '10px',
          borderTop: isMobile ? 'none' : '1px solid var(--border)',
          background: isMobile ? '#ece5dd' : 'var(--card)',
          flexShrink: 0,
        }}>
          {image && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
              <img src={image.preview} alt="" style={{ height: isMobile ? 64 : 52, borderRadius: 7, objectFit: 'cover', maxWidth: '100%' }}/>
              <button onClick={() => setImage(null)}
                style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: isMobile ? 20 : 15, height: isMobile ? 20 : 15, fontSize: isMobile ? 12 : 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
          {audio && (
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, background:'#ede9fe', borderRadius:8, padding: isMobile ? '7px 12px' : '5px 10px' }}>
              <span style={{ fontSize: isMobile ? 18 : 14 }}>🎤</span>
              <span style={{ fontSize: isMobile ? 14 : 12, color:'#7c3aed', fontWeight:600 }}>{audio.durationSec}ש׳ מוקלט</span>
              <button onClick={() => setAudio(null)} style={{ marginRight:'auto', background:'none', border:'none', color:'#7c3aed', cursor:'pointer', fontSize: isMobile ? 18 : 13, padding:'1px 4px' }}>×</button>
            </div>
          )}
          {recording && (
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, background:'#fee2e2', borderRadius:8, padding: isMobile ? '7px 12px' : '5px 10px', direction:'rtl' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', animation:'pulse 1s ease-in-out infinite', flexShrink:0 }}/>
              <span style={{ fontSize: isMobile ? 14 : 12, color:'#dc2626', fontWeight:600 }}>מקליט... {recSec}ש׳</span>
              <button onClick={stopRecording} style={{ marginRight:'auto', background:'#ef4444', border:'none', color:'#fff', cursor:'pointer', fontSize: isMobile ? 13 : 11, borderRadius:5, padding: isMobile ? '4px 12px' : '2px 8px', fontFamily:'inherit' }}>עצור</button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: isMobile ? 8 : 5, alignItems: 'flex-end',
            background: '#fff',
            border: isMobile ? 'none' : '1px solid var(--border)',
            borderRadius: isMobile ? 24 : 10,
            padding: isMobile ? '8px 12px' : '5px 7px',
            boxShadow: isMobile ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || recording}
              title="צרף תמונה"
              style={{
                background: image ? 'rgba(249,115,22,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: isMobile ? '2px 2px' : '3px 4px',
                color: image ? '#f97316' : '#8696a0', fontSize: isMobile ? 20 : 15,
                borderRadius: 6, flexShrink: 0, alignSelf: 'flex-end',
              }}
            >📎</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange}/>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading || !!image}
              title={recording ? 'עצור הקלטה' : 'הקלטה קולית'}
              style={{
                background: recording ? 'rgba(239,68,68,.15)' : audio ? 'rgba(124,58,237,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: isMobile ? '2px 2px' : '3px 4px',
                color: recording ? '#ef4444' : audio ? '#7c3aed' : '#8696a0',
                fontSize: isMobile ? 20 : 15,
                borderRadius: 6, flexShrink: 0, alignSelf: 'flex-end',
              }}
            >{recording ? '⏹' : '🎤'}</button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              placeholder="הודעה..."
              rows={isMobile ? 1 : 2}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                color: 'var(--fg)', fontSize: isMobile ? 15 : 12, outline: 'none',
                fontFamily: isMobile ? '-apple-system, "Helvetica Neue", Arial, sans-serif' : 'inherit',
                lineHeight: 1.5, direction: 'rtl',
                maxHeight: isMobile ? 100 : 'none',
              }}
              disabled={loading}
            />
            <button
              onClick={submit}
              disabled={(!input.trim() && !audio) || loading}
              style={{
                background: (input.trim() || audio) && !loading ? '#25d366' : '#8696a0',
                border: 'none', borderRadius: '50%',
                cursor: (input.trim() || audio) && !loading ? 'pointer' : 'default',
                width: isMobile ? 38 : 28, height: isMobile ? 38 : 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: isMobile ? 17 : 15,
                transition: 'background .15s',
                flexShrink: 0, alignSelf: 'flex-end',
              }}
            >➤</button>
          </div>
          {!isMobile && (
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, textAlign: 'center', direction: 'rtl' }}>
              Enter לשלוח · Shift+Enter שורה · 📎 תמונה · 🎤 הקלטה קולית · Ctrl+K פתח/סגור
            </div>
          )}
        </div>
      </div>

      {/* ── FAB toggle button (draggable, hidden on mobile when open) ── */}
      {(!isMobile || !open) && (
        <button
          onPointerDown={onFabDown}
          title="סוכן AI (Ctrl+K) — גרור להזזה"
          style={{
            position:     'fixed',
            bottom:       isMobile ? Math.max(fabPos.bottom, 80) : fabPos.bottom,
            right:        fabPos.right,
            width:        isMobile ? 58 : 54,
            height:       isMobile ? 58 : 54,
            borderRadius: '50%',
            background:   open ? '#1e293b' : 'linear-gradient(135deg,#f97316,#ea580c)',
            border:       'none',
            cursor:       'grab',
            boxShadow:    open ? '0 4px 16px rgba(0,0,0,.35)' : '0 4px 22px rgba(249,115,22,.5)',
            fontSize:     isMobile ? 24 : (open ? 22 : 20),
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
      )}
    </>
  )
}
