import { useRef, useEffect, useMemo } from 'react'
import Chart from 'chart.js/auto'
import { CONTACT_TYPES, STAGES, PROGRAMS, PRIORITIES } from '../../constants'
import { fmtShekel, fmtDT } from '../../utils/format'
import { computeAlerts, noSessionDays, studentStatus } from '../../utils/alerts'
import { Ico } from '../icons/Ico'

// ── Activity-type metadata (matches ActivitiesPage) ──────────────────────────
const CLASS_TYPE_LABELS = { 'חוג': 'חוגים', 'קורס': 'קורסים', 'סדנה': 'סדנאות', 'מחנה': 'מחנות', 'אירוע': 'אירועים', 'הרצאה': 'הרצאות' }
const BIZ_TYPE_LABELS   = { pixmix: 'PIXMIX', video: 'סרטונים', content: 'תוכן', lecture: 'הרצאות', consulting: 'ייעוץ', other: 'אחר' }
const SOURCE_COLORS     = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#f97316']

export default function Dashboard({ contacts, deals, tasks, instructors, students, leads, classes, activities, dark, setPage }) {
  // ── Current period ──────────────────────────────────────────
  const now        = new Date()
  const curMonth   = now.getMonth() + 1
  const curYear    = now.getFullYear()
  const prevMonth  = curMonth === 1 ? 12 : curMonth - 1
  const prevYear   = curMonth === 1 ? curYear - 1 : curYear

  // ── Calculate income from classes ───────────────────────────
  const classIncome = useMemo(() => {
    return (classes || []).reduce((acc, c) => {
      const m = Number(c.month), y = Number(c.year)
      const key = `${y}-${m}`
      const students_n = Number(c.students_count) || 0
      const pps = Number(c.price_per_student) || 0
      const agreed = Number(c.agreed_price) || 0
      const actual = Number(c.actual_income) || 0
      const income = actual || (students_n * pps) || agreed
      const instrCost = Number(c.instructor_total_override) || (Number(c.instructor_price_per_session || 0) * Number(c.monthly_hours || 4))
      const type = c.activity_type || 'חוג'
      if (!acc[key]) acc[key] = { income: 0, expenses: 0, byType: {} }
      acc[key].income   += income
      acc[key].expenses += instrCost
      if (!acc[key].byType[type]) acc[key].byType[type] = 0
      acc[key].byType[type] += income
      return acc
    }, {})
  }, [classes])

  // ── Calculate income from activities ────────────────────────
  const actIncome = useMemo(() => {
    return (activities || []).reduce((acc, a) => {
      const key = `${a.year}-${a.month}`
      if (!acc[key]) acc[key] = { income: 0, expenses: 0, byType: {} }
      acc[key].income   += a.income
      acc[key].expenses += a.expenses
      const type = a.activityType || 'other'
      if (!acc[key].byType[type]) acc[key].byType[type] = 0
      acc[key].byType[type] += a.income
      return acc
    }, {})
  }, [activities])

  // ── Current month totals ────────────────────────────────────
  const curKey  = `${curYear}-${curMonth}`
  const prevKey = `${prevYear}-${prevMonth}`

  const curClassInc  = classIncome[curKey]?.income   || 0
  const curClassExp  = classIncome[curKey]?.expenses  || 0
  const curActInc    = actIncome[curKey]?.income      || 0
  const curActExp    = actIncome[curKey]?.expenses    || 0
  const curTotalInc  = curClassInc + curActInc
  const curTotalExp  = curClassExp + curActExp
  const curProfit    = curTotalInc - curTotalExp

  const prevClassInc = classIncome[prevKey]?.income  || 0
  const prevActInc   = actIncome[prevKey]?.income    || 0
  const prevTotalInc = prevClassInc + prevActInc

  const incDelta  = prevTotalInc > 0 ? Math.round(((curTotalInc - prevTotalInc) / prevTotalInc) * 100) : 0

  // ── Source breakdown (current month) ────────────────────────
  const sourceBreakdown = useMemo(() => {
    const map = {}
    // From classes
    const ct = classIncome[curKey]?.byType || {}
    for (const [type, val] of Object.entries(ct)) {
      const label = CLASS_TYPE_LABELS[type] || type
      map[label] = (map[label] || 0) + val
    }
    // From activities
    const at = actIncome[curKey]?.byType || {}
    for (const [type, val] of Object.entries(at)) {
      const label = BIZ_TYPE_LABELS[type] || type
      map[label] = (map[label] || 0) + val
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [classIncome, actIncome, curKey])

  // ── Alerts & leads ──────────────────────────────────────────
  const als          = computeAlerts(tasks, instructors, students, deals)
  const totalAlerts  = als.overdue.length + als.instructors.length + als.students.length + als.deals.length
  const todayStr     = new Date().toISOString().split('T')[0]
  const todayTasks   = tasks.filter(t => !t.completed && t.dueDate === todayStr && (!t.snoozedUntil || t.snoozedUntil <= todayStr))
  const atRiskLeads  = (leads || []).filter(l => l.atRisk && !['won','lost'].includes(l.leadStage))
  const activeLeads  = (leads || []).filter(l => !['won','lost'].includes(l.leadStage))
  const newLeadsToday= (leads || []).filter(l => (l.createdAt || '').startsWith(todayStr))

  // ── Recent activities ───────────────────────────────────────
  const recentActs = contacts
    .flatMap(c => (c.activities || []).map(a => ({ ...a, cn: c.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)

  // ── Tasks sorted by urgency ─────────────────────────────────
  const sortedTasks = [...tasks]
    .filter(t => !t.completed)
    .sort((a, b) => {
      const aOv = a.dueDate && a.dueDate < todayStr
      const bOv = b.dueDate && b.dueDate < todayStr
      if (aOv && !bOv) return -1; if (!aOv && bOv) return 1
      const aTo = a.dueDate === todayStr; const bTo = b.dueDate === todayStr
      if (aTo && !bTo) return -1; if (!aTo && bTo) return 1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1; if (b.dueDate) return 1
      const pOrd = { high: 0, medium: 1, low: 2 }
      return (pOrd[a.priority] || 1) - (pOrd[b.priority] || 1)
    })

  // ── Charts ──────────────────────────────────────────────────
  const trendRef = useRef(null), sourceRef = useRef(null), dRef = useRef(null), sRef = useRef(null)
  const cRefs = useRef({})

  useEffect(() => {
    const tc = dark ? '#94a3b8' : '#64748b', gc = dark ? '#1e293b' : '#e2e8f0'
    Object.values(cRefs.current).forEach(c => c && c.destroy()); cRefs.current = {}

    // ── Trend chart (6 months, classes + activities) ───────────
    if (trendRef.current) {
      const labels = [], incData = [], expData = [], profData = []
      for (let i = 5; i >= 0; i--) {
        const m = new Date(); m.setDate(1); m.setMonth(m.getMonth() - i)
        const mo = m.getMonth() + 1, yr = m.getFullYear()
        const key = `${yr}-${mo}`
        labels.push(m.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }))
        const ci = classIncome[key]?.income || 0
        const ce = classIncome[key]?.expenses || 0
        const ai = actIncome[key]?.income || 0
        const ae = actIncome[key]?.expenses || 0
        const totalI = ci + ai, totalE = ce + ae
        incData.push(totalI); expData.push(totalE); profData.push(totalI - totalE)
      }
      cRefs.current.trend = new Chart(trendRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'הכנסות', data: incData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.08)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#10b981' },
            { label: 'הוצאות', data: expData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#ef4444', borderDash: [4,4] },
            { label: 'רווח',   data: profData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#3b82f6' },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } },
          scales: {
            x: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik' } } },
            y: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik' }, callback: v => '₪' + v.toLocaleString() } }
          }
        }
      })
    }

    // ── Source breakdown chart (doughnut) ──────────────────────
    if (sourceRef.current && sourceBreakdown.length > 0) {
      cRefs.current.source = new Chart(sourceRef.current, {
        type: 'doughnut',
        data: {
          labels: sourceBreakdown.map(s => s.label),
          datasets: [{ data: sourceBreakdown.map(s => s.value), backgroundColor: SOURCE_COLORS.slice(0, sourceBreakdown.length), hoverOffset: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } }
        }
      })
    }

    // ── Contacts by type ──────────────────────────────────────
    if (dRef.current) {
      cRefs.current.d = new Chart(dRef.current, { type: 'doughnut', data: { labels: CONTACT_TYPES.map(t => t.label), datasets: [{ data: CONTACT_TYPES.map(t => contacts.filter(c => c.type === t.id).length), backgroundColor: ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#f97316'], hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } } } })
    }

    // ── Deals by stage ────────────────────────────────────────
    if (sRef.current) {
      cRefs.current.s = new Chart(sRef.current, { type: 'bar', data: { labels: STAGES.map(s => s.label), datasets: [{ data: STAGES.map(s => deals.filter(d => d.stage === s.id).length), backgroundColor: STAGES.map(s => s.color), borderRadius: 5 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gc }, ticks: { color: tc, stepSize: 1, font: { family: 'Rubik' } } }, y: { grid: { display: false }, ticks: { color: tc, font: { family: 'Rubik' } } } } } })
    }

    return () => Object.values(cRefs.current).forEach(c => c && c.destroy())
  }, [contacts, deals, students, dark, classIncome, actIncome, sourceBreakdown])

  const hoverUp   = e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)' }
  const hoverDown = e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }

  return (
    <>
      <div className="ph"><h2>דשבורד</h2></div>
      <div className="pb">

        {/* ── KPI Cards (unified income) ────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '💰', label: 'הכנסה החודש',  value: fmtShekel(curTotalInc),  color: '#10b981', bg: '#d1fae5',
              sub: incDelta !== 0 ? `${incDelta > 0 ? '↑' : '↓'} ${Math.abs(incDelta)}% מחודש קודם` : 'חוגים + פעילויות', page: 'finance' },
            { icon: '📉', label: 'הוצאות החודש',  value: fmtShekel(curTotalExp),  color: '#ef4444', bg: '#fee2e2',
              sub: 'מדריכים + הוצאות', page: 'finance' },
            { icon: '📊', label: 'רווח נקי',       value: fmtShekel(curProfit),     color: curProfit >= 0 ? '#3b82f6' : '#ef4444', bg: curProfit >= 0 ? '#dbeafe' : '#fee2e2',
              sub: 'הכנסות - הוצאות', page: 'finance' },
            { icon: '🎯', label: 'לידים פעילים',   value: activeLeads.length,       color: '#f97316', bg: '#fff7ed',
              sub: atRiskLeads.length ? `⚠ ${atRiskLeads.length} בסיכון` : newLeadsToday.length ? `+${newLeadsToday.length} היום` : 'בפייפליין', page: 'leads' },
          ].map((f, i) => (
            <div key={i} onClick={() => setPage?.(f.page)} onMouseEnter={hoverUp} onMouseLeave={hoverDown}
              style={{ background: f.bg, borderRadius: 12, padding: '16px 18px', border: `1px solid ${f.color}22`, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <span style={{ fontSize: 24 }}>{f.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.value}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: f.color, marginTop: 6 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: f.color, opacity: .7, marginTop: 3 }}>{f.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Quick stats row ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🔥', label: 'משימות להיום', value: todayTasks.length, color: '#f97316', bg: '#fff7ed',
              sub: todayTasks.length ? todayTasks.slice(0,2).map(t=>t.title).join(', ') : 'הכל מסודר!', page: 'tasks' },
            { icon: '⚠', label: 'לידים בסיכון', value: atRiskLeads.length, color: '#ef4444', bg: '#fee2e2',
              sub: atRiskLeads.length ? atRiskLeads.slice(0,2).map(l=>l.name).join(', ') : '0 בסיכון', page: 'leads' },
            { icon: '🔔', label: 'התראות', value: totalAlerts, color: '#8b5cf6', bg: '#ede9fe',
              sub: 'דרושה תשומת לב', page: 'tasks' },
          ].map((f, i) => (
            <div key={i} onClick={() => setPage?.(f.page)} onMouseEnter={hoverUp} onMouseLeave={hoverDown}
              style={{ background: f.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${f.color}22`, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <span style={{ fontSize: 22 }}>{f.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: f.color }}>{f.value}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 12, color: f.color, marginTop: 4 }}>{f.label}</div>
              <div style={{ fontSize: 10, color: f.color, opacity: .7, marginTop: 2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Charts ───────────────────────────────────────── */}
        <div className="db-row">
          <div className="charts-grid">
            {[
              { ref: trendRef,  title: 'הכנסות / הוצאות / רווח – 6 חודשים' },
              { ref: sourceRef, title: 'פילוח הכנסות לפי מקור (החודש)' },
              { ref: dRef,      title: 'לקוחות לפי סוג' },
              { ref: sRef,      title: 'עסקאות לפי שלב' },
            ].map((c, i) => (
              <div key={i} className="chart-card">
                <div className="ct">{c.title}</div>
                <div style={{ height: 195 }}><canvas ref={c.ref}></canvas></div>
              </div>
            ))}
          </div>

          {/* ── Tasks panel ─────────────────────────────────── */}
          <div className="alerts-panel">
            <div className="alerts-hd" style={{ cursor: 'pointer' }} onClick={() => setPage?.('tasks')}>
              📋 משימות פתוחות ({sortedTasks.length})
            </div>
            {sortedTasks.length === 0 ? (
              <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                🎉 אין משימות פתוחות!
              </div>
            ) : <>
              {sortedTasks.slice(0, 9).map(t => {
                const isOv  = t.dueDate && t.dueDate < todayStr
                const isTo  = t.dueDate === todayStr
                const pr    = PRIORITIES.find(p => p.value === t.priority)
                const cname = contacts.find(c => c.id === t.contactId)?.name
                return (
                  <div key={t.id} className="alert-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setPage?.('tasks')}>
                    <div className="alert-dot" style={{ background: isOv ? '#ef4444' : isTo ? '#f97316' : '#94a3b8', marginTop: 5, flexShrink: 0 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                        {t.dueDate && <span style={{ fontSize: 10, color: isOv ? '#ef4444' : isTo ? '#f97316' : 'var(--muted)', fontWeight: isOv || isTo ? 600 : 400 }}>
                          {isOv ? `⚠ ${t.dueDate}` : isTo ? '🔥 היום' : t.dueDate}
                        </span>}
                        {cname && <span style={{ fontSize: 10, color: 'var(--muted)' }}>• {cname}</span>}
                      </div>
                    </div>
                    {pr && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, flexShrink: 0, background: isOv ? '#fee2e2' : '#f1f5f9', color: isOv ? '#dc2626' : 'var(--muted)', marginTop: 2 }}>{pr.label}</span>}
                  </div>
                )
              })}
              {sortedTasks.length > 9 && (
                <button onClick={() => setPage?.('tasks')} style={{ width: '100%', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#f97316', fontSize: 12, fontWeight: 600, borderTop: '1px solid var(--border)' }}>
                  עוד {sortedTasks.length - 9} משימות ←
                </button>
              )}
            </>}
          </div>
        </div>

        {/* ── Recent activity ──────────────────────────────── */}
        <div className="card">
          <div className="card-hd"><h3>פעילות אחרונה</h3></div>
          {recentActs.length === 0
            ? <div className="empty"><p>אין פעילות עדיין</p></div>
            : <div style={{ padding: '4px 18px 6px' }}>{recentActs.map(a => (
                <div key={a.id} className="act-item">
                  <div className="act-dot"/>
                  <div><div className="act-d">{a.desc} <span style={{ color:'var(--muted)', fontWeight:500 }}>– {a.cn}</span></div><div className="act-dt">{fmtDT(a.date)}</div></div>
                </div>
              ))}</div>}
        </div>
      </div>
    </>
  )
}
