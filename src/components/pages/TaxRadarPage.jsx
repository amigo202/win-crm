import { useState, useEffect, useRef, useCallback } from 'react'
import { useTaxRadar } from '../../hooks/useTaxRadar'
import { supabase } from '../../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────
const MONTH_HE  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const TAX_TYPES = { income_tax:'מס הכנסה', bituach_leumi:'ביטוח לאומי', vat:'מע"מ', pension:'פנסיה', hishtalmut:'קרן השתלמות', other:'אחר' }

const fmt = n => {
  if (n == null) return '—'
  const abs = Math.abs(Math.round(n))
  const str = abs.toLocaleString('he-IL')
  return n < 0 ? `(${str})` : str
}
const fmtK = n => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const str = abs >= 1000 ? `${(abs/1000).toFixed(0)}K` : abs.toFixed(0)
  return n < 0 ? `(${str})` : str
}

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#f8fafc',
  card:    '#ffffff',
  card2:   '#f1f5f9',
  border:  '#e2e8f0',
  text:    '#0f172a',
  muted:   '#64748b',
  accent:  '#f97316',
  green:   '#16a34a',
  red:     '#dc2626',
  yellow:  '#d97706',
  blue:    '#2563eb',
  purple:  '#7c3aed',
}

const RISK_COLORS = { low: C.green, medium: C.yellow, high: C.accent, critical: C.red }
const RISK_LABELS = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' }

// KPI card gradient per color
const KPI_GRADIENTS = {
  [C.green]:  'linear-gradient(135deg,#16a34a 0%,#15803d 100%)',
  [C.blue]:   'linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)',
  [C.accent]: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
  [C.yellow]: 'linear-gradient(135deg,#d97706 0%,#b45309 100%)',
  [C.red]:    'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
  [C.purple]: 'linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)',
}

// ── Styles helpers ───────────────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 22,
  boxShadow: '0 2px 12px rgba(15,23,42,.07)',
  ...extra,
})
const btn = (active, color = C.accent) => ({
  padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
  background: active ? color : '#f1f5f9',
  color: active ? '#fff' : C.muted,
  transition: 'all .15s',
  boxShadow: active ? `0 4px 12px ${color}44` : 'none',
})

