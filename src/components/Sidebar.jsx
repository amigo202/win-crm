import { Ico } from './icons/Ico'
import { computeAlerts } from '../utils/alerts'

const NAV = [
  { id: 'dashboard',   label: 'דשבורד',     ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'contacts',    label: 'אנשי קשר',   ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'deals',       label: 'עסקאות',     ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  { id: 'tasks',       label: 'משימות',     ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { id: 'instructors', label: 'מדריכים',    ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M12 12v9"/><path d="M9 15l3-3 3 3"/></svg> },
  { id: 'students',    label: 'תלמידים',    ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
]

export default function Sidebar({ page, setPage, tasks, instructors, students, deals, dark, setDark, user, signOut }) {
  const als   = computeAlerts(tasks, instructors, students, deals)
  const total = als.overdue.length + als.instructors.length + als.students.length + als.deals.length

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-w">W</div>
        <div className="logo-t"><h1>WIN CRM</h1><p>אמיתי כהן</p></div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            {n.ico}{n.label}
            {n.id === 'tasks'       && als.overdue.length > 0     && <span className="nav-badge">{als.overdue.length}</span>}
            {n.id === 'instructors' && als.instructors.length > 0 && <span className="nav-badge">{als.instructors.length}</span>}
            {n.id === 'students'    && als.students.length > 0    && <span className="nav-badge">{als.students.length}</span>}
            {n.id === 'dashboard'   && total > 0                  && <span className="nav-badge">{total}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        {user && <div style={{ fontSize: '11px', color: '#475569', padding: '0 4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>}
        <button className="dark-btn" onClick={() => setDark(d => !d)} style={{ marginBottom: '6px' }}>
          {dark ? <Ico.sun/> : <Ico.moon/>}{dark ? 'מצב בהיר' : 'מצב כהה'}
        </button>
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
