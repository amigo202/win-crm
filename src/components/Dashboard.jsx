import React from 'react'

function formatCurrency(n) {
  return '₪' + Number(n || 0).toLocaleString('he-IL')
}

function getInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date(); today.setHours(0,0,0,0)
  const overdue = date < today
  return {
    text: date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
    overdue,
  }
}

const STATUS_MAP = {
  lead:     ['badge-yellow', 'ליד'],
  prospect: ['badge-blue',   'פרוספקט'],
  customer: ['badge-green',  'לקוח'],
}

const PRIORITY_MAP = {
  high:   ['badge-red',    'גבוהה'],
  medium: ['badge-yellow', 'בינונית'],
  low:    ['badge-green',  'נמוכה'],
}

export default function Dashboard({ contacts, deals, tasks }) {
  const openTasks    = tasks.filter(t => !t.completed)
  const activeDeals  = deals.filter(d => !['won', 'lost'].includes(d.stage))
  const totalValue   = deals
    .filter(d => d.stage !== 'lost')
    .reduce((s, d) => s + Number(d.value || 0), 0)

  const upcomingTasks = [...openTasks]
    .filter(t => t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6)

  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)

  return (
    <>
      <div className="page-header">
        <h2>דשבורד</h2>
      </div>
      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid">
          <StatCard
            label='סה"כ לקוחות'
            value={contacts.length}
            sub={`${contacts.filter(c => c.status === 'customer').length} לקוחות פעילים`}
            iconBg="#dbeafe"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <StatCard
            label="עסקאות פעילות"
            value={activeDeals.length}
            sub={`${deals.filter(d => d.stage === 'won').length} נסגרו בהצלחה`}
            iconBg="#d1fae5"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            }
          />
          <StatCard
            label="משימות פתוחות"
            value={openTasks.length}
            sub={`${openTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length} באיחור`}
            iconBg="#fef3c7"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            }
          />
          <StatCard
            label="שווי פייפליין"
            value={formatCurrency(totalValue)}
            valueStyle={{ fontSize: 20 }}
            sub="עסקאות פעילות וזכויות"
            iconBg="#ede9fe"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
        </div>

        {/* Two-column cards */}
        <div className="dashboard-grid">
          {/* Recent contacts */}
          <div className="card">
            <div className="card-header">
              <h3>לקוחות אחרונים</h3>
              <span className="badge badge-gray">{contacts.length}</span>
            </div>
            <div className="card-body">
              {recentContacts.length === 0 ? (
                <div className="empty-state"><p>אין לקוחות עדיין</p></div>
              ) : recentContacts.map(c => {
                const [cls, label] = STATUS_MAP[c.status] || ['badge-gray', c.status]
                return (
                  <div key={c.id} className="list-item">
                    <div className="avatar">{getInitials(c.name)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.company || c.email || ''}</div>
                    </div>
                    <span className={`badge ${cls}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming tasks */}
          <div className="card">
            <div className="card-header">
              <h3>משימות קרובות</h3>
              <span className="badge badge-gray">{openTasks.length}</span>
            </div>
            <div className="card-body">
              {upcomingTasks.length === 0 ? (
                <div className="empty-state"><p>אין משימות פתוחות</p></div>
              ) : upcomingTasks.map(t => {
                const di = formatDate(t.dueDate)
                const [pcls, plabel] = PRIORITY_MAP[t.priority] || ['badge-gray', t.priority]
                return (
                  <div key={t.id} className="list-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                      {di && (
                        <div style={{ fontSize: 12, marginTop: 2, color: di.overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {di.text}{di.overdue && ' - באיחור'}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${pcls}`}>{plabel}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value, sub, iconBg, icon, valueStyle }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      </div>
      <div className="stat-value" style={valueStyle}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}
