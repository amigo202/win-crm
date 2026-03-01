import { useState, useMemo } from 'react'
import { fmtShekel } from '../../utils/format'

// ── Constants ────────────────────────────────────────────────────────────────
const BIZ_ACT_TYPES = [
  { id: 'pixmix',     label: 'PIXMIX',       icon: '🎨', color: '#8b5cf6' },
  { id: 'video',      label: 'סרטון',         icon: '🎬', color: '#ef4444' },
  { id: 'content',    label: 'תוכן',          icon: '📝', color: '#3b82f6' },
  { id: 'lecture',    label: 'הרצאה',         icon: '🎤', color: '#f59e0b' },
  { id: 'consulting', label: 'ייעוץ',         icon: '💡', color: '#10b981' },
  { id: 'other',      label: 'אחר',           icon: '📦', color: '#64748b' },
]
const PAY_STATUSES = [
  { id: 'pending', label: 'ממתין',  color: '#f59e0b', bg: '#fef3c7' },
  { id: 'paid',    label: 'שולם',   color: '#10b981', bg: '#d1fae5' },
  { id: 'partial', label: 'חלקי',   color: '#f97316', bg: '#ffedd5' },
  { id: 'overdue', label: 'באיחור', color: '#ef4444', bg: '#fee2e2' },
]
const PAY_METHODS = ['מזומן','שיק','העברה','כרטיס אשראי','ביט','פייבוקס','אחר']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

const now = new Date()
const CUR_YEAR  = now.getFullYear()
const CUR_MONTH = now.getMonth() + 1

function fmt(n) { return Number(n || 0).toLocaleString('he-IL') }

