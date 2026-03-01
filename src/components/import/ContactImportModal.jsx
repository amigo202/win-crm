import { useState, useCallback, Fragment } from 'react'
import Papa from 'papaparse'
import { upsertContacts } from '../../services/contactsService'

// ── DB fields the user can map CSV columns to ─────────────────────
const DB_FIELDS = [
  { value: '',               label: '— דלג —' },
  { value: 'name',           label: 'שם' },
  { value: 'type',           label: 'סוג' },
  { value: 'contact_person', label: 'איש קשר' },
  { value: 'phone',          label: 'טלפון' },
  { value: 'email',          label: 'אימייל' },
]

// ── Auto-detect common Hebrew + English column names ───────────────
const AUTO_MAP = {
  'שם': 'name', 'name': 'name', 'שם מלא': 'name', 'full name': 'name',
  'סוג': 'type', 'type': 'type', 'קטגוריה': 'type', 'category': 'type',
  'איש קשר': 'contact_person', 'contact': 'contact_person',
  'contact_person': 'contact_person', 'נציג': 'contact_person', 'נציג קשר': 'contact_person',
  'טלפון': 'phone', 'phone': 'phone', 'mobile': 'phone',
  'נייד': 'phone', 'פלאפון': 'phone', 'טל': 'phone', 'tel': 'phone',
  'אימייל': 'email', 'email': 'email', 'mail': 'email',
  'דוא"ל': 'email', 'דואל': 'email', 'e-mail': 'email',
}

function buildAutoMap(headers) {
  const m = {}
  for (const h of headers) {
    m[h] = AUTO_MAP[h.trim()] || AUTO_MAP[h.trim().toLowerCase()] || ''
  }
  return m
}

