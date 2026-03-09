import { useState } from 'react'
import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, CONDITION_OPERATORS, CONDITION_FIELDS, PRIORITIES } from '../../constants'

const emptyCondition = () => ({ field: 'lead_stage', operator: '==', value: '' })
const emptyAction    = () => ({ type: 'create_task', data: { title: '', priority: 'high', dueDaysFromNow: 2 } })

export default function WorkflowRuleModal({ rule, onSave, onClose }) {
  const [form, setForm] = useState(() => rule ? {
    name:        rule.name || '',
    description: rule.description || '',
    triggerType: rule.triggerType || 'lead_created',
    conditions:  rule.conditions?.length ? [...rule.conditions] : [],
    actions:     rule.actions?.length    ? [...rule.actions]    : [emptyAction()],
    enabled:     rule.enabled !== false,
  } : {
    name:        '',
    description: '',
    triggerType: 'lead_created',
    conditions:  [],
    actions:     [emptyAction()],
    enabled:     true,
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // ── Conditions ──
  const addCond    = () => setForm(p => ({ ...p, conditions: [...p.conditions, emptyCondition()] }))
  const removeCond = i  => setForm(p => ({ ...p, conditions: p.conditions.filter((_, j) => j !== i) }))
  const setCond    = (i, k, v) => setForm(p => ({
    ...p,
    conditions: p.conditions.map((c, j) => j === i ? { ...c, [k]: v } : c),
  }))

  // ── Actions ──
  const addAction    = () => setForm(p => ({ ...p, actions: [...p.actions, emptyAction()] }))
  const removeAction = i  => setForm(p => ({ ...p, actions: p.actions.filter((_, j) => j !== i) }))
  const setAction    = (i, k, v) => setForm(p => ({
    ...p,
    actions: p.actions.map((a, j) => j === i ? { ...a, [k]: v } : a),
  }))
  const setActionData = (i, k, v) => setForm(p => ({
    ...p,
    actions: p.actions.map((a, j) => j === i ? { ...a, data: { ...a.data, [k]: v } } : a),
  }))

  const sub = e => {
    e.preventDefault()
    if (!form.name.trim() || !form.actions.length) return
    onSave(form)
  }

  const sty = {
    row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
    label: { fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' },
    section: { borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 },
    addBtn: {
      background: 'none', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 14px',
      cursor: 'pointer', fontSize: 13, color: 'var(--muted)', width: '100%', textAlign: 'center',
    },
    removeBtn: {
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
      fontSize: 16, padding: '4px 6px', borderRadius: 4, lineHeight: 1,
    },
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="mh">
          <h3>{rule ? 'עריכת אוטומציה' : 'אוטומציה חדשה'}</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <form onSubmit={sub}>
          <div className="mb" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="fg">
              {/* Name */}
              <div className="frow full">
                <label>שם האוטומציה *</label>
                <input required value={form.name} onChange={f('name')} placeholder='לדוגמה: "פולואפ ליד חדש"'/>
              </div>

              {/* Description */}
              <div className="frow full">
                <label>תיאור</label>
                <input value={form.description} onChange={f('description')} placeholder="מה האוטומציה עושה?"/>
              </div>

              {/* Trigger */}
              <div className="frow full">
                <label>🎯 טריגר — מתי להפעיל?</label>
                <select value={form.triggerType} onChange={f('triggerType')}>
                  {WORKFLOW_TRIGGERS.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* ── Conditions ── */}
              <div style={sty.section}>
                <div style={{ ...sty.label, marginBottom: 10 }}>🔍 תנאים (אופציונלי)</div>
                {form.conditions.map((cond, i) => (
                  <div key={i} style={sty.row}>
                    <select value={cond.field} onChange={e => setCond(i, 'field', e.target.value)}
                      style={{ flex: '1 1 120px' }}>
                      {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => setCond(i, 'operator', e.target.value)}
                      style={{ flex: '0 0 100px' }}>
                      {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={cond.value} onChange={e => setCond(i, 'value', e.target.value)}
                      placeholder="ערך" style={{ flex: '1 1 100px' }}/>
                    <button type="button" style={sty.removeBtn} onClick={() => removeCond(i)}>✕</button>
                  </div>
                ))}
                <button type="button" style={sty.addBtn} onClick={addCond}>+ הוסף תנאי</button>
              </div>

              {/* ── Actions ── */}
              <div style={sty.section}>
                <div style={{ ...sty.label, marginBottom: 10 }}>⚡ פעולות — מה לעשות?</div>
                {form.actions.map((act, i) => {
                  const actDef = WORKFLOW_ACTIONS.find(a => a.id === act.type)
                  return (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <div style={sty.row}>
                        <select value={act.type} onChange={e => setAction(i, 'type', e.target.value)}
                          style={{ flex: 1 }}>
                          {WORKFLOW_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
                        </select>
                        <button type="button" style={sty.removeBtn} onClick={() => removeAction(i)}>✕</button>
                      </div>
                      {/* Action-specific fields */}
                      {act.type === 'create_task' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                          <input value={act.data?.title || ''} onChange={e => setActionData(i, 'title', e.target.value)}
                            placeholder="כותרת משימה (ניתן להשתמש ב-{name})" style={{ flex: '1 1 200px' }}/>
                          <select value={act.data?.priority || 'high'} onChange={e => setActionData(i, 'priority', e.target.value)}
                            style={{ flex: '0 0 100px' }}>
                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>בעוד</span>
                            <input type="number" min="0" max="30" value={act.data?.dueDaysFromNow || 2}
                              onChange={e => setActionData(i, 'dueDaysFromNow', Number(e.target.value))}
                              style={{ width: 50 }}/>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>ימים</span>
                          </div>
                        </div>
                      )}
                      {act.type === 'create_activity_log' && (
                        <input value={act.data?.description || ''} onChange={e => setActionData(i, 'description', e.target.value)}
                          placeholder="תיאור הפעילות (ניתן להשתמש ב-{name})" style={{ marginTop: 6, width: '100%' }}/>
                      )}
                      {act.type === 'show_notification' && (
                        <input value={act.data?.message || ''} onChange={e => setActionData(i, 'message', e.target.value)}
                          placeholder="הודעת ההתראה" style={{ marginTop: 6, width: '100%' }}/>
                      )}
                      {act.type === 'update_status' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <select value={act.data?.field || ''} onChange={e => setActionData(i, 'field', e.target.value)}
                            style={{ flex: 1 }}>
                            <option value="">בחר שדה</option>
                            <option value="status">סטטוס</option>
                            <option value="at_risk">בסיכון</option>
                            <option value="lead_stage">שלב ליד</option>
                          </select>
                          <input value={act.data?.value || ''} onChange={e => setActionData(i, 'value', e.target.value)}
                            placeholder="ערך חדש" style={{ flex: 1 }}/>
                        </div>
                      )}
                      {(act.type === 'send_whatsapp_template' || act.type === 'send_email') && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#f59e0b', background: '#fef3c7', padding: '6px 10px', borderRadius: 6 }}>
                          ⚠️ {act.type === 'send_whatsapp_template' ? 'דורש הגדרת תבניות WhatsApp' : 'דורש הגדרת שרת אימייל (Resend)'}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button type="button" style={sty.addBtn} onClick={addAction}>+ הוסף פעולה</button>
              </div>
            </div>
          </div>
          <div className="mf">
            <button type="submit" className="btn btn-p">{rule ? 'שמור שינויים' : 'צור אוטומציה'}</button>
            <button type="button" className="btn btn-o" onClick={onClose}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  )
}
