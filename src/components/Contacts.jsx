import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

const STATUS_OPTIONS = [
  { value: 'lead',     label: 'ליד',       badge: 'badge-yellow' },
  { value: 'prospect', label: 'פרוספקט',   badge: 'badge-blue'   },
  { value: 'customer', label: 'לקוח פעיל', badge: 'badge-green'  },
]

const PAYMENT_OPTIONS = [
  { value: '',               label: 'לא צוין',   badge: 'badge-gray'   },
  { value: 'standing_order', label: 'הוראת קבע', badge: 'badge-green'  },
  { value: 'credit',         label: 'אשראי',     badge: 'badge-blue'   },
  { value: 'cash',           label: 'מזומן',     badge: 'badge-yellow' },
  { value: 'other',          label: 'אחר',       badge: 'badge-gray'   },
]

const CSV_COLUMNS = [
  { name: 'שם_הורה',      required: true,  desc: 'שם מלא של ההורה/אפוטרופוס המשלם',              example: 'ישראל ישראלי' },
  { name: 'טלפון',        required: false, desc: 'מספר טלפון נייד',                               example: '050-1234567' },
  { name: 'אימייל',       required: false, desc: 'כתובת דואר אלקטרוני',                           example: 'israel@example.com' },
  { name: 'סטטוס',        required: false, desc: 'lead · prospect · customer  (ברירת מחדל: lead)', example: 'customer' },
  { name: 'אמצעי_תשלום',  required: false, desc: 'standing_order · credit · cash · other',        example: 'standing_order' },
  { name: 'שם_תלמיד',    required: false, desc: 'שם התלמיד — שורה נפרדת לכל תלמיד של אותו הורה', example: 'יוסי ישראלי' },
  { name: 'בית_ספר',      required: false, desc: 'שם בית הספר של התלמיד',                         example: 'ממ"ד רמות' },
  { name: 'חוג',          required: false, desc: 'שם החוג / הפעילות',                             example: 'כדורגל' },
  { name: 'גיל',          required: false, desc: 'גיל התלמיד',                                    example: '10' },
  { name: 'הערות',        required: false, desc: 'הערות נוספות על ההורה',                        example: 'מעדיף ווטסאפ' },
]

const SAMPLE_CSV =
  'שם_הורה,טלפון,אימייל,סטטוס,אמצעי_תשלום,שם_תלמיד,בית_ספר,חוג,גיל,הערות\n' +
  'ישראל ישראלי,050-1234567,israel@example.com,customer,standing_order,יוסי ישראלי,ממ"ד רמות,כדורגל,10,\n' +
  'ישראל ישראלי,050-1234567,israel@example.com,customer,standing_order,שירה ישראלי,ממ"ד רמות,ריקוד,8,\n' +
  'רחל כהן,052-7654321,rachel@example.com,prospect,credit,דן כהן,בית ספר הרצוג,שחייה,12,אלרגי לאגוזים\n' +
  'דוד לוי,054-9876543,david@example.com,lead,,,,,,הגיע דרך המלצה'

function getInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function newSid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const EMPTY = { name: '', email: '', phone: '', company: '', status: 'lead', paymentMethod: '', students: [], notes: '' }

