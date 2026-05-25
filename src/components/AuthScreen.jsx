import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('login') // 'login' | 'forgot' | 'sent'
  const [resetEmail, setResetEmail] = useState('')

  const inp = {
    width: '100%', padding: '9px 12px', background: '#0f172a',
    border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9',
    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
    textAlign: 'right', boxSizing: 'border-box',
  }

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : err.message)
    setLoading(false)
  }

  const sendResetEmail = async e => {
    e.preventDefault(); setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (err) {
      setError('שגיאה בשליחת האימייל. נסה שוב.')
    } else {
      setMode('sent')
    }
  }

  const logo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', justifyContent: 'center' }}>
      <div style={{ width: '48px', height: '48px', background: '#f97316', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>W</div>
      <div><div style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '700' }}>WIN CRM</div><div style={{ color: '#64748b', fontSize: '12px' }}>אמיתי כהן</div></div>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a', fontFamily: "'Rubik','Segoe UI',Arial,sans-serif" }}>
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>

        {/* ── מצב כניסה ── */}
        {mode === 'login' && <>
          {logo}
          <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '22px', direction: 'rtl' }}>התחבר כדי לגשת למערכת</p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} placeholder="your@email.com"/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>סיסמה</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} placeholder="••••••••"/>
            </div>
            {error && <div style={{ color: '#fca5a5', fontSize: '12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', padding: '8px 12px', borderRadius: '7px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ padding: '11px', background: loading ? '#7c3400' : '#f97316', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: '4px', transition: 'background .15s' }}>
              {loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <button onClick={() => { setMode('forgot'); setResetEmail(email); setError('') }}
              style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
              שכחתי סיסמא
            </button>
          </div>
        </>}

        {/* ── מצב שכחתי סיסמא ── */}
        {mode === 'forgot' && <>
          {logo}
          <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '22px', direction: 'rtl' }}>
            הכנס את האימייל שלך ונשלח לך קישור לאיפוס סיסמא
          </p>
          <form onSubmit={sendResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px', direction: 'rtl' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>אימייל</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required style={inp} placeholder="your@email.com" autoFocus/>
            </div>
            {error && <div style={{ color: '#fca5a5', fontSize: '12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', padding: '8px 12px', borderRadius: '7px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ padding: '11px', background: loading ? '#7c3400' : '#f97316', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: '4px', transition: 'background .15s' }}>
              {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <button onClick={() => { setMode('login'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
              חזרה לכניסה
            </button>
          </div>
        </>}

        {/* ── נשלח בהצלחה ── */}
        {mode === 'sent' && <>
          {logo}
          <div style={{ textAlign: 'center', direction: 'rtl' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📧</div>
            <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>הקישור נשלח!</p>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.6' }}>
              שלחנו קישור לאיפוס סיסמא לכתובת<br/>
              <span style={{ color: '#f97316' }}>{resetEmail}</span><br/>
              בדוק את תיבת הדואר שלך (גם ספאם)
            </p>
            <button onClick={() => { setMode('login'); setError('') }}
              style={{ padding: '10px 24px', background: '#f97316', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
              חזרה לכניסה
            </button>
          </div>
        </>}

      </div>
    </div>
  )
}
