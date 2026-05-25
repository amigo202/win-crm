import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePipeline } from '../../hooks/usePipeline'

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']
const LINE_TYPES   = ['חוגים','קורסים','הפקת סרטונים','קייסנות','סרטונים','שונות']
const VAT_RATE     = 18 / 118

const fmt = n => n > 0 ? '₪' + Math.round(n).toLocaleString('he-IL') : ''

// ─── Cell Component ───────────────────────────────────────────────────────────
function Cell({ amount, isPaid, isEditing, onStartEdit, onTogglePaid, onSave }) {
  const inputRef = useRef()
  const [val, setVal] = useState('')

  useEffect(() => {
    if (isEditing) {
      setVal(amount > 0 ? String(amount) : '')
      setTimeout(() => inputRef.current?.select(), 10)
    }
  }, [isEditing, amount])

  const commit = useCallback(() => {
    const num = parseFloat(val.replace(/,/g, '')) || 0
    onSave(num)
  }, [val, onSave])

  const hasMoney = amount > 0

  // Cell style based on state
  let cellBg = 'transparent'
  let textColor = '#cbd5e1'
  let fontWeight = 400

  if (isPaid) {
    cellBg = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
    textColor = '#fff'
    fontWeight = 700
  } else if (hasMoney) {
    cellBg = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
    textColor = '#1d4ed8'
    fontWeight = 700
  }

  return (
    <td style={{
      padding: 0,
      minWidth: 80,
      height: 40,
      background: cellBg,
      border: '1px solid #e2e8f0',
      position: 'relative',
      cursor: 'pointer',
      transition: 'all .15s',
      verticalAlign: 'middle',
    }}>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') { setVal(''); e.target.blur() }
          }}
          style={{
            width: '100%', height: '100%',
            background: '#fff', border: '2px solid #f97316',
            color: '#0f172a', textAlign: 'center',
            fontSize: 13, fontFamily: 'Rubik, sans-serif',
            padding: '0 2px', outline: 'none', fontWeight: 700,
          }}
        />
      ) : (
        <div
          onClick={onStartEdit}
          style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 40 }}
        >
          <span style={{ color: textColor, fontSize: 12, fontWeight }}>
            {hasMoney ? fmt(amount) : <span style={{ color: '#e2e8f0', fontSize: 14 }}>·</span>}
          </span>

          {hasMoney && (
            <button
              onClick={e => { e.stopPropagation(); onTogglePaid() }}
              title={isPaid ? 'סמן כלא שולם' : 'סמן כשולם ✓'}
              style={{
                position: 'absolute', bottom: 3, left: 4,
                width: 13, height: 13, borderRadius: '50%',
                background: isPaid ? 'rgba(255,255,255,0.9)' : '#fff',
                border: `2px solid ${isPaid ? '#86efac' : '#93c5fd'}`,
                cursor: 'pointer', padding: 0, fontSize: 7,
                color: isPaid ? '#16a34a' : '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }}
            >
              {isPaid ? '✓' : ''}
            </button>
          )}
        </div>
      )}
    </td>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SumCard({ label, value, icon, gradient, textColor }) {
  return (
    <div style={{
      flex: '1 1 140px',
      background: gradient,
      borderRadius: 16,
      padding: '18px 20px',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,.12)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -12, right: -10, fontSize: 64, opacity: .08 }}>{icon}</div>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{value || '₪0'}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const p = usePipeline()
  const [year,        setYear]        = useState(new Date().getFullYear())
  const [editingCell, setEditingCell] = useState(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [editingLine, setEditingLine] = useState(null)
  const [newName,     setNewName]     = useState('')
  const [newType,     setNewType]     = useState('חוגים')
  const [newVat,      setNewVat]      = useState(true)
  const [hoveredRow,  setHoveredRow]  = useState(null)

  const monthly = useMemo(() => {
    return MONTHS_SHORT.map((_, i) => {
      const m = i + 1
      let gross = 0, vatBase = 0, paid = 0
      p.lines.forEach(line => {
        const e = p.getEntry(line.id, year, m)
        if (e?.amount) {
          gross   += e.amount
          if (line.hasVat) vatBase += e.amount
          if (e.isPaid)    paid    += e.amount
        }
      })
      const vat = vatBase * VAT_RATE
      return { gross, vat, net: gross - vat, paid }
    })
  }, [p.lines, p.entries, year, p.getEntry])

  const totals = useMemo(() => monthly.reduce(
    (acc, m) => ({ gross: acc.gross + m.gross, vat: acc.vat + m.vat, net: acc.net + m.net, paid: acc.paid + m.paid }),
    { gross: 0, vat: 0, net: 0, paid: 0 }
  ), [monthly])

  const lineTotal = useCallback((lineId) =>
    MONTHS_SHORT.reduce((s, _, i) => s + (p.getEntry(lineId, year, i + 1)?.amount || 0), 0),
  [p.getEntry, year])

  const handleAdd = () => {
    if (!newName.trim()) return
    p.addLine({ name: newName.trim(), type: newType, hasVat: newVat })
    setNewName(''); setShowAdd(false)
  }

  const startEdit = (lineId, month) => {
    if (editingCell?.lineId === lineId && editingCell?.month === month) return
    setEditingLine(null); setEditingCell({ lineId, month })
  }

  const saveCell = (lineId, month, amount) => {
    const e = p.getEntry(lineId, year, month)
    p.setEntry(lineId, year, month, amount, e?.isPaid || false)
    setEditingCell(null)
  }

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  return (
    <div style={{ padding: '20px 16px', fontFamily: 'Rubik, sans-serif', direction: 'rtl', minHeight: '100vh', background: 'var(--bg, #f8fafc)' }}>

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1a1060 100%)',
        borderRadius: 20,
        padding: '22px 28px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        boxShadow: '0 8px 32px rgba(15,23,42,.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decorations */}
        <div style={{ position:'absolute', top:-40, left:-40, width:160, height:160, borderRadius:'50%', background:'rgba(249,115,22,.06)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-30, left:120, width:100, height:100, borderRadius:'50%', background:'rgba(99,102,241,.08)', pointerEvents:'none' }}/>

        <div style={{ fontSize: 36, lineHeight: 1 }}>📊</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>פייפליין הכנסות</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
            תכנון ומעקב לפי לקוח · לחץ תא לעריכה · נקודה ירוקה = שולם
            {' · '}
            <span style={{
              background: p.synced ? 'rgba(74,222,128,.15)' : 'rgba(148,163,184,.1)',
              color: p.synced ? '#4ade80' : '#94a3b8',
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            }}>
              {p.synced ? '☁️ מסונכרן' : '💾 מקומי'}
            </span>
          </div>
        </div>

        {/* Year picker + Add button */}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: year === y ? '#f97316' : 'rgba(255,255,255,.1)',
              color: year === y ? '#fff' : '#94a3b8',
              fontWeight: 700, fontSize: 14, transition: 'all .15s',
              boxShadow: year === y ? '0 4px 14px rgba(249,115,22,.4)' : 'none',
            }}>{y}</button>
          ))}
          <button onClick={() => setShowAdd(v => !v)} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: showAdd ? 'rgba(255,255,255,.15)' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: showAdd ? 'none' : '0 4px 14px rgba(14,165,233,.35)',
            transition: 'all .15s',
          }}>+ הוסף שורה</button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {!p.loading && totals.gross > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <SumCard label='סה"כ ברוטו לשנה'  value={fmt(totals.gross)}              icon='💰' gradient='linear-gradient(135deg, #f97316, #ea580c)' />
          <SumCard label='מע"מ לשלם לשנה'   value={fmt(totals.vat)}                icon='🧾' gradient='linear-gradient(135deg, #ef4444, #dc2626)' />
          <SumCard label='נטו שלך לשנה'      value={fmt(totals.net)}                icon='✅' gradient='linear-gradient(135deg, #16a34a, #15803d)' />
          <SumCard label='שולם בפועל'         value={fmt(totals.paid)}               icon='🟢' gradient='linear-gradient(135deg, #0ea5e9, #0284c7)' />
          <SumCard label='נותר לגבות'         value={fmt(totals.gross - totals.paid)} icon='⏳' gradient='linear-gradient(135deg, #a855f7, #7c3aed)' />
        </div>
      )}

      {/* ── Add line form ── */}
      {showAdd && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(249,115,22,.15)',
          border: '2px solid #fed7aa',
        }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="שם לקוח / פרויקט..."
            style={{
              flex: '1 1 200px', padding: '9px 14px', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#f8fafc',
              color: '#0f172a', fontSize: 14, fontFamily: 'Rubik, sans-serif',
              outline: 'none',
            }}
          />
          <select value={newType} onChange={e => setNewType(e.target.value)} style={{
            padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#f8fafc', color: '#374151', fontSize: 13,
            fontFamily: 'Rubik, sans-serif', cursor: 'pointer',
          }}>
            {LINE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#374151', userSelect: 'none', fontWeight: 500 }}>
            <input type="checkbox" checked={newVat} onChange={e => setNewVat(e.target.checked)} style={{ accentColor: '#f97316', width: 16, height: 16 }} />
            כולל מע&quot;מ
          </label>
          <button onClick={handleAdd} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff',
            fontWeight: 700, cursor: 'pointer', fontSize: 14,
            boxShadow: '0 4px 14px rgba(249,115,22,.3)',
          }}>הוסף ✓</button>
          <button onClick={() => setShowAdd(false)} style={{
            padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            background: '#f1f5f9', color: '#64748b', cursor: 'pointer', fontSize: 13,
          }}>ביטול</button>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(15,23,42,.1)',
        overflow: 'hidden',
        marginBottom: 20,
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
                <th style={{
                  padding: '13px 18px', color: '#f1f5f9', fontWeight: 700, fontSize: 13,
                  position: 'sticky', right: 0, background: '#1e293b', zIndex: 3,
                  textAlign: 'right', whiteSpace: 'nowrap',
                  borderLeft: '3px solid #f97316',
                }}>לקוח / פרויקט</th>
                <th style={{ padding: '13px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap' }}>סוג</th>
                <th style={{ padding: '13px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>מע&quot;מ</th>
                {MONTHS_SHORT.map((m, i) => {
                  const isCurrent = year === currentYear && i + 1 === currentMonth
                  return (
                    <th key={i} style={{
                      padding: '13px 6px', fontWeight: 700, fontSize: 12, textAlign: 'center',
                      whiteSpace: 'nowrap', minWidth: 80,
                      color: isCurrent ? '#f97316' : '#94a3b8',
                      borderBottom: isCurrent ? '3px solid #f97316' : '3px solid transparent',
                    }}>{m}</th>
                  )
                })}
                <th style={{ padding: '13px 10px', color: '#f97316', fontWeight: 700, fontSize: 13, textAlign: 'center', minWidth: 90 }}>סה&quot;כ</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>

            <tbody>
              {p.loading ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontWeight: 600 }}>טוען נתונים...</div>
                  </td>
                </tr>
              ) : p.lines.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: 'center', padding: 70, color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>אין שורות עדיין</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>לחץ &quot;+ הוסף שורה&quot; להתחיל לתכנן הכנסות</div>
                  </td>
                </tr>
              ) : (
                p.lines.map((line, idx) => {
                  const lt = lineTotal(line.id)
                  const isEditingName = editingLine === line.id
                  const isHovered = hoveredRow === line.id

                  return (
                    <tr
                      key={line.id}
                      style={{
                        background: isHovered ? '#fafbff' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={() => setHoveredRow(line.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* Name */}
                      <td style={{
                        padding: '6px 14px',
                        position: 'sticky', right: 0,
                        background: isHovered ? '#fafbff' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        zIndex: 1, whiteSpace: 'nowrap',
                        borderLeft: '2px solid #f1f5f9',
                        boxShadow: '-2px 0 8px rgba(0,0,0,.04)',
                        minWidth: 160,
                      }}>
                        {isEditingName ? (
                          <input
                            autoFocus
                            defaultValue={line.name}
                            onBlur={e => { p.updateLine(line.id, { name: e.target.value.trim() || line.name }); setEditingLine(null) }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur() }}
                            style={{
                              background: '#fff', border: '2px solid #f97316', color: '#0f172a',
                              borderRadius: 8, padding: '4px 10px', fontFamily: 'Rubik, sans-serif',
                              fontSize: 13, width: '90%', outline: 'none',
                            }}
                          />
                        ) : (
                          <span
                            onDoubleClick={() => setEditingLine(line.id)}
                            title="לחץ פעמיים לעריכת שם"
                            style={{ cursor: 'text', fontSize: 13, fontWeight: 700, color: '#1e293b' }}
                          >
                            {line.name}
                          </span>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ textAlign: 'center', padding: '4px 4px' }}>
                        <select
                          value={line.type}
                          onChange={e => p.updateLine(line.id, { type: e.target.value })}
                          style={{
                            background: '#f1f5f9', border: 'none', color: '#64748b',
                            fontSize: 10, borderRadius: 8, padding: '3px 6px',
                            fontFamily: 'Rubik, sans-serif', cursor: 'pointer', maxWidth: 70,
                          }}
                        >
                          {LINE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>

                      {/* VAT toggle */}
                      <td style={{ textAlign: 'center', padding: '4px' }}>
                        <button
                          onClick={() => p.toggleVat(line.id)}
                          title={line.hasVat ? 'כולל מע"מ — לחץ להסיר' : 'ללא מע"מ — לחץ להוסיף'}
                          style={{
                            background: line.hasVat ? '#dcfce7' : '#f1f5f9',
                            border: `1.5px solid ${line.hasVat ? '#86efac' : '#e2e8f0'}`,
                            borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            padding: '3px 7px', color: line.hasVat ? '#16a34a' : '#94a3b8',
                            fontWeight: 700, lineHeight: 1.2,
                          }}
                        >
                          {line.hasVat ? '✓' : '–'}
                        </button>
                      </td>

                      {/* Month cells */}
                      {MONTHS_SHORT.map((_, i) => {
                        const month = i + 1
                        const entry = p.getEntry(line.id, year, month)
                        const isEditing = editingCell?.lineId === line.id && editingCell?.month === month
                        return (
                          <Cell
                            key={month}
                            amount={entry?.amount || 0}
                            isPaid={entry?.isPaid || false}
                            isEditing={isEditing}
                            onStartEdit={() => startEdit(line.id, month)}
                            onTogglePaid={() => p.togglePaid(line.id, year, month)}
                            onSave={amount => saveCell(line.id, month, amount)}
                          />
                        )
                      })}

                      {/* Row total */}
                      <td style={{
                        textAlign: 'center', padding: '6px 8px',
                        fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
                        color: lt > 0 ? '#f97316' : '#e2e8f0',
                      }}>
                        {lt > 0 ? fmt(lt) : ''}
                      </td>

                      {/* Delete */}
                      <td style={{ textAlign: 'center', padding: '4px' }}>
                        <button
                          onClick={() => { if (window.confirm(`מחק את "${line.name}"?`)) p.deleteLine(line.id) }}
                          title="מחק שורה"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#cbd5e1', fontSize: 18, padding: '2px 8px',
                            lineHeight: 1, borderRadius: 6, transition: 'all .1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' }}
                        >×</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* ── Footer totals ── */}
            {!p.loading && p.lines.length > 0 && (
              <tfoot>
                {/* Gross */}
                <tr style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderTop: '3px solid #e2e8f0' }}>
                  <td style={{
                    padding: '11px 16px', fontWeight: 700, color: '#e2e8f0', fontSize: 13,
                    position: 'sticky', right: 0, background: '#1e293b', zIndex: 1, whiteSpace: 'nowrap',
                  }}>סה&quot;כ ברוטו</td>
                  <td colSpan={2}></td>
                  {monthly.map((m, i) => (
                    <td key={i} style={{ padding: '11px 6px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                      {m.gross > 0 ? fmt(m.gross) : ''}
                    </td>
                  ))}
                  <td style={{ padding: '11px 8px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#f97316', whiteSpace: 'nowrap' }}>{fmt(totals.gross)}</td>
                  <td></td>
                </tr>

                {/* VAT */}
                <tr style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
                  <td style={{
                    padding: '10px 16px', fontWeight: 700, color: '#fca5a5', fontSize: 13,
                    position: 'sticky', right: 0, background: '#7f1d1d', zIndex: 1, whiteSpace: 'nowrap',
                  }}>
                    מע&quot;מ לשלם <span style={{ fontSize: 11, opacity: .8 }}>(18%)</span>
                  </td>
                  <td colSpan={2}></td>
                  {monthly.map((m, i) => (
                    <td key={i} style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#fca5a5', whiteSpace: 'nowrap' }}>
                      {m.vat > 0 ? fmt(m.vat) : ''}
                    </td>
                  ))}
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#fca5a5', whiteSpace: 'nowrap' }}>{totals.vat > 0 ? fmt(totals.vat) : ''}</td>
                  <td></td>
                </tr>

                {/* Net */}
                <tr style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)' }}>
                  <td style={{
                    padding: '12px 16px', fontWeight: 900, color: '#86efac', fontSize: 14,
                    position: 'sticky', right: 0, background: '#14532d', zIndex: 1, whiteSpace: 'nowrap',
                  }}>
                    💚 נטו שלך
                  </td>
                  <td colSpan={2}></td>
                  {monthly.map((m, i) => (
                    <td key={i} style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#86efac', whiteSpace: 'nowrap' }}>
                      {m.net > 0 ? fmt(m.net) : ''}
                    </td>
                  ))}
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, fontSize: 16, color: '#4ade80', whiteSpace: 'nowrap' }}>{fmt(totals.net)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 20, fontSize: 12, color: '#64748b',
        flexWrap: 'wrap', alignItems: 'center',
        background: '#fff', borderRadius: 12, padding: '12px 18px',
        boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #f1f5f9',
      }}>
        <span>💡 <b style={{ color: '#374151' }}>לחץ תא</b> — הזן סכום</span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }}/>
        <span>🟢 <b style={{ color: '#374151' }}>נקודה ירוקה</b> — סמן כשולם</span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }}/>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(135deg,#16a34a,#15803d)' }}/>
          <b style={{ color: '#374151' }}>ירוק</b> = שולם
        </span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }}/>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' }}/>
          <b style={{ color: '#374151' }}>כחול</b> = ממתין לתשלום
        </span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0', display: 'inline-block' }}/>
        <span>✏️ <b style={{ color: '#374151' }}>לחץ פעמיים על שם</b> — ערוך</span>
      </div>
    </div>
  )
}
