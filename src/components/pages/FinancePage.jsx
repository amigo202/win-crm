import { useState, useEffect } from 'react'
import { PROGRAMS, PAY_STATUS } from '../../constants'
import { fmtShekel } from '../../utils/format'
import { monthlyPay } from '../../utils/alerts'
import { Ico } from '../icons/Ico'

const MONTHS = [
  { v: 1, l: 'ינואר' }, { v: 2, l: 'פברואר' }, { v: 3, l: 'מרץ' },
  { v: 4, l: 'אפריל' }, { v: 5, l: 'מאי' }, { v: 6, l: 'יוני' },
  { v: 7, l: 'יולי' }, { v: 8, l: 'אוגוסט' }, { v: 9, l: 'ספטמבר' },
  { v: 10, l: 'אוקטובר' }, { v: 11, l: 'נובמבר' }, { v: 12, l: 'דצמבר' },
]

const CY = new Date().getFullYear()
const YEARS = [CY - 2, CY - 1, CY, CY + 1, CY + 2]

// ── PaymentModal (defined OUTSIDE FinancePage to avoid React remount on every render) ──
function PaymentModal({ data, fin, contacts, instructors, onClose }) {
  const isE = !!data
  const [form, setForm]     = useState(() => data
    ? { ...data }
    : { contactId: '', instructorId: '', amount: '', month: fin.month, year: fin.year, status: 'pending', program: '', notes: '' }
  )
  const [saveErr, setSaveErr] = useState(null)
  const [saving,  setSaving]  = useState(false)

  const f         = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const amountNum = Number(form.amount)
  const isValid   = amountNum > 0

  const save = async () => {
    if (!isValid || saving) return
    setSaveErr(null)
    setSaving(true)

    const payload = {
      contactId:    form.contactId    || null,
      instructorId: form.instructorId || null,
      amount:       amountNum,
      month:        Number(form.month),
      year:         Number(form.year),
      status:       form.status       || 'pending',
      program:      form.program      || null,
      notes:        form.notes        || null,
    }
    console.log('[PaymentModal] saving payload:', payload)

    try {
      isE ? await fin.editPayment(data.id, payload) : await fin.addPayment(payload)
      onClose()
    } catch (e) {
      console.error('[PaymentModal] save error:', e)
      setSaveErr(e?.message ?? 'שגיאה בשמירה — ראה Console לפרטים')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="mh">
          <h3>{isE ? 'עריכת תשלום' : 'תשלום חדש'}</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          <div className="fg">
            <div className="frow full">
              <label>איש קשר</label>
              <select value={form.contactId} onChange={f('contactId')}>
                <option value="">בחר איש קשר</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="frow full">
              <label>תוכנית</label>
              <select value={form.program} onChange={f('program')}>
                <option value="">בחר תוכנית</option>
                {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="frow full">
              <label>מדריך</label>
              <select value={form.instructorId} onChange={f('instructorId')}>
                <option value="">בחר מדריך</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="frow">
              <label>סכום (₪) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={f('amount')}
                placeholder="0"
                min="0"
                style={!isValid && form.amount !== '' ? { borderColor: 'var(--danger)' } : {}}
              />
              {!isValid && form.amount !== '' && (
                <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2 }}>הסכום חייב להיות גדול מ-0</span>
              )}
              {!isValid && form.amount === '' && (
                <span style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>שדה חובה</span>
              )}
            </div>
            <div className="frow">
              <label>סטטוס</label>
              <select value={form.status} onChange={f('status')}>
                {PAY_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="frow">
              <label>חודש</label>
              <select value={form.month} onChange={f('month')}>
                {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <div className="frow">
              <label>שנה</label>
              <select value={form.year} onChange={f('year')}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="frow full">
              <label>הערות</label>
              <input value={form.notes || ''} onChange={f('notes')} placeholder="הערות..."/>
            </div>
          </div>

          {saveErr && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 7, fontSize: 13, direction: 'rtl' }}>
              ⚠️ {saveErr}
            </div>
          )}
        </div>
        <div className="mf">
          <button
            className="btn btn-p"
            onClick={save}
            disabled={!isValid || saving}
            style={{ opacity: !isValid || saving ? 0.5 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'שומר...' : isE ? 'שמור' : 'הוסף'}
          </button>
          <button className="btn btn-o" onClick={onClose} disabled={saving}>ביטול</button>
          {isE && <button className="del-link" disabled={saving} onClick={async () => { if (window.confirm('למחוק תשלום זה?')) { await fin.removePayment(data.id); onClose() } }}>מחק</button>}
        </div>
      </div>
    </div>
  )
}

