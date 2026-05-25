import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePipeline } from '../../hooks/usePipeline'

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ']
const MONTHS_FULL  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const LINE_TYPES   = ['חוגים','קורסים','הפקת סרטונים','קייסנות','סרטונים','שונות']
const VAT_RATE     = 18 / 118   // portion of a VAT-inclusive price that is VAT

const fmt = n => n > 0
  ? '₪' + Math.round(n).toLocaleString('he-IL')
  : ''

// ─── Cell Component ───────────────────────────────────────────────────────────
function Cell({ amount, isPaid, isEditing, onStartEdit, onTogglePaid, onSave, month }) {
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

  return (
    <td
      style={{
        padding: 0,
        minWidth: 76,
        height: 38,
        background: isPaid ? '#15803d' : hasMoney ? '#0f2b1a' : 'transparent',
        border: '1px solid #1e293b',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .12s',
        verticalAlign: 'middle',
      }}
    >
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
            background: '#0f172a', border: '2px solid #f97316',
            color: '#f1f5f9', textAlign: 'center',
            fontSize: 12, fontFamily: 'Rubik, sans-serif',
            padding: '0 2px', outline: 'none',
          }}
        />
      ) : (
        <div
          onClick={onStartEdit}
          style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        >
          <span style={{
            color: isPaid ? '#bbf7d0' : hasMoney ? '#4ade80' : '#1e3a5f',
            fontSize: 12, fontWeight: hasMoney ? 700 : 400,
          }}>
            {hasMoney ? fmt(amount) : <span style={{ fontSize: 16, color: '#1e293b' }}>·</span>}
          </span>

          {/* Paid toggle dot */}
          {hasMoney && (
            <button
              onClick={e => { e.stopPropagation(); onTogglePaid() }}
              title={isPaid ? 'סמן כלא שולם' : 'סמן כשולם ✓'}
              style={{
                position: 'absolute', bottom: 3, left: 4,
                width: 12, height: 12, borderRadius: '50%',
                background: isPaid ? '#4ade80' : '#1e3a4f',
                border: `1.5px solid ${isPaid ? '#22c55e' : '#334155'}`,
                cursor: 'pointer', padding: 0, fontSize: 7,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const p = usePipeline()
  const [year,        setYear]        = useState(new Date().getFullYear())
  const [editingCell, setEditingCell] = useState(null) // { lineId, month }
  const [showAdd,     setShowAdd]     = useState(false)
  const [editingLine, setEditingLine] = useState(null) // lineId being renamed
  const [newName,     setNewName]     = useState('')
  const [newType,     setNewType]     = useState('חוגים')
  const [newVat,      setNewVat]      = useState(true)

  // ── Monthly computed totals ──────────────────────
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
    (acc, m) => ({
      gross: acc.gross + m.gross,
      vat:   acc.vat   + m.vat,
      net:   acc.net   + m.net,
      paid:  acc.paid  + m.paid,
    }),
    { gross: 0, vat: 0, net: 0, paid: 0 }
  ), [monthly])

  const lineTotal = useCallback((lineId) =>
    MONTHS_SHORT.reduce((s, _, i) => {
      const e = p.getEntry(lineId, year, i + 1)
      return s + (e?.amount || 0)
    }, 0),
  [p.getEntry, year])

  // ── Add line ────────────────────────────────────
  const handleAdd = () => {
    if (!newName.trim()) return
    p.addLine({ name: newName.trim(), type: newType, hasVat: newVat })
    setNewName(''); setShowAdd(false)
  }

  // ── Cell edit ───────────────────────────────────
  const startEdit = (lineId, month) => {
    if (editingCell?.lineId === lineId && editingCell?.month === month) return
    setEditingLine(null)
    setEditingCell({ lineId, month })
  }

  const saveCell = (lineId, month, amount) => {
    const e = p.getEntry(lineId, year, month)
    p.setEntry(lineId, year, month, amount, e?.isPaid || false)
    setEditingCell(null)
  }

  // ─── Styles ──────────────────────────────────────
  const S = {
    page:    { padding: '16px 12px', fontFamily: 'Rubik, sans-serif', direction: 'rtl', color: '#f1f5f9', minHeight: '100vh' },
    header:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
    card:    { background: '#1e293b', borderRadius: 12, padding: '14px 18px', flex: '1 1 130px', textAlign: 'center' },
    th:      { padding: '10px 6px', borderBottom: '2px solid #f97316', color: '#94a3b8', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' },
    thStick: { padding: '10px 14px', borderBottom: '2px solid #f97316', color: '#e2e8f0', fontWeight: 700, fontSize: 13,
               position: 'sticky', right: 0, background: '#0f172a', zIndex: 3, textAlign: 'right' },
    tdStick: { padding: '6px 12px', position: 'sticky', right: 0, background: '#0f172a', zIndex: 1, whiteSpace: 'nowrap' },
    footTd:  { padding: '8px 6px', textAlign: 'center', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },
  }

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <span style={{ fontSize: 26 }}>📊</span>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>פייפליין הכנסות</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            תכנון ומעקב לפי לקוח · לחץ תא לעריכה · נקודה ירוקה = שולם
            {' · '}
            <span style={{ color: p.synced ? '#4ade80' : '#94a3b8' }}>
              {p.synced ? '☁️ מסונכרן' : '💾 מקומי'}
            </span>
          </div>
        </div>

        {/* Year picker */}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: year === y ? '#f97316' : '#1e293b',
              color: year === y ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 13,
            }}>{y}</button>
          ))}
          <button onClick={() => setShowAdd(v => !v)} style={{
            padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: showAdd ? '#475569' : '#0ea5e9', color: '#fff', fontWeight: 700, fontSize: 13,
          }}>+ הוסף שורה</button>
        </div>
      </div>

      {/* ── Add line form ── */}
      {showAdd && (
        <div style={{
          background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 14,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          border: '1px solid #f97316',
        }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="שם לקוח / פרויקט..."
            style={{
              flex: '1 1 200px', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #334155', background: '#0f172a',
              color: '#f1f5f9', fontSize: 14, fontFamily: 'Rubik, sans-serif',
            }}
          />
          <select value={newType} onChange={e => setNewType(e.target.value)} style={{
            padding: '8px 10px', borderRadius: 8, border: '1px solid #334155',
            background: '#0f172a', color: '#f1f5f9', fontSize: 13, fontFamily: 'Rubik, sans-serif',
          }}>
            {LINE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#94a3b8', userSelect: 'none' }}>
            <input type="checkbox" checked={newVat} onChange={e => setNewVat(e.target.checked)} style={{ accentColor: '#f97316' }} />
            כולל מע&quot;מ
          </label>
          <button onClick={handleAdd} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: '#f97316', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>הוסף ✓</button>
          <button onClick={() => setShowAdd(false)} style={{
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: '#334155', color: '#94a3b8', cursor: 'pointer',
          }}>ביטול</button>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #1e293b', marginBottom: 20 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              <th style={S.thStick}>לקוח / פרויקט</th>
              <th style={{ ...S.th, width: 70 }}>סוג</th>
              <th style={{ ...S.th, width: 52 }}>מע&quot;מ</th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} style={{ ...S.th, minWidth: 76 }}>{m}</th>
              ))}
              <th style={{ ...S.th, minWidth: 88, color: '#f97316' }}>סה&quot;כ</th>
              <th style={{ ...S.th, width: 36 }}></th>
            </tr>
          </thead>

          <tbody>
            {p.loading ? (
              <tr>
                <td colSpan={17} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
                  <div style={{ fontSize: 22 }}>⏳</div>
                  <div>טוען נתונים...</div>
                </td>
              </tr>
            ) : p.lines.length === 0 ? (
              <tr>
                <td colSpan={17} style={{ textAlign: 'center', padding: 48, color: '#475569' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>אין שורות עדיין</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>לחץ &quot;+ הוסף שורה&quot; להתחיל</div>
                </td>
              </tr>
            ) : (
              p.lines.map((line, idx) => {
                const lt = lineTotal(line.id)
                const isEditingName = editingLine === line.id

                return (
                  <tr key={line.id}
                    style={{ borderBottom: '1px solid #1e293b', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Name */}
                    <td style={S.tdStick}>
                      {isEditingName ? (
                        <input
                          autoFocus
                          defaultValue={line.name}
                          onBlur={e => { p.updateLine(line.id, { name: e.target.value.trim() || line.name }); setEditingLine(null) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur() }}
                          style={{
                            background: '#0f172a', border: '1px solid #f97316', color: '#f1f5f9',
                            borderRadius: 6, padding: '3px 8px', fontFamily: 'Rubik, sans-serif',
                            fontSize: 13, width: '90%',
                          }}
                        />
                      ) : (
                        <span
                          onDoubleClick={() => setEditingLine(line.id)}
                          title="לחץ פעמיים לעריכת שם"
                          style={{ cursor: 'text', fontSize: 13, fontWeight: 600 }}
                        >
                          {line.name}
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td style={{ textAlign: 'center', padding: '4px 2px' }}>
                      <select
                        value={line.type}
                        onChange={e => p.updateLine(line.id, { type: e.target.value })}
                        style={{
                          background: '#1e293b', border: 'none', color: '#64748b',
                          fontSize: 10, borderRadius: 8, padding: '2px 4px',
                          fontFamily: 'Rubik, sans-serif', cursor: 'pointer', maxWidth: 64,
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
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}
                      >
                        {line.hasVat ? '✅' : '⬜'}
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
                          month={month}
                        />
                      )
                    })}

                    {/* Row total */}
                    <td style={{ textAlign: 'center', padding: '6px 6px', color: lt > 0 ? '#f97316' : '#1e3a5f', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {lt > 0 ? fmt(lt) : ''}
                    </td>

                    {/* Delete */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => { if (window.confirm(`מחק את "${line.name}"?`)) p.deleteLine(line.id) }}
                        title="מחק שורה"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}
                      >
                        ×
                      </button>
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
              <tr style={{ background: '#0f172a', borderTop: '2px solid #334155' }}>
                <td style={{ ...S.tdStick, fontWeight: 700, color: '#94a3b8', background: '#0f172a', padding: '9px 12px' }}>סה&quot;כ ברוטו</td>
                <td colSpan={2}></td>
                {monthly.map((m, i) => (
                  <td key={i} style={{ ...S.footTd, color: '#f1f5f9' }}>{m.gross > 0 ? fmt(m.gross) : ''}</td>
                ))}
                <td style={{ ...S.footTd, color: '#f97316', fontSize: 14 }}>{fmt(totals.gross)}</td>
                <td></td>
              </tr>

              {/* VAT */}
              <tr style={{ background: '#160a0a' }}>
                <td style={{ ...S.tdStick, fontWeight: 600, color: '#f87171', background: '#160a0a', padding: '8px 12px' }}>
                  מע&quot;מ לשלם <span style={{ fontSize: 11, color: '#ef4444' }}>(18%)</span>
                </td>
                <td colSpan={2}></td>
                {monthly.map((m, i) => (
                  <td key={i} style={{ ...S.footTd, color: '#f87171' }}>{m.vat > 0 ? fmt(m.vat) : ''}</td>
                ))}
                <td style={{ ...S.footTd, color: '#f87171', fontSize: 14 }}>{totals.vat > 0 ? fmt(totals.vat) : ''}</td>
                <td></td>
              </tr>

              {/* Net */}
              <tr style={{ background: '#071a0f' }}>
                <td style={{ ...S.tdStick, fontWeight: 800, color: '#4ade80', background: '#071a0f', padding: '10px 12px' }}>
                  💚 נטו שלך
                </td>
                <td colSpan={2}></td>
                {monthly.map((m, i) => (
                  <td key={i} style={{ ...S.footTd, color: '#4ade80', fontSize: 13 }}>{m.net > 0 ? fmt(m.net) : ''}</td>
                ))}
                <td style={{ ...S.footTd, color: '#4ade80', fontSize: 15 }}>{fmt(totals.net)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Summary cards ── */}
      {!p.loading && totals.gross > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'סה"כ ברוטו לשנה',   value: fmt(totals.gross), color: '#f1f5f9', icon: '💰' },
            { label: 'מע"מ לשלם לשנה',    value: fmt(totals.vat),   color: '#f87171', icon: '🧾' },
            { label: 'נטו שלך לשנה',       value: fmt(totals.net),   color: '#4ade80', icon: '✅' },
            { label: 'שולם בפועל עד כה',   value: fmt(totals.paid),  color: '#f97316', icon: '🟢' },
            { label: 'נותר לגבות',         value: fmt(totals.gross - totals.paid), color: '#fbbf24', icon: '⏳' },
          ].map(c => (
            <div key={c.label} style={{ ...S.card, minWidth: 140 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 11, color: '#475569', flexWrap: 'wrap' }}>
        <span>💡 <b>לחץ תא</b> — הזן סכום</span>
        <span>🟢 <b>נקודה ירוקה</b> — סמן כשולם</span>
        <span>✅ <b>מע&quot;מ</b> — לחץ לשנות</span>
        <span>✏️ <b>לחץ פעמיים על שם</b> — ערוך</span>
      </div>
    </div>
  )
}
