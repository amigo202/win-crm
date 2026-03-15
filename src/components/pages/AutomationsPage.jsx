import { useState, useEffect } from 'react'
import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS } from '../../constants'
import { Ico } from '../icons/Ico'
import WorkflowRuleModal from '../modals/WorkflowRuleModal'
import NotificationSettings from '../settings/NotificationSettings'
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule, triggerReport } from '../../services/reportScheduleService'

/* ── Rule card ─────────────────────────────────────────────── */
function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  const trigger = WORKFLOW_TRIGGERS.find(t => t.id === rule.triggerType)
  const condCount = rule.conditions?.length || 0
  const actCount  = rule.actions?.length || 0

  return (
    <div className="card" style={{ padding: 16, marginBottom: 10, opacity: rule.enabled ? 1 : 0.6, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{trigger?.icon || '⚡'}</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{rule.name}</span>
          </div>
          {rule.description && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px 0' }}>{rule.description}</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12 }}>
            <span className="badge b-blue">{trigger?.label || rule.triggerType}</span>
            {condCount > 0 && <span className="badge b-yellow">{condCount} תנאים</span>}
            {actCount > 0 && (
              <span className="badge b-green">
                {actCount} {actCount === 1 ? 'פעולה' : 'פעולות'}
              </span>
            )}
            {rule.runCount > 0 && (
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                הופעל {rule.runCount} פעמים
              </span>
            )}
          </div>
          {/* Action summary */}
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(rule.actions || []).map((a, i) => {
              const act = WORKFLOW_ACTIONS.find(x => x.id === a.type)
              return (
                <span key={i} style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--muted)' }}>
                  {act?.icon} {act?.label || a.type}
                </span>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Toggle switch */}
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
            <input type="checkbox" checked={rule.enabled} onChange={e => onToggle(rule.id, e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}/>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 12,
              background: rule.enabled ? '#f97316' : '#cbd5e1',
              transition: 'background .2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, right: rule.enabled ? 2 : 22,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'right .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }}/>
            </span>
          </label>
          <button className="icon-btn" onClick={() => onEdit(rule)}><Ico.edit/></button>
          <button className="icon-btn" style={{ color: 'var(--danger)' }}
            onClick={() => { if (window.confirm('למחוק אוטומציה זו?')) onDelete(rule.id) }}>
            <Ico.trash/>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Report schedule section ──────────────────────────────── */
const REPORT_TYPES = [
  { id: 'monthly_financial', label: '💰 דוח פיננסי חודשי', desc: 'הכנסות, הוצאות, רווח — נשלח ב-1 לכל חודש' },
  { id: 'weekly_pipeline',   label: '📊 דוח צינור שבועי',  desc: 'לידים, עסקאות, סטטוסים — נשלח בכל יום ראשון' },
]

function ReportScheduleSettings() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(null)
  const [msg, setMsg]             = useState(null)
  const [newEmail, setNewEmail]   = useState('')

  useEffect(() => {
    fetchSchedules().then(data => { setSchedules(data); setLoading(false) })
  }, [])

  const toggleReport = async (type) => {
    const existing = schedules.find(s => s.report_type === type)
    if (existing) {
      await updateSchedule(existing.id, { enabled: !existing.enabled })
      setSchedules(p => p.map(s => s.id === existing.id ? { ...s, enabled: !s.enabled } : s))
    } else {
      const row = await createSchedule({ reportType: type, recipients: [] })
      setSchedules(p => [row, ...p])
    }
  }

  const addRecipient = async (schedId) => {
    if (!newEmail.trim() || !newEmail.includes('@')) return
    const sched = schedules.find(s => s.id === schedId)
    if (!sched) return
    const updated = [...(sched.recipients || []), newEmail.trim()]
    await updateSchedule(schedId, { recipients: updated })
    setSchedules(p => p.map(s => s.id === schedId ? { ...s, recipients: updated } : s))
    setNewEmail('')
  }

  const removeRecipient = async (schedId, email) => {
    const sched = schedules.find(s => s.id === schedId)
    if (!sched) return
    const updated = (sched.recipients || []).filter(e => e !== email)
    await updateSchedule(schedId, { recipients: updated })
    setSchedules(p => p.map(s => s.id === schedId ? { ...s, recipients: updated } : s))
  }

  const handleTrigger = async (type) => {
    setSending(type); setMsg(null)
    try {
      await triggerReport(type)
      setMsg({ type: 'ok', text: 'הדוח נשלח בהצלחה!' })
    } catch (e) {
      setMsg({ type: 'err', text: 'שליחה נכשלה: ' + e.message })
    }
    setSending(null)
  }

  if (loading) return <div className="card" style={{ padding: 20 }}><p style={{ color: 'var(--muted)', fontSize: 13 }}>טוען...</p></div>

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>📊 דוחות מתוזמנים</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
        הגדר דוחות אוטומטיים שיישלחו באימייל לפי לוח זמנים קבוע
      </p>

      {REPORT_TYPES.map(rt => {
        const sched = schedules.find(s => s.report_type === rt.id)
        const isEnabled = sched?.enabled ?? false
        return (
          <div key={rt.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{rt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{rt.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-o" style={{ fontSize: 11, padding: '4px 10px' }}
                  disabled={!!sending}
                  onClick={() => handleTrigger(rt.id)}>
                  {sending === rt.id ? '⏳...' : '▶ שלח עכשיו'}
                </button>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                  <input type="checkbox" checked={isEnabled} onChange={() => toggleReport(rt.id)}
                    style={{ opacity: 0, width: 0, height: 0 }}/>
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 12,
                    background: isEnabled ? '#f97316' : '#cbd5e1', transition: 'background .2s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, right: isEnabled ? 2 : 22,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      transition: 'right .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }}/>
                  </span>
                </label>
              </div>
            </div>
            {/* Recipients */}
            {sched && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {(sched.recipients || []).map(email => (
                    <span key={email} style={{
                      fontSize: 12, background: 'var(--bg)', padding: '3px 8px', borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {email}
                      <button onClick={() => removeRecipient(sched.id, email)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="הוסף אימייל נמען" type="email"
                    style={{ flex: 1, fontSize: 12 }}
                    onKeyDown={e => e.key === 'Enter' && addRecipient(sched.id)}/>
                  <button className="btn btn-o" style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => addRecipient(sched.id)}>הוסף</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'ok' ? '#d1fae5' : '#fee2e2',
          color: msg.type === 'ok' ? '#065f46' : '#991b1b',
        }}>{msg.text}</div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        ⚠️ דורש הגדרת Resend API key + pg_cron ב-Supabase
      </div>
    </div>
  )
}

/* ── Tab navigation ──────────────────────────────────────── */
const TABS = [
  { id: 'rules',    label: '⚡ חוקים',    icon: '⚡' },
  { id: 'settings', label: '⚙️ הגדרות', icon: '⚙️' },
]

/* ── Main page ───────────────────────────────────────────── */
export default function AutomationsPage({ rules, onAdd, onUpdate, onDelete, onToggle, onReload }) {
  const [modal, setModal] = useState(null)
  const [tab, setTab]     = useState('rules')

  const handleSave = async data => {
    if (modal?.rule) {
      await onUpdate(modal.rule.id, data)
    } else {
      await onAdd(data)
    }
    setModal(null)
  }

  const enabledCount  = rules.filter(r => r.enabled).length
  const totalRuns     = rules.reduce((s, r) => s + (r.runCount || 0), 0)

  return (
    <>
      <div className="ph">
        <h2>⚡ אוטומציות והגדרות</h2>
        {tab === 'rules' && (
          <button className="btn btn-p" onClick={() => setModal({ rule: null })}><Ico.plus/> הוסף אוטומציה</button>
        )}
      </div>
      <div className="pb">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? '#f97316' : 'var(--muted)',
              borderBottom: tab === t.id ? '2px solid #f97316' : '2px solid transparent',
              marginBottom: -2, transition: 'all .15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Rules ── */}
        {tab === 'rules' && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="card" style={{ padding: '12px 18px', flex: '1 1 140px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f97316' }}>{rules.length}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>סה"כ חוקים</div>
              </div>
              <div className="card" style={{ padding: '12px 18px', flex: '1 1 140px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{enabledCount}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>פעילים</div>
              </div>
              <div className="card" style={{ padding: '12px 18px', flex: '1 1 140px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{totalRuns}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>הפעלות</div>
              </div>
            </div>

            {/* Rules list */}
            {!rules.length ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
                <h3 style={{ margin: '0 0 8px' }}>אין אוטומציות עדיין</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>
                  צור חוקים אוטומטיים שיופעלו כאשר מתרחשים אירועים במערכת
                </p>
                <button className="btn btn-p" onClick={() => setModal({ rule: null })}>
                  <Ico.plus/> צור אוטומציה ראשונה
                </button>
              </div>
            ) : (
              rules.map(r => (
                <RuleCard key={r.id} rule={r}
                  onToggle={onToggle}
                  onEdit={rule => setModal({ rule })}
                  onDelete={onDelete}/>
              ))
            )}
          </>
        )}

        {/* ── Tab: Settings ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <NotificationSettings/>
            <ReportScheduleSettings/>
          </div>
        )}
      </div>

      {modal && (
        <WorkflowRuleModal
          rule={modal.rule}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
