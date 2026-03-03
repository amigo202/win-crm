import { useState, useMemo } from 'react'
import { fmtShekel } from '../../utils/format'
import { toast_ok, toast_err } from '../Toast'

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

// ── Inline styles (matching ClassesPage) ────────────────────────────────────
const INP = { padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', direction:'rtl', width:'100%', boxSizing:'border-box', background:'var(--bg)', color:'var(--text)' }
const LBL = { display:'block', fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:4 }
const GRP = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }

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
  const close = () => { setShowModal(false); setEditId(null); setForm(emptyActivity()); setFormError('') }

  const handleContactChange = e => {
    const cid = e.target.value
    const c = contacts.find(x => x.id === cid)
    setForm(f => ({ ...f, contactId: cid, contactName: c?.name || '' }))
  }

  const [formError, setFormError] = useState('')

  const save = async () => {
    if (!form.name.trim()) { setFormError('נא למלא שם פעילות'); return }
    setFormError('')
    try {
      if (editId) { await onUpdate(editId, form); toast_ok('הפעילות עודכנה') }
      else        { await onAdd(form); toast_ok('פעילות נוספה') }
      close()
    } catch (e) { toast_err('שגיאה: ' + e.message) }
  }

  const handleDelete = async id => {
    if (!window.confirm('למחוק פעילות?')) return
    try { await onDelete(id); toast_ok('הפעילות נמחקה') } catch (e) { toast_err('שגיאה: ' + e.message) }
  }

  const getTypeMeta = id => BIZ_ACT_TYPES.find(t => t.id === id) || BIZ_ACT_TYPES[5]
  const getPayMeta  = id => PAY_STATUSES.find(s => s.id === id)  || PAY_STATUSES[0]

  const profitCalc = Number(form.income || 0) - Number(form.expenses || 0)

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="ph">
        <h2>פעילויות</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-p" onClick={openNew} aria-label="הוסף פעילות חדשה">+ פעילות חדשה</button>
        </div>
      </div>

      <div className="pb">
        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div className="stats-grid">
          {[
            { label: 'הכנסות', val: fmtShekel(totals.income),   color: '#10b981', bg: '#d1fae5', icon: '💰' },
            { label: 'הוצאות', val: fmtShekel(totals.expenses),  color: '#ef4444', bg: '#fee2e2', icon: '📉' },
            { label: 'רווח',   val: fmtShekel(totals.profit),    color: totals.profit >= 0 ? '#3b82f6' : '#ef4444', bg: totals.profit >= 0 ? '#dbeafe' : '#fee2e2', icon: '📊' },
          ].map((k, i) => (
            <div key={i} className="stat-card" style={{ background: k.bg, border: `1px solid ${k.color}22` }}>
              <div className="sh">
                <span style={{ fontSize: 24 }}>{k.icon}</span>
                <span className="sv" style={{ color: k.color }}>{k.val}</span>
              </div>
              <div className="sl" style={{ color: k.color }}>{k.label}</div>
              <div className="ss" style={{ color: k.color, opacity: .6 }}>{filtered.length} פעילויות</div>
            </div>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────── */}
        <div className="filter-bar" style={{ border: 'none', padding: '0 0 16px' }}>
          <input className="si-input" placeholder="🔍 חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 200 }} aria-label="חיפוש פעילויות" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 13 }}>
            <option value="all">כל הסוגים</option>
            {BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ fontSize: 13 }}>
            {[CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 'auto' }}>{filtered.length} תוצאות</span>
        </div>

        {/* ── Table ────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>אין פעילויות עדיין</p>
            <button className="btn btn-p" onClick={openNew} style={{ marginTop: 12 }}>+ הוסף פעילות ראשונה</button>
          </div>
        ) : (
          <div className="card tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>סוג</th>
                  <th>שם פעילות</th>
                  <th>לקוח</th>
                  <th>חודש</th>
                  <th>הכנסה</th>
                  <th>הוצאות</th>
                  <th>רווח</th>
                  <th>תשלום</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const tm = getTypeMeta(a.activityType)
                  const pm = getPayMeta(a.paymentStatus)
                  const profit = a.income - a.expenses
                  return (
                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(a)}>
                      <td>
                        <span className="badge" style={{ background: tm.color + '18', color: tm.color }}>
                          {tm.icon} {tm.label}
                        </span>
                      </td>
                      <td><strong>{a.name}</strong></td>
                      <td>{a.contactName || '—'}</td>
                      <td>{a.month ? MONTHS_HE[a.month - 1] + ' ' + a.year : '—'}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>₪{fmt(a.income)}</td>
                      <td style={{ color: '#ef4444' }}>{a.expenses ? '₪' + fmt(a.expenses) : '—'}</td>
                      <td style={{ fontWeight: 700, color: profit >= 0 ? '#10b981' : '#ef4444' }}>₪{fmt(profit)}</td>
                      <td>
                        <span className="badge" style={{ background: pm.bg, color: pm.color }}>
                          {pm.label}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(a.id)} title="מחק" aria-label={`מחק ${a.name}`}>✕</button>
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
          <div className="modal modal-lg" style={{ direction:'rtl' }}>
            <div className="mh">
              <h3>{editId ? 'עריכת פעילות' : 'פעילות חדשה'}</h3>
              <button className="mx" onClick={close} aria-label="סגור">×</button>
            </div>
            <div className="mb" style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              {formError && <div role="alert" style={{ background:'#fee2e2', color:'#dc2626', padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:600 }}>✕ {formError}</div>}
              {/* ── Section: פרטי פעילות ── */}
              <div style={{ borderBottom:'2px solid var(--accent)', paddingBottom:6, fontSize:13, fontWeight:700, color:'var(--accent)' }}>📋 פרטי פעילות</div>
              <div style={GRP}>
                <div style={{ gridColumn:'1/-1' }}><label style={LBL}>שם הפעילות *</label><input aria-required="true" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError('') }} placeholder='למשל: "אירוע PIXMIX חנוכה"' style={{ ...INP, borderColor: formError && !form.name.trim() ? '#ef4444' : undefined }}/></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>סוג</label><select value={form.activityType} onChange={e => setForm(f => ({ ...f, activityType: e.target.value }))} style={INP}>{BIZ_ACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}</select></div>
                <div><label style={LBL}>לקוח</label><select value={form.contactId} onChange={handleContactChange} style={INP}><option value="">— ללא —</option>{(contacts || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>תאריך פעילות</label><input type="date" value={form.activityDate} onChange={e => setForm(f => ({ ...f, activityDate: e.target.value }))} style={INP}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div><label style={LBL}>חודש</label><select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))} style={INP}>{MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
                  <div><label style={LBL}>שנה</label><select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} style={INP}>{[CUR_YEAR, CUR_YEAR - 1, CUR_YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                </div>
              </div>
              {/* ── Section: הכנסות והוצאות ── */}
              <div style={{ borderBottom:'2px solid #f97316', paddingBottom:6, fontSize:13, fontWeight:700, color:'#f97316' }}>💰 הכנסות והוצאות</div>
              <div style={GRP}>
                <div><label style={LBL}>הכנסה (₪)</label><input type="number" value={form.income} onChange={e => setForm(f => ({ ...f, income: e.target.value }))} placeholder="0" style={INP}/></div>
                <div><label style={LBL}>הוצאות (₪)</label><input type="number" value={form.expenses} onChange={e => setForm(f => ({ ...f, expenses: e.target.value }))} placeholder="0" style={INP}/></div>
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:12, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>רווח צפוי:</span>
                <span style={{ fontSize:20, fontWeight:800, color: profitCalc >= 0 ? '#10b981' : '#ef4444' }}>{fmtShekel(profitCalc)}</span>
              </div>
              {/* ── Section: פרטי תשלום ── */}
              <div style={{ borderBottom:'2px solid #3b82f6', paddingBottom:6, fontSize:13, fontWeight:700, color:'#3b82f6' }}>🏦 פרטי תשלום</div>
              <div style={GRP}>
                <div><label style={LBL}>סטטוס תשלום</label><select value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))} style={INP}>{PAY_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                <div><label style={LBL}>אמצעי תשלום</label><select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} style={INP}><option value="">—</option>{PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              </div>
              <div style={GRP}>
                <div><label style={LBL}>תאריך תשלום</label><input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} style={INP}/></div>
                <div><label style={LBL}>מס׳ חשבונית</label><input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} style={INP}/></div>
              </div>
              <div><label style={LBL}>הערות</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...INP, resize:'vertical' }}/></div>
              <div className="mf">
                <button className="btn btn-p" onClick={save} aria-label={editId ? 'שמור שינויים' : 'הוסף פעילות'}>{editId ? 'שמור' : 'הוסף'}</button>
                <button className="btn btn-o" onClick={close} aria-label="ביטול">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
