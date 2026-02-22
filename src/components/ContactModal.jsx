import React, { useState, useRef } from 'react'

const STATUS_OPTIONS = [
  { value: 'lead',     label: 'ליד'       },
  { value: 'prospect', label: 'פרוספקט'   },
  { value: 'customer', label: 'לקוח פעיל' },
]

const PAYMENT_OPTIONS = [
  { value: '',               label: 'לא צוין'   },
  { value: 'standing_order', label: 'הוראת קבע' },
  { value: 'credit',         label: 'אשראי'     },
  { value: 'cash',           label: 'מזומן'     },
  { value: 'other',          label: 'אחר'       },
]

const EMPTY = { name: '', email: '', phone: '', company: '', status: 'lead', paymentMethod: '', students: [], notes: '' }

function newSid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── ContactModal ─────────────────────────────────────────────────────────────
// קובץ נפרד לחלוטין = React לא יכול ליצור אותו מחדש כש-Contacts מתרנדר.
// inputs עם defaultValue (uncontrolled) + FormData בשליחה → אין איבוד פוקוס.
export default function ContactModal({ modal, onClose, onSubmit }) {
  const formRef = useRef(null)

  const initial = modal.mode === 'add'
    ? EMPTY
    : { ...EMPTY, ...modal.contact, students: modal.contact.students || [] }

  const [students, setStudents] = useState(initial.students)

  const addStudent = () =>
    setStudents(p => [...p, { id: newSid(), name: '', school: '', group: '', age: '' }])

  const removeStudent = (id) =>
    setStudents(p => p.filter(s => s.id !== id))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(formRef.current)
    const name = (fd.get('name') || '').trim()
    if (!name) return
    onSubmit({
      name,
      phone:         (fd.get('phone')         || '').trim(),
      email:         (fd.get('email')         || '').trim(),
      company:       (fd.get('company')       || '').trim(),
      status:        fd.get('status')         || 'lead',
      paymentMethod: fd.get('paymentMethod')  || '',
      notes:         (fd.get('notes')         || '').trim(),
      students: students
        .map(s => ({
          ...s,
          name:   (fd.get(`s_name_${s.id}`)   || '').trim(),
          school: (fd.get(`s_school_${s.id}`) || '').trim(),
          group:  (fd.get(`s_group_${s.id}`)  || '').trim(),
          age:    (fd.get(`s_age_${s.id}`)    || '').trim(),
        }))
        .filter(s => s.name),
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>{modal.mode === 'add' ? 'הוספת לקוח חדש' : 'עריכת לקוח'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="modal-body">

            <div className="form-grid">
              <div className="form-group full">
                <label>שם מלא (הורה) *</label>
                <input name="name" required defaultValue={initial.name} placeholder="ישראל ישראלי" />
              </div>
              <div className="form-group">
                <label>טלפון</label>
                <input name="phone" defaultValue={initial.phone} placeholder="050-0000000" type="tel" />
              </div>
              <div className="form-group">
                <label>אימייל</label>
                <input name="email" defaultValue={initial.email} placeholder="email@example.com" type="email" />
              </div>
              <div className="form-group">
                <label>סטטוס</label>
                <select name="status" defaultValue={initial.status}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>אמצעי תשלום</label>
                <select name="paymentMethod" defaultValue={initial.paymentMethod}>
                  {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label>הערות</label>
                <textarea name="notes" defaultValue={initial.notes} placeholder="הערות נוספות..." />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>
                  תלמידים {students.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({students.length})</span>}
                </label>
                <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '5px 12px' }} onClick={addStudent}>
                  + הוסף תלמיד
                </button>
              </div>

              {students.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>
                  אין תלמידים. לחץ "הוסף תלמיד" לקישור תלמידים להורה זה.
                </p>
              ) : (
                <>
                  <div className="student-row-header">
                    <span style={{ flex: '0 0 24px' }}></span>
                    <span style={{ flex: 2 }}>שם תלמיד</span>
                    <span style={{ flex: 2 }}>בית ספר</span>
                    <span style={{ flex: 2 }}>חוג</span>
                    <span style={{ flex: '0 0 54px' }}>גיל</span>
                    <span style={{ flex: '0 0 28px' }}></span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {students.map((s, idx) => (
                      <div key={s.id} className="student-row">
                        <span className="student-row-num">{idx + 1}</span>
                        <input name={`s_name_${s.id}`}   defaultValue={s.name}   placeholder="שם תלמיד" style={{ flex: 2, minWidth: 0 }} />
                        <input name={`s_school_${s.id}`} defaultValue={s.school} placeholder="בית ספר"  style={{ flex: 2, minWidth: 0 }} />
                        <input name={`s_group_${s.id}`}  defaultValue={s.group}  placeholder="חוג"      style={{ flex: 2, minWidth: 0 }} />
                        <input name={`s_age_${s.id}`}    defaultValue={s.age}    placeholder="גיל"
                          type="number" min="1" max="25" style={{ flex: '0 0 54px', minWidth: 0 }} />
                        <button type="button" onClick={() => removeStudent(s.id)}
                          className="student-remove-btn" title="הסר תלמיד">×</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              {modal.mode === 'add' ? 'הוסף לקוח' : 'שמור שינויים'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  )
}