// ── CSV parser ──────────────────────────────────────────────────────────────
function parseCSVToContacts(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Support comma or semicolon delimiter
  const delim = lines[0].includes(';') ? ';' : ','
  const parseFields = (line) => {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ }
      else if (line[i] === delim && !inQ) { fields.push(cur.trim()); cur = '' }
      else { cur += line[i] }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseFields(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  const parentMap = new Map()

  lines.slice(1).forEach(line => {
    if (!line.trim()) return
    const vals = parseFields(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '') })

    const parentName = row['שם_הורה']?.trim()
    if (!parentName) return

    const key = row['טלפון']?.trim() || parentName

    if (!parentMap.has(key)) {
      parentMap.set(key, {
        name: parentName,
        phone: row['טלפון']?.trim() || '',
        email: row['אימייל']?.trim() || '',
        status: ['lead', 'prospect', 'customer'].includes(row['סטטוס']?.trim())
          ? row['סטטוס'].trim() : 'lead',
        paymentMethod: ['standing_order', 'credit', 'cash', 'other'].includes(row['אמצעי_תשלום']?.trim())
          ? row['אמצעי_תשלום'].trim() : '',
        company: '',
        notes: row['הערות']?.trim() || '',
        students: [],
      })
    }

    const contact = parentMap.get(key)
    if (row['הערות']?.trim() && !contact.notes) contact.notes = row['הערות'].trim()

    if (row['שם_תלמיד']?.trim()) {
      contact.students.push({
        id: newSid(),
        name: row['שם_תלמיד'].trim(),
        school: row['בית_ספר']?.trim() || '',
        group: row['חוג']?.trim() || '',
        age: row['גיל']?.trim() || '',
      })
    }
  })

  return [...parentMap.values()]
}