// ════════════════════════════════════════════════════════════════════════════
export default function TaxRadarPage() {
  const tr = useTaxRadar()
  const [tab,  setTab]  = useState('dashboard')   // dashboard | entry | agent
  const [year, setYear] = useState(2025)

  const data = tr.analytics(year)

  // When year changes, reload settings for that year from Supabase
  useEffect(() => {
    tr.loadSettingsForYear(year)
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Loading skeleton
  if (tr.loading) {
    return (
      <div dir="rtl" style={{ fontFamily: "'Rubik','Segoe UI',Arial,sans-serif", background: C.bg, color: C.text, padding: '20px 24px', maxWidth: 1100, margin: '0 auto', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <span style={{ fontSize: 28 }}>📡</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Tax Radar</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>טוען נתונים...</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...card(), height: 120, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}/>
          ))}
        </div>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ fontFamily: "'Rubik','Segoe UI',Arial,sans-serif", background: C.bg, color: C.text, padding: '20px 24px', maxWidth: 1100, margin: '0 auto', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>📡</span> Tax Radar
            <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, background: C.card2, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.border}` }}>
              חדר בקרה פיננסי
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 13 }}>כמה הרווחת, כמה מס צפוי, וכמה באמת שלך</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Sync status badge */}
          <span title={tr.synced ? 'מסונכרן עם Supabase' : 'שמור מקומית בלבד'} style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
            background: tr.synced ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.1)',
            color: tr.synced ? C.green : C.yellow,
            border: `1px solid ${tr.synced ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.25)'}`,
          }}>
            {tr.synced ? '☁️ Supabase' : '💾 מקומי'}
          </span>
          <select value={year} onChange={e => setYear(+e.target.value)}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14 }}>
            {[2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#fff', padding: 5, borderRadius: 12, width: 'fit-content', border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        {[
          { id: 'dashboard', label: '📊 דשבורד' },
          { id: 'entry',     label: '✏️ הזנה חודשית' },
          { id: 'agent',     label: '🤖 סוכן פיננסי' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={btn(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'dashboard' && <DashboardTab data={data} year={year} tr={tr} />}
      {tab === 'entry'     && <EntryTab     data={data} year={year} tr={tr} />}
      {tab === 'agent'     && <AgentTab     data={data} year={year} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — Dashboard
// ════════════════════════════════════════════════════════════════════════════
function DashboardTab({ data, year, tr }) {
  const {
    totalIncome, totalExpenses, totalProfit, projectedAnnualProfit,
    estimatedTaxTotal, paidToDate, missingReserve, monthlyReserve,
    riskLevel, realMoney, alerts, months, taxRate,
  } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Row 1: Main KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KpiCard title="רווח מצטבר" value={`${fmt(totalProfit)} ₪`} sub={`מתוך ${fmt(totalIncome)} ₪ הכנסות`} color={totalProfit >= 0 ? C.green : C.red} icon="💰"/>
        <KpiCard title="קצב שנתי משוער" value={`${fmt(projectedAnnualProfit)} ₪`} sub={`ממוצע חודשי ${fmt(totalProfit / Math.max(months.length,1))} ₪`} color={C.blue} icon="📈"/>
        <KpiCard
          title="רמת סיכון מס"
          value={RISK_LABELS[riskLevel]}
          sub={`${taxRate}% מהרווח = ${fmt(estimatedTaxTotal)} ₪`}
          color={RISK_COLORS[riskLevel]}
          icon="⚠️"
        />
        <KpiCard
          title="לשים בצד החודש"
          value={`${fmt(monthlyReserve)} ₪`}
          sub="כדי לכסות את המס השנתי"
          color={C.accent}
          icon="🏦"
        />
      </div>

      {/* ── Row 2: Tax Reserve + Real Money ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TaxReserveCard data={data} tr={tr} year={year} />
        <RealMoneyCard  data={data} tr={tr} />
      </div>

      {/* ── Row 3: Monthly chart ── */}
      <MonthlyChart months={months} />

      {/* ── Row 4: Alerts ── */}
      {alerts.length > 0 && <AlertsPanel alerts={alerts} />}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, color, icon }) {
  const gradient = KPI_GRADIENTS[color] || `linear-gradient(135deg,${color},${color}cc)`
  return (
    <div style={{
      background: gradient,
      borderRadius: 18,
      padding: '22px 20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 8px 24px ${color}44`,
    }}>
      <div style={{ position:'absolute', top:-18, left:-18, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.08)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:-10, right:-10, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.06)', pointerEvents:'none' }}/>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 6 }}>{sub}</div>
    </div>
  )
}

// ── Tax Reserve Card ──────────────────────────────────────────────────────────
function TaxReserveCard({ data, tr, year }) {
  const { totalProfit, estimatedTaxTotal, paidToDate, missingReserve, monthlyReserve } = data
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'income_tax', amount: '', date: new Date().toISOString().split('T')[0], notes: '' })

  const savePayment = () => {
    if (!form.amount) return
    tr.addPayment({ year, ...form, amount: +form.amount })
    setForm({ type: 'income_tax', amount: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setShowForm(false)
  }

  const rows = [
    { label: 'רווח מצטבר',         val: `${fmt(totalProfit)} ₪`,       color: C.green },
    { label: 'מס צפוי עד סוף שנה', val: `${fmt(estimatedTaxTotal)} ₪`, color: C.yellow },
    { label: 'שולם עד עכשיו',       val: `${fmt(paidToDate)} ₪`,        color: C.blue },
    { label: 'חסר בקופת המס',       val: `${fmt(missingReserve)} ₪`,    color: missingReserve > 0 ? C.red : C.green },
    { label: 'המלצה — שים בצד',     val: `${fmt(monthlyReserve)} ₪/חודש`, color: C.accent, bold: true },
  ]

  return (
    <div style={card()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🏦 קופת מס</h3>
        <button onClick={() => setShowForm(v => !v)} style={{ ...btn(showForm, C.blue), padding: '5px 12px', fontSize: 12 }}>
          {showForm ? 'ביטול' : '+ רשום תשלום'}
        </button>
      </div>

      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>{r.label}</span>
          <span style={{ fontSize: 14, fontWeight: r.bold ? 700 : 500, color: r.color }}>{r.val}</span>
        </div>
      ))}

      {/* Progress bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 5 }}>
          <span>כיסוי מס: {estimatedTaxTotal > 0 ? Math.round((paidToDate / estimatedTaxTotal) * 100) : 0}%</span>
          <span>{fmt(paidToDate)} / {fmt(estimatedTaxTotal)} ₪</span>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8 }}>
          <div style={{
            height: 8, borderRadius: 6, transition: 'width .5s',
            width: `${Math.min(100, estimatedTaxTotal > 0 ? (paidToDate / estimatedTaxTotal) * 100 : 0)}%`,
            background: paidToDate >= estimatedTaxTotal ? C.green : C.accent,
          }}/>
        </div>
      </div>

      {/* Quick payment form */}
      {showForm && (
        <div style={{ marginTop: 14, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>סוג תשלום</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontFamily: 'inherit', fontSize: 13 }}>
                {Object.entries(TAX_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>סכום ₪</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0" style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }}/>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontFamily: 'inherit', fontSize: 13 }}/>
            <button onClick={savePayment} style={{ padding: '7px 16px', background: C.blue, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>שמור</button>
          </div>
        </div>
      )}

      {/* Payments list */}
      {tr.payments.filter(p => p.year === year).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>תשלומים שבוצעו:</div>
          {tr.payments.filter(p => p.year === year).slice(-5).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,.04)` }}>
              <span style={{ fontSize: 12, color: C.muted }}>{TAX_TYPES[p.type] || p.type} · {p.date}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: C.green }}>{fmt(p.amount)} ₪</span>
                <button onClick={() => tr.removePayment(p.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Real Money Card ───────────────────────────────────────────────────────────
function RealMoneyCard({ data, tr }) {
  const { missingReserve, realMoney } = data
  const [editing, setEditing] = useState(false)
  const [bank,    setBank]    = useState(tr.settings.bankBalance)
  const [commit,  setCommit]  = useState(tr.settings.monthlyCommitments)
  const [taxRate, setTaxRate] = useState(tr.settings.taxRate)

  // Sync local form state when settings load from Supabase
  useEffect(() => {
    setBank(tr.settings.bankBalance)
    setCommit(tr.settings.monthlyCommitments)
    setTaxRate(tr.settings.taxRate)
  }, [tr.settings.bankBalance, tr.settings.monthlyCommitments, tr.settings.taxRate])

  const save = () => {
    tr.updateSettings({ bankBalance: +bank, monthlyCommitments: +commit, taxRate: +taxRate })
    setEditing(false)
  }

  return (
    <div style={card()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>💵 הכסף האמיתי שלי</h3>
        <button onClick={() => setEditing(v => !v)} style={{ ...btn(editing, C.purple), padding: '5px 12px', fontSize: 12 }}>
          {editing ? 'ביטול' : '✏️ עדכן'}
        </button>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'יתרה בבנק (₪)', key: 'bank', val: bank, set: setBank },
            { label: 'התחייבויות קרובות (₪)', key: 'commit', val: commit, set: setCommit },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}/>
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>אחוז מס לשמירה (%)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="range" min="20" max="50" step="1" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                style={{ flex: 1, accentColor: C.accent }}/>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.accent, minWidth: 38, textAlign: 'center' }}>{taxRate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 2 }}>
              <span>שמרני — עד 250K ₪</span>
              <span>מקסימום — מעל 550K ₪</span>
            </div>
          </div>
          <button onClick={save} style={{ padding: '9px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>שמור</button>
        </div>
      ) : (
        <>
          {[
            { label: 'יתרה בבנק',              val: tr.settings.bankBalance,     color: C.text, sign: '' },
            { label: 'פחות קופת מס מומלצת',    val: -missingReserve,             color: C.red,  sign: '−' },
            { label: 'פחות התחייבויות קרובות', val: -tr.settings.monthlyCommitments, color: C.yellow, sign: '−' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.muted }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: r.color }}>{r.sign}{fmt(Math.abs(r.val))} ₪</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>כסף פנוי אמיתי</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: realMoney >= 0 ? C.green : C.red }}>{fmt(realMoney)} ₪</span>
          </div>
          {tr.settings.bankBalance === 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(249,115,22,.08)', border: `1px solid rgba(249,115,22,.2)`, borderRadius: 8, fontSize: 12, color: C.accent }}>
              💡 לחץ "עדכן" כדי להכניס את יתרת הבנק שלך
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Monthly Chart ─────────────────────────────────────────────────────────────
function MonthlyChart({ months }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || months.length === 0) return
    import('chart.js/auto').then(({ default: Chart }) => {
      if (chartRef.current) chartRef.current.destroy()
      const labels  = months.map(m => MONTH_HE[m.month - 1])
      const incomes = months.map(m => m.income || 0)
      const profits = months.map(m => m.net_profit || 0)
      const avgIncome = incomes.reduce((a, b) => a + b, 0) / (incomes.length || 1)

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'הכנסות',
              data: incomes,
              backgroundColor: incomes.map(v => v < avgIncome * 0.4 ? 'rgba(239,68,68,.5)' : 'rgba(59,130,246,.5)'),
              borderColor:     incomes.map(v => v < avgIncome * 0.4 ? '#ef4444' : '#3b82f6'),
              borderWidth: 2, borderRadius: 6,
            },
            {
              label: 'רווח נקי',
              data: profits,
              type: 'line',
              borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.1)',
              borderWidth: 2.5, pointRadius: 5,
              pointBackgroundColor: profits.map(v => v < 0 ? '#ef4444' : '#f97316'),
              pointBorderColor: '#fff', pointBorderWidth: 2,
              fill: true, tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Rubik' } } },
            tooltip: {
              rtl: true,
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('he-IL')} ₪`,
              },
            },
          },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: {
              ticks: {
                color: '#94a3b8',
                callback: v => `${(v/1000).toFixed(0)}K ₪`,
              },
              grid: { color: 'rgba(255,255,255,.05)' },
            },
          },
        },
      })
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [months])

  if (months.length === 0) return null

  return (
    <div style={card()}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📊 הכנסות ורווח חודשי</h3>
      <canvas ref={canvasRef} style={{ maxHeight: 280 }}/>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        {months.map(m => {
          const avgIncome = months.reduce((s, x) => s + x.income, 0) / months.length
          const isLoss  = m.net_profit < -5000
          const isWeak  = m.income < avgIncome * 0.4 && m.income > 0
          const isStrong = m.income > avgIncome * 1.5
          if (!isLoss && !isWeak && !isStrong) return null
          return (
            <div key={m.month} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 600,
              background: isLoss ? 'rgba(239,68,68,.12)' : isWeak ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)',
              color:      isLoss ? C.red : isWeak ? C.yellow : C.green,
              border: `1px solid ${isLoss ? 'rgba(239,68,68,.3)' : isWeak ? 'rgba(245,158,11,.25)' : 'rgba(34,197,94,.25)'}`,
            }}>
              {isLoss ? '🔴' : isWeak ? '🟡' : '🟢'} {MONTH_HE[m.month - 1]}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Alerts Panel ──────────────────────────────────────────────────────────────
function AlertsPanel({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set())
  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const sev = { red: { bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)', color: C.red, icon: '🚨' },
                orange: { bg: 'rgba(249,115,22,.08)', border: 'rgba(249,115,22,.25)', color: C.accent, icon: '⚠️' } }

  return (
    <div style={card()}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>🔔 התראות חכמות</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(a => {
          const s = sev[a.severity] || sev.orange
          return (
            <div key={a.id} style={{ padding: '12px 14px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color, marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{a.message}</div>
              </div>
              <button onClick={() => setDismissed(p => new Set([...p, a.id]))}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — Monthly Entry
// ════════════════════════════════════════════════════════════════════════════
function EntryTab({ data, year, tr }) {
  const [selMonth, setSelMonth] = useState(null)   // null = list view

  if (selMonth !== null) {
    return <MonthForm year={year} month={selMonth} tr={tr} onClose={() => setSelMonth(null)} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>נתונים חודשיים — {year}</h2>
        <button onClick={() => setSelMonth(new Date().getMonth() + 1)}
          style={{ padding: '8px 18px', background: C.accent, color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14 }}>
          + הזן חודש חדש
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {MONTH_HE.map((label, i) => {
          const m = tr.months.find(x => x.year === year && x.month === i + 1)
          return (
            <button key={i} onClick={() => setSelMonth(i + 1)}
              style={{ ...card({ cursor: 'pointer', textAlign: 'right', transition: 'all .15s' }),
                border: `1px solid ${m ? C.border : 'rgba(255,255,255,.06)'}`,
                opacity: m ? 1 : 0.55,
              }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{label}</div>
              {m ? (
                <>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>{fmt(m.income)} ₪</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: m.net_profit >= 0 ? C.green : C.red }}>
                    {m.net_profit >= 0 ? '▲' : '▼'} {fmt(Math.abs(m.net_profit))} ₪
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>לא הוזן</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Month Form ────────────────────────────────────────────────────────────────
function MonthForm({ year, month, tr, onClose }) {
  const existing = tr.months.find(m => m.year === year && m.month === month)
  const [form, setForm] = useState({
    income:                (existing?.income                || 0),
    payroll:               (existing?.payroll               || 0),
    subcontractors:        (existing?.subcontractors        || 0),
    professional_services: (existing?.professional_services || 0),
    software:              (existing?.software              || 0),
    marketing:             (existing?.marketing             || 0),
    vehicle:               (existing?.vehicle               || 0),
    office:                (existing?.office                || 0),
    other:                 (existing?.other                 || 0),
    notes:                 (existing?.notes                 || ''),
  })

  const totalExp = ['payroll','subcontractors','professional_services','software','marketing','vehicle','office','other']
    .reduce((s, k) => s + (+form[k] || 0), 0)
  const netProfit = (+form.income || 0) - totalExp

  const f = (k, label) => (
    <div key={k}>
      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4, fontWeight: 600 }}>{label}</label>
      <input type="number" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}/>
    </div>
  )

  const save = () => {
    tr.upsertMonth({ year, month, ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, +v || (k === 'notes' ? v : 0)])) })
    onClose()
  }

  return (
    <div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginBottom: 16, padding: 0 }}>
        ← חזרה לרשימה
      </button>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
        {MONTH_HE[month - 1]} {year}
        {existing && <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginRight: 8 }}>(עריכה)</span>}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card({ gridColumn: '1 / -1' })}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.green }}>💰 הכנסות</h3>
          {f('income', 'סה"כ הכנסות ₪')}
        </div>

        <div style={card({ gridColumn: '1 / -1' })}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.red }}>📤 הוצאות</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {f('payroll',               'שכר עובדים ₪')}
            {f('subcontractors',        'קבלני משנה ₪')}
            {f('professional_services', 'שירותים מקצועיים ₪')}
            {f('software',              'תוכנות וכלים ₪')}
            {f('marketing',             'פרסום ושיווק ₪')}
            {f('vehicle',               'רכב ₪')}
            {f('office',                'משרד ₪')}
            {f('other',                 'אחר ₪')}
          </div>
        </div>

        <div style={card({ gridColumn: '1 / -1' })}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>📝 הערות</h3>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="הערות לחודש זה..."
            style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14, resize: 'vertical', minHeight: 70, boxSizing: 'border-box' }}/>
        </div>
      </div>

      {/* Summary + Save */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, padding: '16px 20px', background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 32 }}>
          {[
            { label: 'הכנסות',   val: form.income, color: C.green },
            { label: 'הוצאות',   val: totalExp,    color: C.red },
            { label: 'רווח נקי', val: netProfit,   color: netProfit >= 0 ? C.green : C.red },
          ].map(r => (
            <div key={r.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: r.color }}>{fmt(r.val)} ₪</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {existing && (
            <button onClick={() => { tr.deleteMonth(year, month); onClose() }}
              style={{ padding: '10px 16px', background: 'rgba(239,68,68,.15)', color: C.red, border: `1px solid rgba(239,68,68,.3)`, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              מחק
            </button>
          )}
          <button onClick={save}
            style={{ padding: '10px 24px', background: C.accent, color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 15 }}>
            שמור
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — Financial AI Agent
// ════════════════════════════════════════════════════════════════════════════
function AgentTab({ data, year }) {
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: `שלום אמיתי! 👋\n\nאני הסוכן הפיננסי שלך לשנת ${year}.\n\nלפי הנתונים הנוכחיים:\n• הכנסות: ${fmt(data.totalIncome)} ₪\n• רווח נקי: ${fmt(data.totalProfit)} ₪\n• קצב שנתי משוער: ${fmt(data.projectedAnnualProfit)} ₪\n• חסר בקופת מס: ${fmt(data.missingReserve)} ₪\n\nשאל אותי כל שאלה פיננסית!`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  const QUICK = [
    'כמה אני צפוי לשלם מס השנה?',
    'איזה חודשים היו הכי חזקים?',
    'כמה לשים בצד כל חודש?',
    'מה הסיכונים שלי לסוף שנה?',
    'האם כדאי לבדוק חברה בע"מ?',
  ]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildContext = () => {
    const { months, totalIncome, totalExpenses, totalProfit, projectedAnnualProfit,
            estimatedTaxTotal, paidToDate, missingReserve, monthlyReserve, riskLevel } = data
    const monthDetails = months.map(m =>
      `${MONTH_HE[m.month-1]}: הכנסות ${fmt(m.income)}₪, רווח ${fmt(m.net_profit)}₪${m.notes ? ` (${m.notes})` : ''}`
    ).join('\n')

    return `אתה סוכן פיננסי של אמיתי כהן, יזם ומרצה AI עצמאי.
נתוני ${year}:
- הכנסות מצטברות: ${fmt(totalIncome)} ₪
- הוצאות מצטברות: ${fmt(totalExpenses)} ₪
- רווח נקי מצטבר: ${fmt(totalProfit)} ₪
- קצב שנתי משוער: ${fmt(projectedAnnualProfit)} ₪
- שיעור מס: ${data.taxRate}%
- מס צפוי לשנה: ${fmt(estimatedTaxTotal)} ₪
- שולם עד עכשיו: ${fmt(paidToDate)} ₪
- חסר בקופת מס: ${fmt(missingReserve)} ₪
- לשים בצד בחודש: ${fmt(monthlyReserve)} ₪
- רמת סיכון: ${RISK_LABELS[riskLevel]}

נתונים חודשיים:
${monthDetails}

ענה בעברית, בצורה תמציתית, ישירה ומעשית. אם רלוונטי, תן המלצות ספציפיות עם מספרים.`
  }

  const send = async (text) => {
    if (!text?.trim() || loading) return
    setInput('')
    setMessages(p => [...p, { role: 'user', text }])
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('לא מחובר')

      const context = buildContext()
      const { data: res, error } = await supabase.functions.invoke('agent', {
        body: {
          message: text,
          context,
          history: messages.slice(-6).map(m => ({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.text })),
          model: 'gemini-3-pro-preview',
          systemPrompt: context,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (error) throw error

      const reply = res?.text || res?.reply || res?.message || JSON.stringify(res)
      setMessages(p => [...p, { role: 'agent', text: reply }])
    } catch (err) {
      // Fallback: local smart response
      const reply = localAnswer(text, data)
      setMessages(p => [...p, { role: 'agent', text: reply }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
      <div style={{ ...card({ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }) }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.65,
                background: m.role === 'user' ? C.accent : C.card2,
                color: m.role === 'user' ? '#fff' : C.text,
                borderBottomRight: m.role === 'agent' ? 0 : 12,
                whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ padding: '10px 18px', background: C.card2, borderRadius: 12, color: C.muted, fontSize: 13 }}>
                ⏳ מחשב...
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {/* Quick prompts */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => send(q)} disabled={loading}
              style={{ padding: '5px 12px', background: 'rgba(249,115,22,.1)', border: `1px solid rgba(249,115,22,.25)`, borderRadius: 20, color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="שאל שאלה פיננסית... (Enter לשליחה)"
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontFamily: 'inherit', fontSize: 14, outline: 'none', textAlign: 'right' }}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()}
            style={{ padding: '10px 20px', background: input.trim() ? C.accent : C.border, color: '#fff', border: 'none', borderRadius: 10, cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, transition: 'background .15s' }}>
            שלח
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Local fallback answers (when no edge function) ────────────────────────────
function localAnswer(question, data) {
  const q = question.toLowerCase()
  const { totalProfit, projectedAnnualProfit, estimatedTaxTotal, missingReserve, monthlyReserve, months, riskLevel } = data

  if (q.includes('מס') && (q.includes('כמה') || q.includes('צפוי'))) {
    return `לפי הקצב הנוכחי:\n\n• רווח שנתי משוער: ${fmt(projectedAnnualProfit)} ₪\n• מס שנתי צפוי (${data.taxRate}%): ${fmt(estimatedTaxTotal)} ₪\n• שולם עד עכשיו: ${fmt(data.paidToDate)} ₪\n• חסר: ${fmt(missingReserve)} ₪\n\nכדי לכסות את ההפרש, שים בצד ${fmt(monthlyReserve)} ₪ בכל חודש שנותר.`
  }
  if (q.includes('חזק') || q.includes('חודש')) {
    const sorted = [...months].sort((a, b) => b.income - a.income)
    const top3 = sorted.slice(0, 3).map(m => `${MONTH_HE[m.month-1]}: ${fmt(m.income)} ₪`).join('\n')
    const worst = sorted.slice(-2).map(m => `${MONTH_HE[m.month-1]}: ${fmt(m.income)} ₪`).join('\n')
    return `3 החודשים החזקים:\n${top3}\n\nהחודשים החלשים:\n${worst}`
  }
  if (q.includes('לשים בצד') || q.includes('חסכון') || q.includes('כמה')) {
    return `המלצה לחיסכון מס:\n\n• ${data.taxRate}% מכל רווח = שים בצד ${fmt(totalProfit * data.taxRate / 100)} ₪ כבר עכשיו\n• כל חודש מהיום: ${fmt(monthlyReserve)} ₪\n\nזה יבטיח שלא תהיה הפתעות מהרו"ח.`
  }
  if (q.includes('סיכון') || q.includes('סוף שנה') || q.includes('בעיה')) {
    const alerts = data.alerts.map(a => `• ${a.title}: ${a.message}`).join('\n')
    return `סיכונים עיקריים לסוף שנה:\n\n${alerts || 'לא זוהו סיכונים מיוחדים 🟢'}\n\nרמת סיכון כללית: ${RISK_LABELS[riskLevel]}`
  }
  if (q.includes('חברה') || q.includes('בע"מ')) {
    return `מתי כדאי לשקול חברה בע"מ?\n\n• רווח שנתי מעל 400,000-500,000 ₪ בעקביות\n• אתה עומד על ${fmt(projectedAnnualProfit)} ₪ בקצב הנוכחי\n\n${projectedAnnualProfit > 450000 ? '⚠️ אתה מתקרב לסף שבו חברה בע"מ עשויה לחסוך מס. שווה להתייעץ עם רו"ח!' : '✅ בשלב הנוכחי עצמאות עדיין יעילה יותר לגודל הפעילות שלך.'}\n\nבכל מקרה — התייעץ עם רואה חשבון לפני החלטה.`
  }

  return `הנה סיכום מהיר של המצב הנוכחי:\n\n• הכנסות מצטברות: ${fmt(data.totalIncome)} ₪\n• רווח נקי: ${fmt(totalProfit)} ₪\n• קצב שנתי משוער: ${fmt(projectedAnnualProfit)} ₪\n• חסר בקופת מס: ${fmt(missingReserve)} ₪\n\nמה בדיוק תרצה לדעת?`
}
