import { useRef, useEffect } from 'react'
import Chart from 'chart.js/auto'
import { CONTACT_TYPES, STAGES, PROGRAMS, PRIORITIES } from '../../constants'
import { fmtShekel, fmtDT } from '../../utils/format'
import { computeAlerts, noSessionDays, studentStatus, monthlyHours, monthlyPay } from '../../utils/alerts'
import { Ico } from '../icons/Ico'

export default function Dashboard({ contacts, deals, tasks, instructors, students, leads, dark, setPage }) {
  const activePipe = deals.filter(d => ['lead','meeting','proposal'].includes(d.stage))
  const pipeVal    = activePipe.reduce((s, d) => s + Number(d.value || 0), 0)
  const thisMonth  = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const monthRev   = deals.filter(d => {
    const dd = new Date(d.createdAt)
    return dd >= thisMonth && ['signed','active'].includes(d.stage)
  }).reduce((s, d) => s + Number(d.value || 0), 0)
  const als         = computeAlerts(tasks, instructors, students, deals)
  const totalAlerts = als.overdue.length + als.instructors.length + als.students.length + als.deals.length
  const recentActs  = contacts
    .flatMap(c => (c.activities || []).map(a => ({ ...a, cn: c.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)

  const todayStr      = new Date().toISOString().split('T')[0]
  const todayTasks    = tasks.filter(t => !t.completed && t.dueDate === todayStr && (!t.snoozedUntil || t.snoozedUntil <= todayStr))
  const atRiskLeads   = (leads || []).filter(l => l.atRisk && !['won','lost'].includes(l.leadStage))
  const newLeadsToday = (leads || []).filter(l => (l.createdAt || '').startsWith(todayStr))
  const activeLeads   = (leads || []).filter(l => !['won','lost'].includes(l.leadStage))

  // Tasks sorted by urgency: overdue → today → upcoming → no date → by priority
  const sortedTasks = [...tasks]
    .filter(t => !t.completed)
    .sort((a, b) => {
      const aOv = a.dueDate && a.dueDate < todayStr
      const bOv = b.dueDate && b.dueDate < todayStr
      if (aOv && !bOv) return -1
      if (!aOv && bOv) return 1
      const aTo = a.dueDate === todayStr
      const bTo = b.dueDate === todayStr
      if (aTo && !bTo) return -1
      if (!aTo && bTo) return 1
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      const pOrd = { high: 0, medium: 1, low: 2 }
      return (pOrd[a.priority] || 1) - (pOrd[b.priority] || 1)
    })

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
        data.push(deals.filter(d => {
          const dd = new Date(d.createdAt)
          return dd.getFullYear() === m.getFullYear() && dd.getMonth() === m.getMonth() && ['signed','active'].includes(d.stage)
        }).reduce((s, d) => s + Number(d.value || 0), 0))
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

  const hoverUp   = e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)' }
  const hoverDown = e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }

  return (
    <>
      <div className="ph"><h2>דשבורד</h2></div>
      <div className="pb">

        {/* ── Today Focus — clickable ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { icon: '🔥', label: 'משימות להיום', value: todayTasks.length,  color: '#f97316', bg: '#fff7ed',
              sub: todayTasks.length ? todayTasks.slice(0,2).map(t=>t.title).join(', ')+'…' : 'כל הכבוד!', page: 'tasks' },
            { icon: '⚠',  label: 'לידים בסיכון', value: atRiskLeads.length, color: '#ef4444', bg: '#fee2e2',
              sub: atRiskLeads.length ? atRiskLeads.slice(0,2).map(l=>l.name).join(', ') : '0 לידים בסיכון', page: 'leads' },
            { icon: '🎯', label: 'לידים פעילים',  value: activeLeads.length, color: '#10b981', bg: '#d1fae5',
              sub: newLeadsToday.length ? `+${newLeadsToday.length} הצטרפו היום` : 'בפייפליין', page: 'leads' },
          ].map((f, i) => (
            <div key={i} onClick={() => setPage?.(f.page)} onMouseEnter={hoverUp} onMouseLeave={hoverDown}
              style={{ background: f.bg, borderRadius: 12, padding: '16px 18px', border: `1px solid ${f.color}22`, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: f.color }}>{f.value}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: f.color, marginTop: 6 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: f.color, opacity: .7, marginTop: 3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Stat cards — clickable ──────────────────────────── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {[
            { label: 'לקוחות',       val: contacts.length,    sub: contacts.filter(c=>c.status==='customer').length+' פעילים', bg: '#dbeafe', page: 'contacts',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { label: 'פייפליין',     val: fmtShekel(pipeVal), sub: activePipe.length+' עסקאות', bg: '#d1fae5', page: 'deals',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
            { label: 'הכנסה חודשית', val: fmtShekel(monthRev), sub: 'עסקאות חתום/פעיל', bg: '#ede9fe', page: 'finance',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
            { label: 'מדריכים',      val: instructors.length, sub: instructors.filter(i=>!noSessionDays(i,14)).length+' פעילים', bg: '#fef3c7', page: 'instructors',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> },
            { label: 'תלמידים',      val: students.length,   sub: students.filter(s=>studentStatus(s)==='ok').length+' תקינים', bg: '#ccfbf1', page: 'students',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
            { label: 'התראות',       val: totalAlerts,       sub: 'דרושה תשומת לב', bg: '#fee2e2', page: 'tasks',
              ic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
          ].map((s, i) => (
            <div key={i} className="stat-card" onClick={() => setPage?.(s.page)} onMouseEnter={hoverUp} onMouseLeave={hoverDown}
              style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}>
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

          {/* ── Tasks panel (replaces alerts) ────────────────── */}
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
                  <div key={t.id} className="alert-row"
                    style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                    onClick={() => setPage?.('tasks')}>
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