// ── ImportModal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError]     = useState('')
  const [dragging, setDragging] = useState(false)

  const downloadSample = () => {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'דוגמא-ייבוא-לקוחות.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processFile = (file) => {
    if (!file) return
    setError('')
    setPreview(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const contacts = parseCSVToContacts(ev.target.result)
        if (contacts.length === 0) { setError('לא נמצאו שורות תקינות בקובץ. ודא שהשורה הראשונה היא כותרות.'); return }
        setPreview({ contacts })
      } catch {
        setError('שגיאה בקריאת הקובץ. ודא שהוא קובץ CSV תקין.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleFile = (e) => processFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const totalStudents = preview?.contacts.reduce((s, c) => s + c.students.length, 0) ?? 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <h3>ייבוא אנשי קשר מ-CSV</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* ── Column guide ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600 }}>מבנה הקובץ הנדרש</h4>
              <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={downloadSample}>
                <DownloadIcon /> הורד קובץ דוגמא
              </button>
            </div>
            <div className="import-info-box">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                <strong>כל שורה = תלמיד אחד.</strong> הורה עם כמה תלמידים יופיע בכמה שורות עם אותו מספר טלפון — המערכת תאגד אותם אוטומטית תחת הורה אחד.
                הורה ללא תלמידים: שורה אחת עם שדות תלמיד ריקים.
              </p>
              <table className="import-columns-table">
                <thead>
                  <tr>
                    <th>שם העמודה</th>
                    <th style={{ textAlign: 'center' }}>חובה</th>
                    <th>תיאור</th>
                    <th>דוגמא</th>
                  </tr>
                </thead>
                <tbody>
                  {CSV_COLUMNS.map(col => (
                    <tr key={col.name}>
                      <td><code>{col.name}</code></td>
                      <td style={{ textAlign: 'center', color: col.required ? 'var(--success)' : 'var(--text-muted)' }}>
                        {col.required ? '✓' : '—'}
                      </td>
                      <td>{col.desc}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── File upload ── */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>העלאת קובץ</h4>
            <div
              className={`import-dropzone${dragging ? ' import-dropzone-active' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <UploadIcon />
              <span>לחץ לבחירת קובץ CSV או גרור לכאן</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>מומלץ לשמור ב-UTF-8 לתמיכה בעברית</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>

          {/* ── Preview ── */}
          {preview && (
            <div className="import-preview">
              <p style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 10 }}>
                ✓ נמצאו {preview.contacts.length} הורים עם סה"כ {totalStudents} תלמידים — מוכן לייבוא
              </p>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {preview.contacts.slice(0, 10).map((c, i) => (
                  <div key={i} className="import-preview-row">
                    <span style={{ fontWeight: 500, minWidth: 130 }}>{c.name}</span>
                    <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{c.phone || '—'}</span>
                    {c.paymentMethod && (
                      <span className={`badge ${PAYMENT_OPTIONS.find(p => p.value === c.paymentMethod)?.badge || 'badge-gray'}`} style={{ fontSize: 11 }}>
                        {PAYMENT_OPTIONS.find(p => p.value === c.paymentMethod)?.label}
                      </span>
                    )}
                    <span style={{ color: 'var(--primary)', fontSize: 12, marginRight: 'auto' }}>
                      {c.students.length > 0 ? `${c.students.length} תלמידים` : 'ללא תלמידים'}
                    </span>
                  </div>
                ))}
                {preview.contacts.length > 10 && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    ועוד {preview.contacts.length - 10} הורים...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={() => { onImport(preview.contacts); onClose() }}
            disabled={!preview}
          >
            ייבא {preview ? `${preview.contacts.length} אנשי קשר` : ''}
          </button>
          <button className="btn btn-outline" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}

// ── ContactModal ─────────────────────────────────────────────────────────────
function ContactModal({ modal, onClose, onSubmit }) {
  const [form, setForm] = useState(() =>
    modal.mode === 'add'
      ? EMPTY
      : { ...EMPTY, ...modal.contact, students: modal.contact.students || [] }
  )

  const field = useCallback((key) => (e) => {
    const val = e.target.value
    setForm(p => ({ ...p, [key]: val }))
  }, [])

  const addStudent = () =>
    setForm(p => ({ ...p, students: [...p.students, { id: newSid(), name: '', school: '', group: '', age: '' }] }))

  const updateStudent = (id, key, val) =>
    setForm(p => ({ ...p, students: p.students.map(s => s.id === id ? { ...s, [key]: val } : s) }))

  const removeStudent = (id) =>
    setForm(p => ({ ...p, students: p.students.filter(s => s.id !== id) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>{modal.mode === 'add' ? 'הוספת לקוח חדש' : 'עריכת לקוח'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Parent fields */}
            <div className="form-grid">
              <div className="form-group full">
                <label>שם מלא (הורה) *</label>
                <input required value={form.name} onChange={field('name')} placeholder="ישראל ישראלי" />
              </div>
              <div className="form-group">
                <label>טלפון</label>
                <input value={form.phone} onChange={field('phone')} placeholder="050-0000000" type="tel" />
              </div>
              <div className="form-group">
                <label>אימייל</label>
                <input value={form.email} onChange={field('email')} placeholder="email@example.com" type="email" />
              </div>
              <div className="form-group">
                <label>סטטוס</label>
                <select value={form.status} onChange={field('status')}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>אמצעי תשלום</label>
                <select value={form.paymentMethod} onChange={field('paymentMethod')}>
                  {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label>הערות</label>
                <textarea value={form.notes} onChange={field('notes')} placeholder="הערות נוספות..." />
              </div>
            </div>

            {/* Students section */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600 }}>
                  תלמידים {form.students.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({form.students.length})</span>}
                </label>
                <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '5px 12px' }} onClick={addStudent}>
                  + הוסף תלמיד
                </button>
              </div>

              {form.students.length === 0 ? (
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
                    {form.students.map((s, idx) => (
                      <div key={s.id} className="student-row">
                        <span className="student-row-num">{idx + 1}</span>
                        <input
                          value={s.name}
                          onChange={e => updateStudent(s.id, 'name', e.target.value)}
                          placeholder="שם תלמיד"
                          style={{ flex: 2, minWidth: 0 }}
                        />
                        <input
                          value={s.school}
                          onChange={e => updateStudent(s.id, 'school', e.target.value)}
                          placeholder="בית ספר"
                          style={{ flex: 2, minWidth: 0 }}
                        />
                        <input
                          value={s.group}
                          onChange={e => updateStudent(s.id, 'group', e.target.value)}
                          placeholder="חוג"
                          style={{ flex: 2, minWidth: 0 }}
                        />
                        <input
                          value={s.age}
                          onChange={e => updateStudent(s.id, 'age', e.target.value)}
                          placeholder="גיל"
                          type="number"
                          min="1" max="25"
                          style={{ flex: '0 0 54px', minWidth: 0 }}
                        />
                        <button
                          type="button"
                          onClick={() => removeStudent(s.id)}
                          className="student-remove-btn"
                          title="הסר תלמיד"
                        >×</button>
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

// ── Main Contacts ────────────────────────────────────────────────────────────
export default function Contacts({ contacts, deals, onAddContact, onUpdateContact, onDeleteContact, onImportContacts }) {
  const [searchInput, setSearchInput] = useState('')   // מה שרואים ב-input — מתעדכן מיידית
  const [search, setSearch]           = useState('')   // מה שמפעיל סינון/query — אחרי debounce
  const [modal, setModal]             = useState(null)
  const [showImport, setShowImport]   = useState(false)

  // Debounce: שולח שאילתה רק 500ms אחרי שהמשתמש הפסיק להקליד
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      [c.name, c.email, c.company, ...(c.students || []).map(s => s.name)].some(v => v?.toLowerCase().includes(q))
    )
  }, [contacts, search])

  const dealCountMap = useMemo(() => {
    const map = {}
    deals?.forEach(d => { map[d.contactId] = (map[d.contactId] || 0) + 1 })
    return map
  }, [deals])

  const openAdd  = () => setModal({ mode: 'add' })
  const openEdit = (c) => setModal({ mode: 'edit', contact: c })
  const close    = () => setModal(null)

  const handleSubmit = (form) => {
    modal.mode === 'add' ? onAddContact(form) : onUpdateContact(modal.contact.id, form)
    close()
  }

  const handleDelete = (contact) => {
    if (window.confirm(`למחוק את ${contact.name}?`)) onDeleteContact(contact.id)
  }

  return (
    <>
      <div className="page-header">
        <h2>לקוחות ואנשי קשר</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>
            <UploadIcon /> ייבוא CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <PlusIcon /> הוסף לקוח
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="search-bar">
            <input
              className="search-input"
              type="text"
              placeholder="חיפוש לפי שם הורה, תלמיד, אימייל..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="table-wrapper">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <p>{searchInput ? `לא נמצאו תוצאות עבור "${searchInput}"` : 'אין לקוחות עדיין. לחץ "הוסף לקוח" או "ייבוא CSV" להתחיל.'}</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>הורה</th>
                    <th>טלפון</th>
                    <th>אימייל</th>
                    <th>תלמידים</th>
                    <th>תשלום</th>
                    <th>סטטוס</th>
                    <th>עסקאות</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const status  = STATUS_OPTIONS.find(o => o.value === c.status) || STATUS_OPTIONS[0]
                    const payment = PAYMENT_OPTIONS.find(o => o.value === (c.paymentMethod || '')) || PAYMENT_OPTIONS[0]
                    const students = c.students || []
                    const dealCount = dealCountMap[c.id] || 0
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                              {getInitials(c.name)}
                            </div>
                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                          </div>
                        </td>
                        <td>{c.phone || '—'}</td>
                        <td>{c.email || '—'}</td>
                        <td>
                          {students.length > 0 ? (
                            <span title={students.map(s => `${s.name}${s.group ? ` (${s.group})` : ''}`).join('\n')} style={{ cursor: 'default' }}>
                              <span className="badge badge-purple">{students.length} תלמידים</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td>
                          {c.paymentMethod ? (
                            <span className={`badge ${payment.badge}`}>{payment.label}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td><span className={`badge ${status.badge}`}>{status.label}</span></td>
                        <td>{dealCount || '—'}</td>
                        <td>
                          <div className="actions-cell">
                            <button className="btn-icon" onClick={() => openEdit(c)} title="עריכה">
                              <EditIcon />
                            </button>
                            <button className="btn-icon" onClick={() => handleDelete(c)} title="מחיקה" style={{ color: 'var(--danger)' }}>
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal && <ContactModal modal={modal} onClose={close} onSubmit={handleSubmit} />}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={onImportContacts}
        />
      )}
    </>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
