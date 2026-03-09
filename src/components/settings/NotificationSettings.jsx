import { useState, useEffect } from 'react'
import { fetchPreferences, upsertPreferences, sendTestEmail } from '../../services/notificationsService'

function Toggle({ label, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}/>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: checked ? '#f97316' : '#cbd5e1', transition: 'background .2s',
        }}>
          <span style={{
            position: 'absolute', top: 2, right: checked ? 2 : 22,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'right .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }}/>
        </span>
      </label>
    </div>
  )
}

export default function NotificationSettings() {
  const [prefs, setPrefs]     = useState({
    taskDueToday: true, paymentOverdue: true, leadAtRisk: true,
    weeklyDigest: true, dailyDigest: false, emailAddress: '',
  })
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(null)
  const [msg, setMsg]         = useState(null)

  useEffect(() => {
    fetchPreferences().then(p => {
      if (p) setPrefs({
        taskDueToday:  p.task_due_today ?? true,
        paymentOverdue: p.payment_overdue ?? true,
        leadAtRisk:    p.lead_at_risk ?? true,
        weeklyDigest:  p.weekly_digest ?? true,
        dailyDigest:   p.daily_digest ?? false,
        emailAddress:  p.email_address || '',
      })
    })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await upsertPreferences(prefs)
      setMsg({ type: 'ok', text: 'ההעדפות נשמרו!' })
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    }
    setSaving(false)
  }

  const testEmail = async (type) => {
    setTesting(type); setMsg(null)
    try {
      await sendTestEmail(type, prefs.emailAddress || undefined)
      setMsg({ type: 'ok', text: 'אימייל בדיקה נשלח!' })
    } catch (e) {
      setMsg({ type: 'err', text: 'שליחה נכשלה: ' + e.message })
    }
    setTesting(null)
  }

  const set = k => v => setPrefs(p => ({ ...p, [k]: v }))

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>✉️ התראות אימייל</h3>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>כתובת אימייל</label>
        <input value={prefs.emailAddress} onChange={e => set('emailAddress')(e.target.value)}
          placeholder="your@email.com" type="email"
          style={{ marginTop: 4, width: '100%' }}/>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>אם ריק, ישתמש באימייל החשבון</span>
      </div>

      <Toggle label="📋 משימות להיום" description="קבל סיכום יומי של משימות עם תאריך יעד להיום"
        checked={prefs.taskDueToday} onChange={set('taskDueToday')}/>
      <Toggle label="💰 תשלומים באיחור" description="קבל התראה כשיש תשלומים שעברו את מועד התשלום"
        checked={prefs.paymentOverdue} onChange={set('paymentOverdue')}/>
      <Toggle label="⚠️ לידים בסיכון" description="קבל התראה על לידים שלא טופלו 7+ ימים"
        checked={prefs.leadAtRisk} onChange={set('leadAtRisk')}/>
      <Toggle label="📊 סיכום שבועי" description="קבל דוח סיכום שבועי בכל ראשון"
        checked={prefs.weeklyDigest} onChange={set('weeklyDigest')}/>
      <Toggle label="📅 סיכום יומי" description="קבל סיכום יומי של כל ההתראות"
        checked={prefs.dailyDigest} onChange={set('dailyDigest')}/>

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-p" onClick={save} disabled={saving}>
          {saving ? '⏳ שומר...' : '💾 שמור העדפות'}
        </button>
        <button className="btn btn-o" onClick={() => testEmail('task_due_today')} disabled={!!testing}>
          {testing === 'task_due_today' ? '⏳...' : '🧪 שלח בדיקה'}
        </button>
      </div>
    </div>
  )
}