function emptyActivity() {
  return {
    name: '', activityType: 'pixmix', contactId: '', contactName: '',
    activityDate: '', month: CUR_MONTH, year: CUR_YEAR,
    income: '', expenses: '',
    paymentStatus: 'pending', paymentDate: '', paymentMethod: '', invoiceNumber: '',
    notes: '',
  }
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ActivitiesPage({ activities, contacts, onAdd, onUpdate, onDelete, onReload }) {
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(emptyActivity())
  const [filterType, setFilterType] = useState('all')
  const [filterYear, setFilterYear] = useState(CUR_YEAR)
  const [search, setSearch]       = useState('')

  // ── Filtered list ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = activities || []
    if (filterType !== 'all') list = list.filter(a => a.activityType === filterType)
    if (filterYear) list = list.filter(a => a.year === filterYear)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.contactName || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [activities, filterType, filterYear, search])

  // ── Totals ────────────────────────────────────────────────
  const totals = useMemo(() => {
    const inc  = filtered.reduce((s, a) => s + a.income, 0)
    const exp  = filtered.reduce((s, a) => s + a.expenses, 0)
    return { income: inc, expenses: exp, profit: inc - exp }
  }, [filtered])

  // ── Form handling ─────────────────────────────────────────
  const openNew = () => { setEditId(null); setForm(emptyActivity()); setShowModal(true) }
  const openEdit = a => {
    setEditId(a.id)
    setForm({
      name: a.name, activityType: a.activityType, contactId: a.contactId || '',
      contactName: a.contactName || '', activityDate: a.activityDate || '',
      month: a.month || CUR_MONTH, year: a.year || CUR_YEAR,
      income: a.income || '', expenses: a.expenses || '',
      paymentStatus: a.paymentStatus || 'pending', paymentDate: a.paymentDate || '',
      paymentMethod: a.paymentMethod || '', invoiceNumber: a.invoiceNumber || '',
      notes: a.notes || '',
    })
    setShowModal(true)
  }
  const close = () => { setShowModal(false); setEditId(null) }

  const handleContactChange = e => {
    const cid = e.target.value
    const c = contacts.find(x => x.id === cid)
    setForm(f => ({ ...f, contactId: cid, contactName: c?.name || '' }))
  }

  const save = async () => {
    if (!form.name.trim()) return alert('נא למלא שם פעילות')
    try {
      if (editId) await onUpdate(editId, form)
      else        await onAdd(form)
      close()
    } catch (e) { alert('שגיאה: ' + e.message) }
  }

  const handleDelete = async id => {
    if (!confirm('למחוק פעילות?')) return
    try { await onDelete(id) } catch (e) { alert('שגיאה: ' + e.message) }
  }

  const getTypeMeta = id => BIZ_ACT_TYPES.find(t => t.id === id) || BIZ_ACT_TYPES[5]
  const getPayMeta  = id => PAY_STATUSES.find(s => s.id === id)  || PAY_STATUSES[0]

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="ph">
        <h2>פעילויות</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openNew}>+ פעילות חדשה</button>
        </div>
      </div>

      <div className="pb">
        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'הכנסות', val: fmtShekel(totals.income),   color: '#10b981', bg: '#d1fae5', icon: '💰' },
            { label: 'הוצאות', val: fmtShekel(totals.expenses),  color: '#ef4444', bg: '#fee2e2', icon: '📉' },
            { label: 'רווח',   val: fmtShekel(totals.profit),    color: totals.profit >= 0 ? '#3b82f6' : '#ef4444', bg: totals.profit >= 0 ? '#dbeafe' : '#fee2e2', icon: '📊' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, borderRadius: 12, padding: '16px 18px', border: `1px solid ${k.color}22` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24 }}>{k.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: k.color, marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: k.color, opacity: .6 }}>{filtered.length} פעילויות</div>
            </div>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="🔍 חיפוש..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', fontSize: 13, width: 180 }}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', fontSize: 13 }}>
            <option value="all">כל הסוגים</option>
            {BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', fontSize: 13 }}>
            {[CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 'auto' }}>{filtered.length} תוצאות</span>
        </div>

        {/* ── Table ────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>אין פעילויות עדיין</p>
            <button className="btn btn-primary" onClick={openNew} style={{ marginTop: 12 }}>+ הוסף פעילות ראשונה</button>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'right' }}>
                  <th style={thStyle}>סוג</th>
                  <th style={thStyle}>שם פעילות</th>
                  <th style={thStyle}>לקוח</th>
                  <th style={thStyle}>חודש</th>
                  <th style={thStyle}>הכנסה</th>
                  <th style={thStyle}>הוצאות</th>
                  <th style={thStyle}>רווח</th>
                  <th style={thStyle}>תשלום</th>
                  <th style={{ ...thStyle, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const tm = getTypeMeta(a.activityType)
                  const pm = getPayMeta(a.paymentStatus)
                  const profit = a.income - a.expenses
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => openEdit(a)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: tm.color + '18', color: tm.color, fontSize: 12, fontWeight: 600 }}>
                          {tm.icon} {tm.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{a.name}</td>
                      <td style={tdStyle}>{a.contactName || '—'}</td>
                      <td style={tdStyle}>{a.month ? MONTHS_HE[a.month - 1] + ' ' + a.year : '—'}</td>
                      <td style={{ ...tdStyle, color: '#10b981', fontWeight: 600 }}>₪{fmt(a.income)}</td>
                      <td style={{ ...tdStyle, color: '#ef4444' }}>{a.expenses ? '₪' + fmt(a.expenses) : '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: profit >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(profit)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: pm.bg, color: pm.color, fontWeight: 600 }}>
                          {pm.label}
                        </span>
                      </td>
                      <td style={tdStyle} onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDelete(a.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 15, padding: '2px 6px', borderRadius: 4 }}
                          title="מחק">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, direction: 'rtl' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editId ? 'עריכת פעילות' : 'פעילות חדשה'}</h3>
              <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)', display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
              {/* Name */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>שם הפעילות *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder='למשל: "אירוע PIXMIX חנוכה"' style={inp} />
              </div>

              {/* Type + Client */}
              <div>
                <label style={lbl}>סוג</label>
                <select value={form.activityType} onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))} style={inp}>
                  {BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>לקוח</label>
                <select value={form.contactId} onChange={handleContactChange} style={inp}>
                  <option value="">— ללא —</option>
                  {(contacts || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Date + Period */}
              <div>
                <label style={lbl}>תאריך פעילות</label>
                <input type="date" value={form.activityDate} onChange={e => setForm(f => ({ ...f, activityDate: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>חודש</label>
                  <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))} style={inp}>
                    {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>שנה</label>
                  <select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} style={inp}>
                    {[CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Financials */}
              <div>
                <label style={lbl}>הכנסה (₪)</label>
                <input type="number" value={form.income} onChange={e => setForm(f => ({ ...f, income: e.target.value }))}
                  placeholder="0" style={inp} />
              </div>
              <div>
                <label style={lbl}>הוצאות (₪)</label>
                <input type="number" value={form.expenses} onChange={e => setForm(f => ({ ...f, expenses: e.target.value }))}
                  placeholder="0" style={inp} />
              </div>

              {/* Profit */}
              <div style={{ gridColumn: '1/-1', background: (Number(form.income||0) - Number(form.expenses||0)) >= 0 ? '#d1fae522' : '#fee2e222', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>רווח צפוי:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: (Number(form.income || 0) - Number(form.expenses || 0)) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtShekel(Number(form.income || 0) - Number(form.expenses || 0))}
                </span>
              </div>

              {/* Payment */}
              <div>
                <label style={lbl}>סטטוס תשלום</label>
                <select value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))} style={inp}>
                  {PAY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>אמצעי תשלום</label>
                <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={inp}>
                  <option value="">—</option>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>תאריך תשלום</label>
                <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>מס׳ חשבונית</label>
                <input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} style={inp} />
              </div>

              {/* Notes */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>הערות</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10, padding: '16px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
              <button className="btn btn-primary" onClick={save}>{editId ? 'שמור' : 'הוסף'}</button>
              <button className="btn" onClick={close}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const thStyle = { padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 12px', whiteSpace: 'nowrap' }
const lbl     = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }
const inp     = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' }