// ── SalaryModal (defined OUTSIDE FinancePage) ──────────────────────────────
function SalaryModal({ data, fin, instructors, onClose }) {
  const isE = !!data
  const [form, setForm]     = useState(() => data
    ? { ...data }
    : { instructorId: '', month: fin.month, year: fin.year, baseSalary: '', additions: 0, deductions: 0, tax: 0, nationalInsurance: 0, healthInsurance: 0, notes: '' }
  )
  const [saveErr, setSaveErr] = useState(null)
  const [saving,  setSaving]  = useState(false)

  const f            = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const selectedInst = instructors.find(i => i.id === form.instructorId)
  const suggested    = selectedInst ? monthlyPay(selectedInst) : 0
  const net          = (Number(form.baseSalary) || 0) + (Number(form.additions) || 0)
                     - (Number(form.deductions) || 0) - (Number(form.tax) || 0)
                     - (Number(form.nationalInsurance) || 0) - (Number(form.healthInsurance) || 0)
  const isValid      = !!form.instructorId

  const save = async () => {
    if (!isValid || saving) return
    setSaveErr(null)
    setSaving(true)

    const payload = {
      instructorId:      form.instructorId,
      month:             Number(form.month),
      year:              Number(form.year),
      baseSalary:        Number(form.baseSalary)        || 0,
      additions:         Number(form.additions)         || 0,
      deductions:        Number(form.deductions)        || 0,
      tax:               Number(form.tax)               || 0,
      nationalInsurance: Number(form.nationalInsurance) || 0,
      healthInsurance:   Number(form.healthInsurance)   || 0,
      notes:             form.notes || null,
    }
    console.log('[SalaryModal] saving payload:', payload)

    try {
      isE ? await fin.editSalary(data.id, payload) : await fin.addSalary(payload)
      onClose()
    } catch (e) {
      console.error('[SalaryModal] save error:', e)
      setSaveErr(e?.message ?? 'שגיאה בשמירה — ראה Console לפרטים')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="mh">
          <h3>{isE ? 'עריכת שכר' : 'שכר חדש'}</h3>
          <button className="mx" onClick={onClose}>×</button>
        </div>
        <div className="mb">
          <div className="fg">
            <div className="frow full">
              <label>מדריך *</label>
              <select value={form.instructorId} onChange={f('instructorId')}>
                <option value="">בחר מדריך</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            {selectedInst && suggested > 0 && (
              <div className="frow full">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)' }}>
                  💡 לפי שיעורי החודש: {fmtShekel(suggested)}
                  <button className="btn btn-o btn-sm"
                    onClick={() => setForm(p => ({ ...p, baseSalary: suggested }))}>חשב מסשנים</button>
                </div>
              </div>
            )}
            <div className="frow">
              <label>שכר בסיס (₪)</label>
              <input type="number" value={form.baseSalary} onChange={f('baseSalary')} placeholder="0" min="0"/>
            </div>
            <div className="frow">
              <label>תוספות (₪)</label>
              <input type="number" value={form.additions} onChange={f('additions')} placeholder="0" min="0"/>
            </div>
            <div className="frow">
              <label>ניכויים (₪)</label>
              <input type="number" value={form.deductions} onChange={f('deductions')} placeholder="0" min="0"/>
            </div>
            <div className="frow">
              <label>מס הכנסה (₪)</label>
              <input type="number" value={form.tax} onChange={f('tax')} placeholder="0" min="0"/>
            </div>
            <div className="frow">
              <label>ביטוח לאומי (₪)</label>
              <input type="number" value={form.nationalInsurance} onChange={f('nationalInsurance')} placeholder="0" min="0"/>
            </div>
            <div className="frow">
              <label>ביטוח בריאות (₪)</label>
              <input type="number" value={form.healthInsurance} onChange={f('healthInsurance')} placeholder="0" min="0"/>
            </div>
            <div className="frow full">
              <label>הערות</label>
              <input value={form.notes || ''} onChange={f('notes')} placeholder="הערות..."/>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: '14px 0 2px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--muted)' }}>שכר נטו (חישוב):</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtShekel(net)}</span>
          </div>
        </div>
        {saveErr && (
          <div style={{ margin: '10px 0 0', padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 7, fontSize: 13, direction: 'rtl' }}>
            ⚠️ {saveErr}
          </div>
        )}
        <div className="mf">
          <button
            className="btn btn-p"
            onClick={save}
            disabled={!isValid || saving}
            style={{ opacity: !isValid || saving ? 0.5 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'שומר...' : isE ? 'שמור' : 'הוסף'}
          </button>
          {!isValid && <span style={{ fontSize: 12, color: 'var(--danger)', alignSelf: 'center' }}>יש לבחור מדריך</span>}
          <button className="btn btn-o" onClick={onClose} disabled={saving}>ביטול</button>
          {isE && <button className="del-link" disabled={saving} onClick={async () => { if (window.confirm('למחוק רשומת שכר זו?')) { await fin.removeSalary(data.id); onClose() } }}>מחק</button>}
        </div>
      </div>
    </div>
  )
}

