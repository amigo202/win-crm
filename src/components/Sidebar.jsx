import React from 'react'

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  contacts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  deals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'contacts',  label: 'לקוחות' },
  { id: 'deals',     label: 'עסקאות' },
  { id: 'tasks',     label: 'משימות' },
]

export default function Sidebar({ currentPage, onNavigate, tasks }) {
  const overdueTasks = tasks.filter(
    t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
  ).length

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>CRM</h1>
        <p>מערכת ניהול לקוחות</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {ICONS[item.id]}
            {item.label}
            {item.id === 'tasks' && overdueTasks > 0 && (
              <span className="nav-badge">{overdueTasks}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
