import { useState, useEffect } from 'react'
import { getAuthUrl, checkConnection, disconnect, syncTasks, syncClasses } from '../../services/googleCalendarService'

export default function CalendarSettings({ tasks, classes }) {
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing]     = useState(null)
  const [msg, setMsg]             = useState(null)

  useEffect(() => {
    checkConnection().then(r => setConnected(r.connected))
  }, [])

  const handleConnect = () => {
    const url = getAuthUrl()
    if (!url) {
      setMsg({ type: 'err', text: 'VITE_GOOGLE_CLIENT_ID לא הוגדר בקובץ .env.local' })
      return
    }
    window.location.href = url
  }

  const handleDisconnect = async () => {
    if (!window.confirm('לנתק את Google Calendar?')) return
    try {
      await disconnect()
      setConnected(false)
      setMsg({ type: 'ok', text: 'Google Calendar נותק' })
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    }
  }

  const handleSync = async (type) => {
    setSyncing(type); setMsg(null)
    try {
      if (type === 'tasks') {
        const openTasks = (tasks || []).filter(t => !t.completed && t.dueDate)
        const result = await syncTasks(openTasks)
        setMsg({ type: 'ok', text: `סונכרנו ${result.synced} משימות ליומן` })
      } else {
        const result = await syncClasses(classes || [])
        setMsg({ type: 'ok', text: `סונכרנו ${result.synced} חוגים ליומן` })
      }
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    }
    setSyncing(null)
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>📅 Google Calendar</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: connected ? '#10b981' : '#ef4444',
        }}/>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {connected ? '🟢 מחובר' : '🔴 לא מחובר'}
        </span>
      </div>

      {!connected ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            חבר את Google Calendar כדי לסנכרן חוגים ומשימות ליומן שלך.
          </p>
          <button className="btn btn-p" onClick={handleConnect} style={{ background: '#4285f4' }}>
            🔗 חבר Google Calendar
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            דורש הגדרת Google Cloud Console עם OAuth credentials
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn btn-p" onClick={() => handleSync('tasks')} disabled={!!syncing}>
              {syncing === 'tasks' ? '⏳ מסנכרן...' : '📋 סנכרן משימות'}
            </button>
            <button className="btn btn-p" onClick={() => handleSync('classes')} disabled={!!syncing}>
              {syncing === 'classes' ? '⏳ מסנכרן...' : '📚 סנכרן חוגים'}
            </button>
          </div>
          <button className="btn btn-o" onClick={handleDisconnect} style={{ fontSize: 12 }}>
            ❌ נתק Google Calendar
          </button>
        </div>
      )}

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>{msg.text}</div>
      )}
    </div>
  )
}
