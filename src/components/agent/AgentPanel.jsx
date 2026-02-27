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
  { id: 'gemini-3-pro-preview',   label: 'Gemini 3 Pro',   icon: '🧠', desc: 'חכם ומדויק יותר' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', icon: '⚡', desc: 'מהיר יותר' },
]

const HINTS = [
  { text: 'תן לי סיכום עסקי של השבוע',                icon: '📊' },
  { text: 'אילו לקוחות כדאי לי להתקשר אליהם היום?',     icon: '📞' },
  { text: 'תציע רעיונות להגדלת המכירות',               icon: '💡' },
  { text: 'יש ליד חדש מפייסבוק שמו דנה לוי',           icon: '🎯' },
  { text: 'תזכיר לי לטפל בנושא מסיבת פורים',            icon: '✅' },
  { text: 'מה המצב הכלכלי שלי החודש?',                 icon: '💰' },
]

// ── Bubble component ───────────────────────────────────────────────────────
function Bubble({ msg, isMobile }) {
  const isUser     = msg.role === 'user'
  const isError    = msg.role === 'error'
  const isQuestion = msg.role === 'agent' && !msg.actions?.length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      {msg.preview && (
        <img src={msg.preview} alt="" style={{ maxWidth: isMobile ? 200 : 180, maxHeight: 160, borderRadius: 12, marginBottom: 6, objectFit: 'cover' }}/>
      )}
      {msg.isAudio && (
        <div style={{ background:'#ede9fe', borderRadius:10, padding:'5px 12px', marginBottom:5, fontSize: 13, color:'#7c3aed', fontWeight:600 }}>
          🎤 הודעה קולית {msg.audioDur ? `(${msg.audioDur}ש׳)` : ''}
        </div>
      )}
      <div style={{
        maxWidth:     '82%',
        padding:      '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background:   isUser
          ? 'linear-gradient(135deg,#f97316,#ea580c)'
          : isError
            ? '#fee2e2'
            : isQuestion ? '#fff7ed' : '#ffffff',
        color:        isUser ? '#fff' : isError ? '#dc2626' : '#1e293b',
        fontSize:     14,
        lineHeight:   1.6,
        boxShadow:    '0 1px 3px rgba(0,0,0,.08)',
        border:       isUser ? 'none' : isQuestion ? '1px solid #fed7aa' : '1px solid #e2e8f0',
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
        direction:    'rtl',
        textAlign:    'right',
      }}>
        {isQuestion && <span style={{ marginLeft: 5 }}>💡</span>}
        {msg.text}
      </div>

      {msg.actions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, maxWidth: '82%', direction: 'rtl' }}>
          {msg.actions.map((a, i) => {
            const isErr = a.summary?.startsWith('שגיאה')
            const isWa  = a.type === 'open_whatsapp' && a.url
            const s = {
              fontSize: 12,
              padding: '5px 12px',
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 6px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'linear-gradient(135deg,#f97316,#ea580c)',
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
      borderBottom: '1px solid #e2e8f0',
      padding: '16px 18px',
      flexShrink: 0,
      background: '#fafbfc',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10, direction: 'rtl', letterSpacing: '.3px' }}>
        בחר מודל AI
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 11, cursor: 'pointer',
              border: `2px solid ${model === m.id ? '#f97316' : '#e2e8f0'}`,
              background: model === m.id ? 'rgba(249,115,22,.08)' : '#fff',
              color: model === m.id ? '#f97316' : '#64748b',
              fontSize: 13, fontWeight: 700, textAlign: 'center',
              transition: 'all .15s', direction: 'rtl',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 2 }}>{m.icon}</div>
            <div>{m.label}</div>
            <div style={{ fontWeight: 400, fontSize: 11, marginTop: 2, opacity: .7 }}>{m.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        style={{
          width: '100%', padding: '9px', borderRadius: 9, cursor: 'pointer',
          border: '1px solid #fca5a5', background: '#fff1f2',
          color: '#ef4444', fontSize: 13, fontWeight: 600, direction: 'rtl',
          fontFamily: 'inherit',
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
  const [audio, setAudio]               = useState(null)
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

  // ── Quick stat for welcome screen ──
  const openTaskCount = tasks.filter(t => !t.completed).length
  const activeLeadCount = leads.length
  const totalDealValue = deals.filter(d => d.stage !== 'closed' && d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0)

  return (
    <>
      {/* ── Floating chat window ───────────────────────────────────── */}
      <div style={{
        position:      'fixed',
        bottom:        isMobile ? 0 : fabPos.bottom + 68,
        right:         isMobile ? 0 : fabPos.right,
        left:          isMobile ? 0 : 'auto',
        top:           isMobile ? 0 : 'auto',
        width:         isMobile ? '100%' : 420,
        height:        isMobile ? '100%' : 600,
        zIndex:        300,
        display:       'flex',
        flexDirection: 'column',
        background:    '#fff',
        border:        isMobile ? 'none' : '1px solid #e2e8f0',
        borderRadius:  isMobile ? 0 : 18,
        boxShadow:     isMobile ? 'none' : '0 12px 60px rgba(0,0,0,.25)',
        overflow:      'hidden',
        transform:     open ? 'scale(1) translateY(0)' : isMobile ? 'translateY(100%)' : 'scale(.96) translateY(14px)',
        opacity:       open ? 1 : (isMobile ? 1 : 0),
        pointerEvents: open ? 'auto' : 'none',
        transition:    isMobile
          ? 'transform .28s cubic-bezier(.4,0,.2,1)'
          : 'transform .22s cubic-bezier(.4,0,.2,1), opacity .22s ease',
        transformOrigin: 'bottom right',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 18px' : '14px 18px',
          paddingTop: isMobile ? 'max(14px, env(safe-area-inset-top))' : '14px',
          background: 'linear-gradient(135deg,#0f172a,#1e293b)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '0 2px', lineHeight: 1 }}>←</button>
            )}
            <div style={{
              width: 42, height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              boxShadow: '0 4px 12px rgba(249,115,22,.4)',
            }}>🤖</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', lineHeight: 1.2 }}>היועץ העסקי שלך</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>
                {currentModel.icon} {currentModel.label} · מוכן לעזור
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setShowSettings(s => !s)}
              title="הגדרות"
              style={{
                background: showSettings ? 'rgba(249,115,22,.3)' : 'rgba(255,255,255,.1)',
                border: 'none', cursor: 'pointer', padding: '7px 9px',
                borderRadius: 9, fontSize: 17, lineHeight: 1,
                color: showSettings ? '#f97316' : '#94a3b8',
                transition: 'all .15s',
              }}
            >⚙️</button>
            {!isMobile && (
              <button
                onClick={onToggle}
                style={{
                  border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer',
                  fontSize: 18, color: '#94a3b8', lineHeight: 1,
                  padding: '7px 9px', borderRadius: 9,
                  transition: 'all .15s',
                }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <SettingsPanel model={model} setModel={setModel} onClear={handleClear}/>
        )}

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 16px 8px',
          display: 'flex', flexDirection: 'column',
          background: '#f8fafc',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: 10, direction: 'rtl' }}>
              {/* Welcome card */}
              <div style={{
                background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
                borderRadius: 16, padding: '22px 18px', marginBottom: 16,
                border: '1px solid #fed7aa',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
                  שלום! אני היועץ העסקי שלך
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
                  אני כאן כדי לעזור לך למכור יותר, לנהל את העסק בצורה חכמה, ולוודא שאתה לא מפספס הזדמנויות.
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316' }}>{openTaskCount}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>משימות פתוחות</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{activeLeadCount}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>לידים</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{totalDealValue > 0 ? `${Math.round(totalDealValue/1000)}K` : '0'}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>בפייפליין</div>
                </div>
              </div>

              {/* Hint chips */}
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>💬 שאל אותי כל שאלה:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {HINTS.map((h, i) => (
                  <button key={i}
                    onClick={() => { setInput(h.text); textareaRef.current?.focus() }}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#334155', textAlign: 'right',
                      direction: 'rtl', transition: 'all .15s',
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.background = '#fff7ed' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff' }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{h.icon}</span>
                    {h.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => <Bubble key={msg.id} msg={msg} isMobile={isMobile}/>)}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px 16px 16px 4px',
                padding: '4px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,.05)',
              }}>
                <TypingDots/>
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* ── Input area ── */}
        <div style={{
          padding: '12px 14px',
          paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '14px',
          borderTop: '1px solid #e2e8f0',
          background: '#fff',
          flexShrink: 0,
        }}>
          {image && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
              <img src={image.preview} alt="" style={{ height: 60, borderRadius: 10, objectFit: 'cover', maxWidth: '100%' }}/>
              <button onClick={() => setImage(null)}
                style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
          {audio && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, background:'#ede9fe', borderRadius:10, padding:'8px 14px' }}>
              <span style={{ fontSize: 18 }}>🎤</span>
              <span style={{ fontSize: 13, color:'#7c3aed', fontWeight:600 }}>{audio.durationSec}ש׳ מוקלט</span>
              <button onClick={() => setAudio(null)} style={{ marginRight:'auto', background:'none', border:'none', color:'#7c3aed', cursor:'pointer', fontSize: 16, padding:'2px 4px' }}>×</button>
            </div>
          )}
          {recording && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, background:'#fee2e2', borderRadius:10, padding:'8px 14px', direction:'rtl' }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444', animation:'pulse 1s ease-in-out infinite', flexShrink:0 }}/>
              <span style={{ fontSize: 13, color:'#dc2626', fontWeight:600 }}>מקליט... {recSec}ש׳</span>
              <button onClick={stopRecording} style={{ marginRight:'auto', background:'#ef4444', border:'none', color:'#fff', cursor:'pointer', fontSize: 12, borderRadius:6, padding:'4px 14px', fontFamily:'inherit', fontWeight: 600 }}>עצור</button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: '#f1f5f9',
            borderRadius: 14,
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            transition: 'border-color .15s',
          }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || recording}
              title="צרף תמונה"
              style={{
                background: image ? 'rgba(249,115,22,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '4px',
                color: image ? '#f97316' : '#94a3b8', fontSize: 20,
                borderRadius: 8, flexShrink: 0, alignSelf: 'flex-end',
                transition: 'color .15s',
              }}
            >📎</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange}/>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading || !!image}
              title={recording ? 'עצור הקלטה' : 'הקלטה קולית'}
              style={{
                background: recording ? 'rgba(239,68,68,.15)' : audio ? 'rgba(124,58,237,.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '4px',
                color: recording ? '#ef4444' : audio ? '#7c3aed' : '#94a3b8',
                fontSize: 20,
                borderRadius: 8, flexShrink: 0, alignSelf: 'flex-end',
              }}
            >{recording ? '⏹' : '🎤'}</button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              placeholder="הודעה..."
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                color: '#1e293b', fontSize: 14, outline: 'none',
                fontFamily: "'Rubik','Segoe UI',Arial,sans-serif",
                lineHeight: 1.5, direction: 'rtl',
                maxHeight: 100,
              }}
              disabled={loading}
            />
            <button
              onClick={submit}
              disabled={(!input.trim() && !audio) || loading}
              style={{
                background: (input.trim() || audio) && !loading
                  ? 'linear-gradient(135deg,#f97316,#ea580c)'
                  : '#cbd5e1',
                border: 'none', borderRadius: '50%',
                cursor: (input.trim() || audio) && !loading ? 'pointer' : 'default',
                width: 38, height: 38, minWidth: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 17,
                transition: 'all .15s',
                flexShrink: 0, alignSelf: 'flex-end',
                boxShadow: (input.trim() || audio) && !loading ? '0 3px 10px rgba(249,115,22,.3)' : 'none',
              }}
            >➤</button>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5, textAlign: 'center', direction: 'rtl' }}>
            Enter לשלוח · Shift+Enter שורה · 📎 תמונה · 🎤 הקלטה קולית · Ctrl+K פתח/סגור
          </div>
        </div>
      </div>

      {/* ── FAB toggle button ── */}
      {(!isMobile || !open) && (
        <button
          onPointerDown={onFabDown}
          title="סוכן AI (Ctrl+K) — גרור להזזה"
          style={{
            position:     'fixed',
            bottom:       isMobile ? Math.max(fabPos.bottom, 80) : fabPos.bottom,
            right:        fabPos.right,
            width:        isMobile ? 62 : 58,
            height:       isMobile ? 62 : 58,
            borderRadius: '50%',
            background:   open ? '#1e293b' : 'linear-gradient(135deg,#f97316,#ea580c)',
            border:       'none',
            cursor:       'grab',
            boxShadow:    open ? '0 4px 16px rgba(0,0,0,.35)' : '0 6px 28px rgba(249,115,22,.5)',
            fontSize:     isMobile ? 26 : 24,
            zIndex:       301,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            transition:   'background .2s ease, box-shadow .2s ease, transform .15s ease',
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
