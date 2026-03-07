import { useState, useRef, useMemo } from 'react'
import { PROGRAMS, PAY_STATUS } from '../../constants'
import { fmtD, ini, avBg } from '../../utils/format'
import { attPct, studentStatus } from '../../utils/alerts'
import { exportStudentsCSV } from '../../utils/csv'
import { Ico } from '../icons/Ico'
import Papa from 'papaparse'

// ── Student Import Modal ─────────────────────────────────────────
function StudentImportModal({ onClose, onImport }) {
  const [step, setStep]     = useState('upload')
  const [rows, setRows]     = useState([])
  const [error, setError]   = useState(null)
  const fileRef             = useRef()

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        if (!result.data?.length) { setError('הקובץ ריק'); return }
        const mapped = result.data.map(r => ({
          name:          r['שם תלמיד'] || r['שם'] || r['name'] || '',
          className:     r['שם חוג']   || r['class_name'] || '',
          schoolName:    r['בית ספר']  || r['school_name'] || '',
          grade:         r['כיתה']     || r['grade'] || '',
          parentName:    r['שם הורה']  || r['parent_name'] || '',
          parentPhone:   r['טלפון']    || r['טלפון הורה'] || r['phone'] || '',
          program:       r['תוכנית']   || r['program'] || PROGRAMS[0],
          paymentStatus: r['סטטוס תשלום'] || r['payment_status'] || 'pending',
          notes:         r['הערות']    || r['notes'] || '',
        })).filter(r => r.name.trim())
        if (!mapped.length) { setError('לא נמצאו שורות תקינות'); return }
        setRows(mapped)
        setStep('preview')
      },
      error: () => setError('שגיאה בקריאת הקובץ'),
    })
  }

  const doImport = async () => {
    try {
      for (const r of rows) await onImport(r)
      setStep('done')
    } catch (e) {
      setError(e?.message || 'שגיאה בייבוא')
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="mh"><h3>ייבוא תלמידים מ-CSV</h3><button className="mx" onClick={onClose}>×</button></div>
        <div className="mb">
          {step === 'upload' && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
                העלה קובץ CSV עם עמודות: שם תלמיד, שם חוג, בית ספר, כיתה, שם הורה, טלפון, הערות
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }}/>
              <button className="btn btn-p" onClick={() => fileRef.current?.click()}>📁 בחר קובץ</button>
              {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
            </div>
          )}
          {step === 'preview' && (
            <>
              <p style={{ padding: '0 8px', marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
                נמצאו {rows.length} תלמידים לייבוא:
              </p>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table><thead><tr><th>שם</th><th>חוג</th><th>בי"ס</th><th>כיתה</th><th>הורה</th><th>טלפון</th></tr></thead>
                <tbody>{rows.slice(0, 50).map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td>{r.className}</td><td>{r.schoolName}</td><td>{r.grade}</td><td>{r.parentName}</td><td>{r.parentPhone}</td></tr>
                ))}</tbody></table>
              </div>
              {error && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
              <div className="mf">
                <button className="btn btn-p" onClick={doImport}>✓ ייבא {rows.length} תלמידים</button>
                <button className="btn btn-o" onClick={onClose}>ביטול</button>
              </div>
            </>
          )}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <p style={{ fontWeight: 600 }}>יובאו {rows.length} תלמידים בהצלחה!</p>
              <button className="btn btn-p" onClick={onClose} style={{ marginTop: 16 }}>סגור</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
export default function StudentsPage({ students, contacts, onAdd, onUpdate, onDelete }) {
  const [pf, setPf]         = useState('all')
  const [payf, setPayf]     = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [importing, setImporting] = useState(false)

  const filtered = useMemo(() => {
    let list = students
    if (pf !== 'all') list = list.filter(s => s.program === pf)
    if (payf !== 'all') list = list.filter(s => s.paymentStatus === payf)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q) ||
        (s.schoolName || '').toLowerCase().includes(q) ||
        (s.parentName || '').toLowerCase().includes(q) ||
        (s.parentPhone || '').includes(q) ||
        (s.grade || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [students, pf, payf, search])

  const cname = id => contacts.find(c => c.id === id)?.name || ''

  // ── Student Modal ───────────────────────────────────────────────
  function StudentModal({ student }) {
    const isE = !!student
    const [tab, setTab]   = useState('details')
    const [form, setForm] = useState(() => student
      ? { ...student }
      : { name: '', className: '', schoolName: '', grade: '', parentName: '', parentPhone: '',
          contactId: '', program: PROGRAMS[0], paymentStatus: 'pending', notes: '', attendance: [] })
    const [af, setAf]     = useState({ date: new Date().toISOString().split('T')[0], present: true })
    const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

    const addAtt = () => {
      const a = { id: crypto.randomUUID(), date: af.date, present: af.present }
      setForm(p => ({ ...p, attendance: [...(p.attendance || []), a] }))
    }
    const delAtt = id => setForm(p => ({ ...p, attendance: (p.attendance || []).filter(a => a.id !== id) }))
    const save = () => { if (!form.name.trim()) return; isE ? onUpdate(student.id, form) : onAdd(form); setModal(null) }
    const st = studentStatus(form), pct = attPct(form)
    const stInfo = { ok: { label: 'תקין', cls: 'b-green' }, warn: { label: 'פספס שיעור', cls: 'b-yellow' }, risk: { label: 'בסכנת נשירה', cls: 'b-red' } }

    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal modal-lg">
          <div className="mh">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3>{isE ? form.name : 'תלמיד חדש'}</h3>
              {isE && <span className={`badge ${stInfo[st].cls}`}>{stInfo[st].label}</span>}
            </div>
            <button className="mx" onClick={() => setModal(null)} aria-label="סגור">×</button>
          </div>
          {isE && (
            <div className="tabs">
              <button className={`tab ${tab === 'details' ? 'on' : ''}`} onClick={() => setTab('details')}>פרטים</button>
              <button className={`tab ${tab === 'att' ? 'on' : ''}`} onClick={() => setTab('att')}>נוכחות</button>
            </div>
          )}
          {(!isE || tab === 'details') && (
            <div className="mb"><div className="fg">
              {/* ── פרטי תלמיד ── */}
              <div className="frow full" style={{ gridColumn: '1/-1', borderBottom: '2px solid var(--accent)', paddingBottom: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🎓 פרטי תלמיד</span>
              </div>
              <div className="frow"><label>שם תלמיד *</label><input required value={form.name} onChange={f('name')} placeholder="שם מלא"/></div>
              <div className="frow"><label>כיתה</label><input value={form.grade || ''} onChange={f('grade')} placeholder='למשל: ד׳2, ו׳1'/></div>
              <div className="frow"><label>שם חוג</label><input value={form.className || ''} onChange={f('className')} placeholder="WIN ENGLISH, PixMix..."/></div>
              <div className="frow"><label>תוכנית</label><select value={form.program} onChange={f('program')}>{PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>

              {/* ── בית ספר ── */}
              <div className="frow full" style={{ gridColumn: '1/-1', borderBottom: '2px solid #3b82f6', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>🏫 מוסד לימודים</span>
              </div>
              <div className="frow"><label>שם בית ספר</label><input value={form.schoolName || ''} onChange={f('schoolName')} placeholder="בית ספר..."/></div>
              <div className="frow"><label>קשור למוסד</label><select value={form.contactId} onChange={f('contactId')}><option value="">ללא</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>

              {/* ── הורים ── */}
              <div className="frow full" style={{ gridColumn: '1/-1', borderBottom: '2px solid #f97316', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>👨‍👩‍👧 פרטי הורה</span>
              </div>
              <div className="frow"><label>שם הורה</label><input value={form.parentName || ''} onChange={f('parentName')} placeholder="שם ההורה"/></div>
              <div className="frow"><label>טלפון הורה</label><input value={form.parentPhone || ''} onChange={f('parentPhone')} placeholder="050-0000000" dir="ltr"/></div>

              {/* ── תשלום והערות ── */}
              <div className="frow full" style={{ gridColumn: '1/-1', borderBottom: '2px solid #10b981', paddingBottom: 4, marginBottom: 4, marginTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>💰 תשלום והערות</span>
              </div>
              <div className="frow"><label>סטטוס תשלום</label><select value={form.paymentStatus} onChange={f('paymentStatus')}>{PAY_STATUS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div className="frow full"><label>הערות</label><textarea value={form.notes || ''} onChange={f('notes')} placeholder="הערות..."/></div>
            </div>
            <div className="mf">
              <button className="btn btn-p" onClick={save}>{isE ? 'שמור' : 'הוסף'}</button>
              <button className="btn btn-o" onClick={() => setModal(null)}>ביטול</button>
              {isE && <button className="del-link" onClick={() => { if (window.confirm('למחוק?')) { onDelete(student.id); setModal(null) } }}>מחק</button>}
            </div></div>
          )}
          {isE && tab === 'att' && (
            <div className="mb">
              {pct !== null && <div className="sumbox"><div>נוכחות: <span>{pct}%</span></div><div>סה"כ שיעורים: <span>{(form.attendance || []).length}</span></div><div>נעדר: <span>{(form.attendance || []).filter(a => !a.present).length}</span></div></div>}
              {st === 'risk' && <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 7, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>⚠️ תלמיד זה פספס 2 שיעורים ברצף – מומלץ לפנות להורים</div>}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
                <div className="frow" style={{ flex: 1 }}><label>תאריך</label><input type="date" value={af.date} onChange={e => setAf(p => ({ ...p, date: e.target.value }))}/></div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 1 }}>
                  <button className={`btn btn-sm ${af.present ? 'btn-p' : 'btn-o'}`} onClick={() => setAf(p => ({ ...p, present: true }))}>נכח</button>
                  <button className={`btn btn-sm ${!af.present ? 'btn-p' : 'btn-o'}`} style={!af.present ? { background: 'var(--danger)' } : {}} onClick={() => setAf(p => ({ ...p, present: false }))}>נעדר</button>
                  <button className="btn btn-o btn-sm" onClick={addAtt}>+ הוסף</button>
                </div>
              </div>
              {!(form.attendance || []).length
                ? <div className="empty"><p>אין רשומות נוכחות</p></div>
                : [...(form.attendance || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => (
                  <div key={a.id} className="sess-row">
                    <span style={{ color: 'var(--muted)', flex: 'none' }}>{fmtD(a.date)}</span>
                    <span className={`badge ${a.present ? 'b-green' : 'b-red'}`}>{a.present ? 'נכח' : 'נעדר'}</span>
                    <button className="icon-btn" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => delAtt(a.id)}><Ico.trash/></button>
                  </div>
                ))}
              <div className="mf"><button className="btn btn-p" onClick={save}>שמור</button><button className="btn btn-o" onClick={() => setModal(null)}>סגור</button></div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const stInfo = { ok: { label: 'תקין', cls: 'b-green' }, warn: { label: 'פספס', cls: 'b-yellow' }, risk: { label: 'בסכנה', cls: 'b-red' } }

  return (
    <>
      <div className="ph">
        <h2>תלמידים</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-o btn-sm" onClick={() => exportStudentsCSV(students, contacts)}>
            <Ico.dl/>ייצוא CSV
          </button>
          <button className="btn btn-o btn-sm" onClick={() => setImporting(true)}>
            <Ico.ul/>ייבוא
          </button>
          <button className="btn btn-p" onClick={() => setModal({ student: null })} aria-label="הוסף תלמיד חדש"><Ico.plus/>הוסף תלמיד</button>
        </div>
      </div>
      <div className="pb"><div className="card">
        {/* ── Filters ── */}
        <div className="filter-bar">
          <input className="si-input" placeholder="🔍 חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 180 }} aria-label="חיפוש תלמידים"/>
          <button className={`fp ${pf === 'all' ? 'on' : ''}`} onClick={() => setPf('all')}>הכל<span className="fp-cnt">{students.length}</span></button>
          {PROGRAMS.map(p => { const cnt = students.filter(s => s.program === p).length; return cnt > 0 ? <button key={p} className={`fp ${pf === p ? 'on' : ''}`} onClick={() => setPf(p)}>{p}<span className="fp-cnt">{cnt}</span></button> : null })}
          <div style={{ borderRight: '1px solid var(--border)', margin: '0 4px', height: 20 }}/>
          {PAY_STATUS.map(p => <button key={p.value} className={`fp ${payf === p.value ? 'on' : ''}`} onClick={() => setPayf(payf === p.value ? 'all' : p.value)}>{p.label}<span className="fp-cnt">{students.filter(s => s.paymentStatus === p.value).length}</span></button>)}
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 'auto' }}>{filtered.length} תלמידים</span>
        </div>
        {!filtered.length
          ? <div className="empty"><div className="empty-ico">🎓</div><p>אין תלמידים עדיין</p></div>
          : <div className="tbl-wrap"><table>
            <thead><tr>
              <th>שם חוג</th>
              <th>בית ספר</th>
              <th>שם תלמיד</th>
              <th>כיתה</th>
              <th>שם הורה</th>
              <th>טלפון</th>
              <th>סטטוס</th>
              <th>הערות</th>
              <th style={{ width: 60 }}></th>
            </tr></thead>
            <tbody>{filtered.map(s => {
              const st = studentStatus(s)
              const pay = PAY_STATUS.find(p => p.value === s.paymentStatus) || PAY_STATUS[1]
              return (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ student: s })}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{s.className || s.program || '–'}</td>
                  <td>{s.schoolName || cname(s.contactId) || '–'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="av" style={{ width: 28, height: 28, fontSize: 10, background: avBg(s.name) }}>{ini(s.name)}</div>
                      <strong>{s.name}</strong>
                    </div>
                  </td>
                  <td>{s.grade || '–'}</td>
                  <td>{s.parentName || '–'}</td>
                  <td style={{ direction: 'ltr', textAlign: 'right' }}>
                    {s.parentPhone
                      ? <a href={`tel:${s.parentPhone}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{s.parentPhone}</a>
                      : '–'}
                  </td>
                  <td>
                    <span className={`badge ${stInfo[st].cls}`} title={st === 'risk' ? 'פספס 2 שיעורים ברצף' : st === 'warn' ? 'נעדר משיעור אחד' : 'נוכחות תקינה'}>{stInfo[st].label}</span>
                    {' '}
                    <span className={`badge ${pay.badge}`} style={{ fontSize: 10 }}>{pay.label}</span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.notes || '–'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="ac-cell">
                      <button className="icon-btn" onClick={() => setModal({ student: s })} aria-label={`ערוך ${s.name}`}><Ico.edit/></button>
                      <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm(`למחוק ${s.name}?`)) onDelete(s.id) }} aria-label={`מחק ${s.name}`}><Ico.trash/></button>
                    </div>
                  </td>
                </tr>
              )
            })}</tbody></table></div>}
      </div></div>
      {modal && <StudentModal student={modal.student}/>}
      {importing && <StudentImportModal onClose={() => setImporting(false)} onImport={onAdd}/>}
    </>
  )
}