// ── Result card ────────────────────────────────────────────────────
function ResultCard({ icon, label, value, color }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────
export default function ContactImportModal({ onClose, onDone }) {
  const [step, setStep]         = useState('upload')   // upload | map | preview | importing | done
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows]   = useState([])
  const [mapping, setMapping]   = useState({})
  const [result, setResult]     = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseErr, setParseErr] = useState('')

  // ── Parse CSV with PapaParse ─────────────────────────────────────
  const parseCsv = useCallback((file, name) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true, encoding: 'UTF-8',
      complete(res) {
        const headers = res.meta.fields || []
        if (!headers.length) { setParseErr('הקובץ ריק — ודא שיש שורת כותרות'); return }
        setCsvHeaders(headers); setCsvRows(res.data)
        setMapping(buildAutoMap(headers)); setStep('map')
      },
      error(err) { setParseErr('שגיאה בפענוח: ' + err.message) },
    })
  }, [])

  // ── Parse Excel with SheetJS (loaded on demand from CDN) ──────────
  const parseXlsx = useCallback(async (file) => {
    try {
      const { read, utils } = await import('https://esm.sh/xlsx@0.18.5')
      const buf     = await file.arrayBuffer()
      const wb      = read(buf)
      const ws      = wb.Sheets[wb.SheetNames[0]]
      const rows    = utils.sheet_to_json(ws, { defval: '' })
      const headers = rows.length ? Object.keys(rows[0]) : []
      if (!headers.length) { setParseErr('הקובץ ריק — ודא שיש שורת כותרות'); return }
      setCsvHeaders(headers); setCsvRows(rows)
      setMapping(buildAutoMap(headers)); setStep('map')
    } catch (e) {
      setParseErr('שגיאה בפענוח Excel: ' + e.message)
    }
  }, [])

  const parseFile = useCallback((file) => {
    setParseErr(''); setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') parseXlsx(file)
    else parseCsv(file, file.name)
  }, [parseCsv, parseXlsx])

  const onFileChange = e => {
    const f = e.target.files[0]; if (f) parseFile(f); e.target.value = ''
  }

  const onDrop = e => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
    else setParseErr('נא לגרור קובץ CSV או Excel')
  }

  // ── Prevent mapping the same DB field to two CSV columns ─────────
  function setFieldMapping(csvCol, dbField) {
    setMapping(prev => {
      // If choosing a real field, clear any other CSV column that had it
      if (dbField) {
        const cleared = Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, v === dbField && k !== csvCol ? '' : v])
        )
        return { ...cleared, [csvCol]: dbField }
      }
      return { ...prev, [csvCol]: dbField }
    })
  }

  // ── Apply current mapping to a raw CSV row ───────────────────────
  function applyMapping(row) {
    const out = {}
    for (const [csvCol, dbField] of Object.entries(mapping)) {
      if (dbField) out[dbField] = row[csvCol] ?? ''
    }
    return out
  }

  const mappedPreview = csvRows.slice(0, 10).map(applyMapping)
  const mappedDbFields = DB_FIELDS.filter(f => f.value && Object.values(mapping).includes(f.value))
  const nameIsMapped  = Object.values(mapping).includes('name')

  // ── Run the upsert ───────────────────────────────────────────────
  const runImport = async () => {
    setStep('importing')
    try {
      const rows = csvRows.map(applyMapping)
      const res  = await upsertContacts(rows)
      setResult(res)
      if (onDone) onDone()
    } catch (err) {
      setResult({ inserted: 0, updated: 0, skipped: 0, errors: [{ error: err.message }] })
    }
    setStep('done')
  }

  const canClose = step !== 'importing'

  return (
    <div
      className="overlay"
      onClick={e => e.target === e.currentTarget && canClose && onClose()}
    >
      <div className="modal" style={{ width: 620, maxWidth: '96vw' }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="modal-hd">
          <span>ייבוא אנשי קשר מ-CSV / Excel</span>
          {canClose && (
            <button
              className="icon-btn"
              onClick={onClose}
              style={{ fontSize: 22, lineHeight: 1, padding: '0 4px' }}
            >×</button>
          )}
        </div>

        {/* ── Step indicator ───────────────────────────────────────── */}
        {step !== 'importing' && step !== 'done' && (
          <div style={{
            display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
            padding: '0 20px', fontSize: 12,
          }}>
            {[['upload','העלאה'],['map','מיפוי'],['preview','תצוגה']].map(([s, lbl], i) => {
              const steps = ['upload','map','preview']
              const active = s === step
              const done   = steps.indexOf(s) < steps.indexOf(step)
              return (
                <div key={s} style={{
                  padding: '10px 16px', borderBottom: active ? '2px solid #f97316' : '2px solid transparent',
                  color: active ? '#f97316' : done ? 'var(--text)' : 'var(--muted)',
                  fontWeight: active ? 600 : 400,
                }}>
                  {i + 1}. {lbl}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ Step: upload ══════════════════════════════════════════ */}
        {step === 'upload' && (
          <div className="modal-bd">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('csv-import-input').click()}
              style={{
                border: `2px dashed ${dragOver ? '#f97316' : 'var(--border)'}`,
                borderRadius: 10, padding: '44px 20px', textAlign: 'center',
                background: dragOver ? 'rgba(249,115,22,.06)' : 'var(--bg)',
                cursor: 'pointer', transition: 'border-color .15s, background .15s',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 5 }}>גרור קובץ CSV או Excel לכאן</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>או לחץ לבחירת קובץ מהמחשב</div>
              <input
                id="csv-import-input"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>

            {parseErr && (
              <p style={{ color: 'var(--danger)', marginTop: 10, fontSize: 13 }}>⚠ {parseErr}</p>
            )}

            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong>עמודות נתמכות:</strong> שם, סוג, איש קשר, טלפון, אימייל
              <br/>ניתן למפות ידנית בשלב הבא. קידוד מומלץ: UTF-8.
            </div>
          </div>
        )}

        {/* ══ Step: map ════════════════════════════════════════════ */}
        {step === 'map' && (
          <div className="modal-bd">
            <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{csvRows.length} שורות</strong> זוהו בקובץ{' '}
              <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>{fileName}</code>.
              {' '}מפה כל עמודה לשדה CRM הנכון:
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 24px 1fr',
              gap: '8px 10px',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              {/* Column headers */}
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>עמודת CSV</div>
              <div />
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>שדה CRM</div>

              {csvHeaders.map(h => (
                <Fragment key={h}>
                  <div style={{
                    padding: '5px 10px', borderRadius: 6,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    fontSize: 13, fontFamily: 'monospace', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </div>
                  <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>→</div>
                  <select
                    className="si-input"
                    style={{ fontSize: 13, height: 34 }}
                    value={mapping[h] || ''}
                    onChange={e => setFieldMapping(h, e.target.value)}
                  >
                    {DB_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Fragment>
              ))}
            </div>

            {!nameIsMapped && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>
                ⚠ חובה למפות עמודה לשדה <strong>שם</strong> לפני המשך
              </p>
            )}
          </div>
        )}

        {/* ══ Step: preview ════════════════════════════════════════ */}
        {step === 'preview' && (
          <div className="modal-bd">
            <p style={{ marginBottom: 10, fontSize: 13 }}>
              תצוגה מקדימה —{' '}
              <strong>{Math.min(10, csvRows.length)}</strong> מתוך{' '}
              <strong>{csvRows.length}</strong> שורות:
            </p>

            <div className="tbl-wrap" style={{ maxHeight: 280, marginBottom: 14 }}>
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    {mappedDbFields.map(f => <th key={f.value}>{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i}>
                      {mappedDbFields.map(f => (
                        <td key={f.value} style={{
                          maxWidth: 140, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row[f.value] || <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{
              background: 'var(--bg)', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6,
            }}>
              כפילויות יזוהו לפי <strong>אימייל</strong> (עדיפות ראשונה) → <strong>טלפון</strong>. שורות ללא שם יידלגו.
            </div>
          </div>
        )}

        {/* ══ Step: importing ══════════════════════════════════════ */}
        {step === 'importing' && (
          <div className="modal-bd" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>מייבא {csvRows.length} שורות...</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>נא לא לסגור את החלון</div>
          </div>
        )}

        {/* ══ Step: done ═══════════════════════════════════════════ */}
        {step === 'done' && result && (
          <div className="modal-bd">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <ResultCard icon="✅" label="נוספו חדשים"  value={result.inserted} color="#22c55e" />
              <ResultCard icon="🔄" label="עודכנו"        value={result.updated}  color="#f97316" />
              <ResultCard icon="⊝"  label="דולגו (ללא שם)" value={result.skipped} color="var(--muted)" />
              <ResultCard
                icon="⚠"
                label="שגיאות"
                value={result.errors.length}
                color={result.errors.length ? 'var(--danger)' : 'var(--muted)'}
              />
            </div>

            {result.errors.length > 0 && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--danger)', marginBottom: 8, userSelect: 'none' }}>
                  פרטי שגיאות ({result.errors.length})
                </summary>
                <div style={{
                  background: 'var(--bg)', borderRadius: 6,
                  padding: '10px 12px', maxHeight: 140, overflowY: 'auto',
                  lineHeight: 1.7,
                }}>
                  {result.errors.map((e, i) => (
                    <div key={i}>
                      <span style={{ color: 'var(--muted)' }}>{e.row?.name || `שורה ${i + 1}`}:</span>{' '}
                      {e.error}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="modal-ft">
          {step === 'upload' && (
            <button className="btn btn-o" onClick={onClose}>ביטול</button>
          )}

          {step === 'map' && (
            <>
              <button className="btn btn-o" onClick={() => setStep('upload')}>חזור</button>
              <button
                className="btn btn-p"
                disabled={!nameIsMapped}
                onClick={() => setStep('preview')}
              >
                תצוגה מקדימה →
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="btn btn-o" onClick={() => setStep('map')}>חזור</button>
              <button className="btn btn-p" onClick={runImport}>
                ייבא {csvRows.length} שורות
              </button>
            </>
          )}

          {step === 'done' && (
            <button className="btn btn-p" onClick={onClose}>סגור</button>
          )}
        </div>
      </div>
    </div>
  )
}
