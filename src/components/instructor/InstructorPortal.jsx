import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function dayName(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return 'יום ' + DAYS_HE[d.getDay()]
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 5,
}
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, color: '#1e293b',
  background: '#f9fafb', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', direction: 'rtl',
}

export default function InstructorPortal({ instructorId, instructorName }) {
  const [form, setForm] = useState({
    location:    '',
    report_date: new Date().toISOString().split('T')[0],
    hours:       '',
  })
  const [status, setStatus]     = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.location.trim() || !form.hours || Number(form.hours) <= 0) return
    setStatus('submitting')
    try {
      const { error } = await supabase.from('hour_reports').insert({
        instructor_id: instructorId,
        report_date:   form.report_date,
        hours:         Number(form.hours),
        location:      form.location.trim(),
      })
      if (error) throw error
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message || 'שגיאה בשמירה')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#fff7ed 0%,#f8fafc 60%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: "'Rubik','Segoe UI',Arial,sans-serif",
      direction: 'rtl',
    }}>
      {/* Logo */}
      <div style={{
        width: 48, height: 48, borderRadius: 13,
        background: 'linear-gradient(135deg,#f97316,#ea580c)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10,
      }}>W</div>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', marginBottom: 2 }}>WIN CRM</div>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 28 }}>דוח שעות מדריך</div>

      {status === 'success' ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '36px 40px',
          border: '1px solid #d1fae5', boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          textAlign: 'center', maxWidth: 420, width: '100%',
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>הדוח נשלח בהצלחה!</div>
          <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
            תודה {instructorName}, הדיווח התקבל ויועבר למנהל.
          </div>
          <button
            onClick={() => { setStatus('idle'); setForm(p => ({ ...p, hours: '', location: '' })) }}
            style={{
              background: '#f97316', color: '#fff', border: 'none',
              borderRadius: 9, padding: '11px 28px', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
            }}
          >שלח דוח נוסף</button>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '28px 32px',
          border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          maxWidth: 420, width: '100%',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            👋 שלום, {instructorName || 'מדריך'}
          </div>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 22 }}>
            מלא את פרטי השיעור לדיווח שעות
          </div>

          {status === 'error' && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13,
            }}>
              ⚠ {errorMsg}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>שם בית ספר / מתנ"ס *</label>
              <input
                value={form.location}
                onChange={f('location')}
                placeholder='לדוגמה: בית ספר רמות / מתנ"ס גבעתיים'
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>תאריך *</label>
              <input
                type="date"
                value={form.report_date}
                onChange={f('report_date')}
                style={inputStyle}
                required
              />
              {form.report_date && (
                <div style={{ marginTop: 5, fontSize: 13, color: '#f97316', fontWeight: 600 }}>
                  {dayName(form.report_date)}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>מספר שעות *</label>
              <input
                type="number"
                value={form.hours}
                onChange={f('hours')}
                placeholder="2"
                min=".5"
                step=".5"
                style={inputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                background: status === 'submitting'
                  ? '#9ca3af' : 'linear-gradient(135deg,#f97316,#ea580c)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '13px', fontSize: 15, fontWeight: 700,
                cursor: status === 'submitting' ? 'default' : 'pointer',
                marginTop: 4,
              }}
            >
              {status === 'submitting' ? '⏳ שולח...' : '📤 שלח דוח שעות'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
