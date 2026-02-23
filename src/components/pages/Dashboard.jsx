import { useRef, useEffect } from 'react'
import Chart from 'chart.js/auto'
import { CONTACT_TYPES, STAGES, PROGRAMS } from '../../constants'
import { fmtShekel, fmtDT } from '../../utils/format'
import { computeAlerts, noSessionDays, studentStatus, monthlyHours, monthlyPay } from '../../utils/alerts'
import { Ico } from '../icons/Ico'

export default function Dashboard({ contacts, deals, tasks, instructors, students, leads, dark }) {
  const activePipe = deals.filter(d => ['lead','meeting','proposal'].includes(d.stage))
  const pipeVal    = activePipe.reduce((s, d) => s + Number(d.value || 0), 0)
  const thisMonth  = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const monthRev   = deals.filter(d => { const dd = new Date(d.createdAt); return dd >= thisMonth && ['signed','active'].includes(d.stage) }).reduce((s, d) => s + Number(d.value || 0), 0)
  const als        = computeAlerts(tasks, instructors, students, deals)
  const totalAlerts = als.overdue.length + als.instructors.length + als.students.length + als.deals.length
  const recentActs  = contacts.flatMap(c => (c.activities || []).map(a => ({ ...a, cn: c.name }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)

  const rRef = useRef(null), dRef = useRef(null), sRef = useRef(null), pRef = useRef(null)
  const cRefs = useRef({})

  useEffect(() => {
    const tc = dark ? '#94a3b8' : '#64748b', gc = dark ? '#1e293b' : '#e2e8f0'
    Object.values(cRefs.current).forEach(c => c && c.destroy()); cRefs.current = {}
    if (rRef.current) {
      const labels = [], data = []
      for (let i = 5; i >= 0; i--) {
        const m = new Date(); m.setDate(1); m.setMonth(m.getMonth() - i)
        labels.push(m.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }))
        data.push(deals.filter(d => { const dd = new Date(d.createdAt); return dd.getFullYear() === m.getFullYear() && dd.getMonth() === m.getMonth() && ['signed','active'].includes(d.stage) }).reduce((s, d) => s + Number(d.value || 0), 0))
      }
      cRefs.current.r = new Chart(rRef.current, { type: 'line', data: { labels, datasets: [{ label: '₪', data, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.1)', fill: true, tension: .4, pointBackgroundColor: '#f97316', pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik' } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik' }, callback: v => '₪' + v.toLocaleString() } } } } })
    }
    if (dRef.current) {
      cRefs.current.d = new Chart(dRef.current, { type: 'doughnut', data: { labels: CONTACT_TYPES.map(t => t.label), datasets: [{ data: CONTACT_TYPES.map(t => contacts.filter(c => c.type === t.id).length), backgroundColor: ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#f97316'], hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } } } })
    }
    if (sRef.current) {
      cRefs.current.s = new Chart(sRef.current, { type: 'bar', data: { labels: STAGES.map(s => s.label), datasets: [{ data: STAGES.map(s => deals.filter(d => d.stage === s.id).length), backgroundColor: STAGES.map(s => s.color), borderRadius: 5 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gc }, ticks: { color: tc, stepSize: 1, font: { family: 'Rubik' } } }, y: { grid: { display: false }, ticks: { color: tc, font: { family: 'Rubik' } } } } } })
    }
    if (pRef.current) {
      cRefs.current.p = new Chart(pRef.current, { type: 'doughnut', data: { labels: PROGRAMS, datasets: [{ data: PROGRAMS.map(p => students.filter(s => s.program === p).length), backgroundColor: ['#3b82f6','#10b981','#8b5cf6','#f97316','#ec4899','#06b6d4'], hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } } } })
    }
    return () => Object.values(cRefs.current).forEach(c => c && c.destroy())
  }, [contacts, deals, students, dark])

  // ── Today Focus ────────────────────────────────────────────────
  const todayStr   = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr && (!t.snoozedUntil || t.snoozedUntil <= todayStr))
  const atRiskLeads = (leads || []).filter(l => l.atRisk && !['won','lost'].includes(l.leadStage))
  const newLeadsToday = (leads || []).filter(l => (l.createdAt || '').startsWith(todayStr))
  const activeLeads   = (leads || []).filter(l => !['won','lost'].includes(l.leadStage))

  return (
    <>
      <div className="ph"><h2>דשבורד</h2></div>
      <div className="pb">

        {/* ── Today Focus ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🔥', label: 'משימות להיום',  value: todayTasks.length,    color: '#f97316', bg: '#fff7ed',
              sub: todayTasks.length ? todayTasks.slice(0,2).map(t=>t.title).join(', ')+'…' : 'כל הכבוד!' },
            { icon: '⚠', label: 'לידים בסיכון',  value: atRiskLeads.length,  color: '#ef4444', bg: '#fee2e2',
              sub: atRiskLeads.length ? atRiskLeads.slice(0,2).map(l=>l.name).join(', ') : '0 לידים בסיכון' },
            { icon: '🎯', label: 'לידים פעילים',  value: activeLeads.length,  color: '#10b981', bg: '#d1fae5',
              sub: newLeadsToday.length ? `+${newLeadsToday.length} הצטרפו היום` : 'בפייפליין' },
          ].map((f, i) => (
            <div key={i} style={{
              background: f.bg, borderRadius: 12, padding: '16px 18px',
              border: `1px solid ${f.color}22`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: f.color }}>{f.value}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: f.color, marginTop: 6 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: f.color, opacity: .7, marginTop: 3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.sub}</div>
            </div>
          ))}
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {[
            { label: 'אנשי קשר', val: contacts.length, sub: contacts.filter(c => c.status === 'customer').length + ' פעילים', bg: '#dbeafe', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { label: 'פייפליין', val: fmtShekel(pipeVal), sub: activePipe.length + ' עסקאות', bg: '#d1fae5', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
            { label: 'הכנסה חודשית', val: fmtShekel(monthRev), sub: 'עסקאות חתום/פעיל', bg: '#ede9fe', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
            { label: 'מדריכים', val: instructors.length, sub: instructors.filter(i => !noSessionDays(i, 14)).length + ' פעילים', bg: '#fef3c7', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> },
            { label: 'תלמידים', val: students.length, sub: students.filter(s => studentStatus(s) === 'ok').length + ' תקינים', bg: '#ccfbf1', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
            { label: 'התראות', val: totalAlerts, sub: 'דרושה תשומת לב', bg: '#fee2e2', ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="sh"><span className="sl">{s.label}</span><div className="si" style={{ background: s.bg }}>{s.ic}</div></div>
              <div className="sv" style={{ fontSize: typeof s.val === 'string' ? 18 : 26 }}>{s.val}</div>
              <div className="ss">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="db-row">
          <div className="charts-grid">
            {[{ ref: rRef, title: 'הכנסות – 6 חודשים' }, { ref: dRef, title: 'לקוחות לפי סוג' }, { ref: sRef, title: 'עסקאות לפי שלב' }, { ref: pRef, title: 'תלמידים לפי תוכנית' }].map((c, i) => (
              <div key={i} className="chart-card">
                <div className="ct">{c.title}</div>
                <div style={{ height: 175 }}><canvas ref={c.ref}></canvas></div>
              </div>
            ))}
          </div>
          <div className="alerts-panel">
            <div className="alerts-hd"><Ico.alert/> התראות ({totalAlerts})</div>
            {als.overdue.length > 0     && <div className="alert-section"><h4>משימות באיחור ({als.overdue.length})</h4>{als.overdue.slice(0, 4).map(t => <div key={t.id} className="alert-row"><div className="alert-dot"/>{t.title}</div>)}</div>}
            {als.instructors.length > 0 && <div className="alert-section"><h4>מדריכים ללא דיווח ({als.instructors.length})</h4>{als.instructors.slice(0, 4).map(i => <div key={i.id} className="alert-row"><div className="alert-dot"/>{i.name}</div>)}</div>}
            {als.students.length > 0    && <div className="alert-section"><h4>תלמידים בסכנת נשירה ({als.students.length})</h4>{als.students.slice(0, 4).map(s => <div key={s.id} className="alert-row"><div className="alert-dot"/>{s.name}</div>)}</div>}
            {als.deals.length > 0       && <div className="alert-section"><h4>עסקאות תקועות ({als.deals.length})</h4>{als.deals.slice(0, 4).map(d => <div key={d.id} className="alert-row"><div className="alert-dot"/>{d.title}</div>)}</div>}
            {totalAlerts === 0 && <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>אין התראות 🎉</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-hd"><h3>פעילות אחרונה</h3></div>
          {recentActs.length === 0
            ? <div className="empty"><p>אין פעילות עדיין</p></div>
            : <div style={{ padding: '4px 18px 6px' }}>{recentActs.map(a => <div key={a.id} className="act-item"><div className="act-dot"/><div><div className="act-d">{a.desc} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>– {a.cn}</span></div><div className="act-dt">{fmtDT(a.date)}</div></div></div>)}</div>}
        </div>
      </div>
    </>
  )
}
