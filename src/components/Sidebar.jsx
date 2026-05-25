import { Ico } from './icons/Ico'
import { computeAlerts } from '../utils/alerts'
import { useState, useEffect } from 'react'

// Sidebar order follows the business flow: Lead → Contact → Class/Activity → Payment → Management
const NAV = [
  { id: 'dashboard',   label: 'דשבורד',      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'sales',       label: 'מכירות',       ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  { id: 'contacts',    label: 'לקוחות',       ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'classes',     label: 'חוגים וקורסים', ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'financial',   label: 'פיננסים ₪',    ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id: 'taxradar',   label: '📡 Tax Radar',   ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg> },
  { id: 'pipeline',   label: '📊 פייפליין',    ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg> },
  { id: 'tasks',       label: 'משימות',      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { id: 'instructors', label: 'מדריכים',       ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M12 12v9"/><path d="M9 15l3-3 3 3"/></svg> },
  { id: 'students',    label: 'תלמידים',       ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
  { id: 'activities',  label: 'פעילויות',      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="2" y="12" width="6" height="9" rx="1"/><rect x="9" y="12" width="13" height="4" rx="1"/><rect x="9" y="18" width="6" height="3" rx="1"/></svg> },
  { id: 'reports',     label: 'דוחות 📊',      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M2 20h20"/></svg> },
  { id: 'invoices',    label: 'חשבוניות',      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { id: 'automations', label: 'אוטומציות',     ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
]

// Pages not shown in bottom nav - appear in "more" popup
const MORE_PAGES = NAV.filter(n => !['dashboard','sales','contacts','classes'].includes(n.id))

export function MobileBottomNav({ page, setPage, tasks, leads, onMore }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr && (!t.snoozedUntil || t.snoozedUntil <= todayStr)).length
  const atRiskLeads = (leads || []).filter(l => l.atRisk && !['won','lost'].includes(l.leadStage)).length
  const newLeads    = (leads || []).filter(l => l.leadStage === 'new').length
  const leadBadge   = atRiskLeads + newLeads

  const items = [
    { id: 'dashboard', label: 'דשבורד',  badge: 0,         ico: NAV[0].ico },
    { id: 'sales',     label: 'מכירות',  badge: leadBadge,  ico: NAV[1].ico },
    { id: 'contacts',  label: 'לקוחות',  badge: 0,         ico: NAV[2].ico },
    { id: 'classes',   label: 'חוגים',   badge: 0,         ico: NAV[3].ico },
    { id: 'more',      label: 'עוד',     badge: 0,
      ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
  ]

  return (
    <>
      {/* ── More popup menu ── */}
      {moreOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:399 }} onClick={() => setMoreOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            position:'fixed', bottom:62, left:8, right:8, zIndex:401,
            background:'#0f172a', borderRadius:14, padding:'8px 0',
            boxShadow:'0 -4px 24px rgba(0,0,0,.4)', animation:'slideUp .2s ease',
          }}>
            {MORE_PAGES.map(n => (
              <button key={n.id} onClick={() => { setPage(n.id); setMoreOpen(false) }}
                aria-label={n.label}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'12px 18px', border:'none', background: page === n.id ? '#f97316' : 'transparent',
                  color: page === n.id ? '#fff' : '#94a3b8', cursor:'pointer',
                  fontSize:13, fontWeight:500, fontFamily:'inherit', textAlign:'right',
                }}>
                <span style={{ width:18, height:18, display:'inline-flex' }}>{n.ico}</span>
                {n.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <nav className="mob-nav" role="navigation" aria-label="ניווט ראשי">
        {items.map(item => (
          <button
            key={item.id}
            className={`mob-nav-btn ${page === item.id || (item.id === 'more' && !['dashboard','sales','contacts','tasks'].includes(page)) ? 'active' : ''}`}
            onClick={() => item.id === 'more' ? setMoreOpen(v => !v) : (setMoreOpen(false), setPage(item.id))}
            aria-label={item.label}
            aria-current={page === item.id ? 'page' : undefined}
          >
            <span className="mob-nav-ico">
              {item.ico}
              {item.badge > 0 && <span className="mob-badge" aria-label={`${item.badge} התראות`}>{item.badge}</span>}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  )
}

export default function Sidebar({ page, setPage, tasks, instructors, students, deals, leads, dark, setDark, user, signOut, mobOpen, setMobOpen }) {
  const [installPrompt, setInstallPrompt] = useState(null)
  useEffect(() => {
    const fn = e => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', fn)
    return () => window.removeEventListener('beforeinstallprompt', fn)
  }, [])
  const installPWA = () => { installPrompt?.prompt(); setInstallPrompt(null) }

  const als         = computeAlerts(tasks, instructors, students, deals)
  const total       = als.overdue.length + als.instructors.length + als.students.length + als.deals.length
  const todayStr    = new Date().toISOString().split('T')[0]
  const todayTasks  = tasks.filter(t => !t.completed && t.dueDate === todayStr && (!t.snoozedUntil || t.snoozedUntil <= todayStr)).length
  const atRiskLeads = (leads || []).filter(l => l.atRisk && !['won','lost'].includes(l.leadStage)).length
  const newLeads    = (leads || []).filter(l => l.leadStage === 'new').length

  const handleNav = id => {
    setPage(id)
    setMobOpen?.(false)
  }

  return (
    <div className={`sidebar ${mobOpen ? 'mob-open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-w">W</div>
        <div className="logo-t"><h1>WIN CRM</h1><p>אמיתי כהן</p></div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobOpen?.(false)}
          style={{
            marginRight: 'auto', background: 'none', border: 'none',
            color: '#64748b', cursor: 'pointer', fontSize: 20, lineHeight: 1,
            padding: '2px 6px', borderRadius: 6, display: 'none',
          }}
          className="mob-sidebar-close"
        >×</button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => handleNav(n.id)}>
            {n.ico}{n.label}
            {n.id === 'sales'       && (atRiskLeads + newLeads) > 0 && <span className="nav-badge" style={{ background: atRiskLeads > 0 ? '#ef4444' : '#f97316' }}>{atRiskLeads > 0 ? `⚠${atRiskLeads}` : newLeads}</span>}
            {n.id === 'tasks'       && todayTasks > 0             && <span className="nav-badge">{todayTasks}</span>}
            {n.id === 'instructors' && als.instructors.length > 0 && <span className="nav-badge">{als.instructors.length}</span>}
            {n.id === 'students'    && als.students.length > 0    && <span className="nav-badge">{als.students.length}</span>}
            {n.id === 'dashboard'   && total > 0                  && <span className="nav-badge">{total}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        {user && <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '0 4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>}
        <button className="dark-btn" onClick={() => setDark(d => !d)} style={{ marginBottom: '6px' }}>
          {dark ? <Ico.sun/> : <Ico.moon/>}{dark ? 'מצב בהיר' : 'מצב כהה'}
        </button>
        {installPrompt && (
          <button className="dark-btn" onClick={installPWA} style={{ marginBottom: '6px', color: '#f97316', fontWeight: 600 }}>
            📱 התקן אפליקציה
          </button>
        )}
        {signOut && (
          <button className="dark-btn" onClick={signOut} style={{ color: '#fca5a5' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            התנתקות
          </button>
        )}
      </div>
    </div>
  )
}