// ── Main FinancePage ───────────────────────────────────────────────────────
export default function FinancePage({ fin, instructors, contacts }) {
  const [tab, setTab]     = useState('income')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    fin.load(fin.month, fin.year)
  }, [fin.month, fin.year]) // eslint-disable-line react-hooks/exhaustive-deps

  const income   = fin.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const expenses = fin.salaries.reduce((s, x) => s + x.netSalary, 0)
  const profit   = income - expenses

  const instName = id => instructors.find(i => i.id === id)?.name || '–'
  const contName = id => contacts.find(c => c.id === id)?.name || '–'

  return (
    <>
      <div className="ph">
        <h2>פיננסים</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={fin.month}
            onChange={e => fin.setMonth(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
          >
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select
            value={fin.year}
            onChange={e => fin.setYear(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, padding: '18px 30px 0' }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>הכנסות חודש</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)', lineHeight: 1 }}>{fmtShekel(income)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            {fin.payments.filter(p => p.status === 'paid').length} תשלומים שולמו
          </div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>הוצאות שכר</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)', lineHeight: 1 }}>{fmtShekel(expenses)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{fin.salaries.length} מדריכים</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>רווח גולמי</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: profit >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: 1 }}>{fmtShekel(profit)}</div>
          <div style={{ fontSize: 12, marginTop: 6, color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {profit >= 0 ? '✓ חיובי' : '✗ שלילי'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '16px 30px 0' }}>
        <div className="tabs">
          <button className={`tab ${tab === 'income' ? 'on' : ''}`} onClick={() => setTab('income')}>הכנסות</button>
          <button className={`tab ${tab === 'salary' ? 'on' : ''}`} onClick={() => setTab('salary')}>שכר</button>
          <button className={`tab ${tab === 'report' ? 'on' : ''}`} onClick={() => setTab('report')}>דוח</button>
        </div>
      </div>

      <div className="pb">
        {/* Income Tab */}
        {tab === 'income' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <button className="btn btn-p btn-sm" onClick={() => setModal({ type: 'payment', data: null })}>
                <Ico.plus/>הוסף תשלום
              </button>
            </div>
            {!fin.payments.length
              ? <div className="empty"><div className="empty-ico">💳</div><p>אין תשלומים לחודש זה</p></div>
              : <div className="tbl-wrap">
                <table>
                  <thead><tr>
                    <th>איש קשר</th><th>תוכנית</th><th>מדריך</th><th>סכום</th><th>סטטוס</th><th></th>
                  </tr></thead>
                  <tbody>
                    {fin.payments.map(p => {
                      const st = PAY_STATUS.find(x => x.value === p.status)
                      return (
                        <tr key={p.id}>
                          <td>{contName(p.contactId)}</td>
                          <td>{p.program || '–'}</td>
                          <td>{instName(p.instructorId)}</td>
                          <td><strong>{fmtShekel(p.amount)}</strong></td>
                          <td><span className={`badge ${st?.badge || 'b-gray'}`}>{st?.label || p.status}</span></td>
                          <td><div className="ac-cell">
                            <button className="icon-btn" onClick={() => setModal({ type: 'payment', data: p })}><Ico.edit/></button>
                            <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק תשלום זה?')) await fin.removePayment(p.id) }}><Ico.trash/></button>
                          </div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg)' }}>
                      <td colSpan={3}><strong>סה"כ</strong></td>
                      <td><strong>{fmtShekel(fin.payments.reduce((s, p) => s + p.amount, 0))}</strong></td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </div>
        )}

        {/* Salary Tab */}
        {tab === 'salary' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <button className="btn btn-o btn-sm" onClick={async () => {
                if (window.confirm('לייצר רשומות שכר לכל המדריכים לפי שיעורי החודש?\nפעולה זו תדרוס בסיס שכר קיים.'))
                  await fin.autoGenerate(instructors, fin.month, fin.year)
              }}>⚡ ייצר שכר אוטומטי</button>
              <button className="btn btn-p btn-sm" onClick={() => setModal({ type: 'salary', data: null })}>
                <Ico.plus/>הוסף ידנית
              </button>
            </div>
            {!fin.salaries.length
              ? <div className="empty"><div className="empty-ico">💰</div><p>אין רשומות שכר לחודש זה</p></div>
              : <div className="tbl-wrap">
                <table>
                  <thead><tr>
                    <th>מדריך</th><th>בסיס</th><th>תוספות</th><th>ניכויים</th><th>מס</th><th>בט"ל</th><th>בריאות</th><th>נטו</th><th></th>
                  </tr></thead>
                  <tbody>
                    {fin.salaries.map(s => (
                      <tr key={s.id}>
                        <td><strong>{instName(s.instructorId)}</strong></td>
                        <td>{fmtShekel(s.baseSalary)}</td>
                        <td>{fmtShekel(s.additions)}</td>
                        <td>{fmtShekel(s.deductions)}</td>
                        <td>{fmtShekel(s.tax)}</td>
                        <td>{fmtShekel(s.nationalInsurance)}</td>
                        <td>{fmtShekel(s.healthInsurance)}</td>
                        <td><strong style={{ color: 'var(--success)' }}>{fmtShekel(s.netSalary)}</strong></td>
                        <td><div className="ac-cell">
                          <button className="icon-btn" onClick={() => setModal({ type: 'salary', data: s })}><Ico.edit/></button>
                          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={async () => { if (window.confirm('למחוק רשומת שכר זו?')) await fin.removeSalary(s.id) }}><Ico.trash/></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg)' }}>
                      <td><strong>סה"כ</strong></td>
                      <td colSpan={6}></td>
                      <td><strong style={{ color: 'var(--success)' }}>{fmtShekel(fin.salaries.reduce((s, x) => s + x.netSalary, 0))}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </div>
        )}

        {/* Report Tab */}
        {tab === 'report' && (
          <div className="card">
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Income breakdown */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>סה"כ הכנסות</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PAY_STATUS.map(st => {
                    const items = fin.payments.filter(p => p.status === st.value)
                    const total = items.reduce((s, p) => s + p.amount, 0)
                    if (!items.length) return null
                    return (
                      <div key={st.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge ${st.badge}`}>{st.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} תשלומים</span>
                        </div>
                        <strong>{fmtShekel(total)}</strong>
                      </div>
                    )
                  })}
                  {!fin.payments.length && <div style={{ color: 'var(--muted)', fontSize: 13 }}>אין תשלומים לחודש זה</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
                    <span>סה"כ</span>
                    <span style={{ color: 'var(--success)' }}>{fmtShekel(fin.payments.reduce((s, p) => s + p.amount, 0))}</span>
                  </div>
                </div>
              </div>

              {/* Salary breakdown */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>סה"כ הוצאות שכר</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fin.salaries.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
                      <span style={{ fontWeight: 500 }}>{instName(s.instructorId)}</span>
                      <strong style={{ color: 'var(--danger)' }}>{fmtShekel(s.netSalary)}</strong>
                    </div>
                  ))}
                  {!fin.salaries.length && <div style={{ color: 'var(--muted)', fontSize: 13 }}>אין רשומות שכר לחודש זה</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
                    <span>סה"כ</span>
                    <span style={{ color: 'var(--danger)' }}>{fmtShekel(expenses)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div style={{ padding: '24px', background: profit >= 0 ? '#d1fae5' : '#fee2e2', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: profit >= 0 ? '#065f46' : '#991b1b', marginBottom: 8 }}>רווח גולמי</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: profit >= 0 ? '#10b981' : '#ef4444' }}>{fmtShekel(profit)}</div>
                <div style={{ fontSize: 12, color: profit >= 0 ? '#065f46' : '#991b1b', marginTop: 8 }}>
                  {expenses > 0
                    ? `יחס הכנסה להוצאה: ${Math.round((income / expenses) * 100)}%`
                    : income > 0 ? 'אין הוצאות שכר לחודש זה' : 'אין נתונים לחודש זה'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'payment' && (
        <PaymentModal
          data={modal.data}
          fin={fin}
          contacts={contacts}
          instructors={instructors}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'salary' && (
        <SalaryModal
          data={modal.data}
          fin={fin}
          instructors={instructors}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
