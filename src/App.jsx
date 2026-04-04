import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useContacts }    from './hooks/useContacts'
import { useDeals }       from './hooks/useDeals'
import { useTasks }       from './hooks/useTasks'
import { useInstructors } from './hooks/useInstructors'
import { useStudents }    from './hooks/useStudents'
import { useLeads }       from './hooks/useLeads'
import { useFinance }     from './hooks/useFinance'
import { useClasses }     from './hooks/useClasses'
import { useActivities }  from './hooks/useActivities'
import { useAgent }       from './hooks/useAgent'
import { STAGES }         from './constants'
import Sidebar, { MobileBottomNav } from './components/Sidebar'
import Dashboard            from './components/pages/Dashboard'
import ContactsPage         from './components/pages/ContactsPage'
import TasksPage            from './components/pages/TasksPage'
import InstructorsPage      from './components/pages/InstructorsPage'
import StudentsPage         from './components/pages/StudentsPage'
import SalesPage            from './components/pages/SalesPage'
import FinancialPage        from './components/pages/FinancialPage'
import ClassesPage          from './components/pages/ClassesPage'
import AutomationsPage      from './components/pages/AutomationsPage'
import InvoicesPage         from './components/pages/InvoicesPage'
import { useWorkflows }     from './hooks/useWorkflows'
import { useInvoices }      from './hooks/useInvoices'
import ActivitiesPage       from './components/pages/ActivitiesPage'
import ReportsPage          from './components/pages/ReportsPage'
import AuthScreen           from './components/AuthScreen'
import AgentPanel           from './components/agent/AgentPanel'
import InstructorPortal     from './components/instructor/InstructorPortal'
import ToastContainer       from './components/Toast'
import ErrorBoundary        from './components/ErrorBoundary'

function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : init }
    catch { return init }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key, v])
  return [v, sv]
}

// ── Instructor portal (public, no auth needed) ─────────────────────────────
const urlParams  = new URLSearchParams(window.location.search)
const _portalId  = urlParams.get('portal')
const _portalName = urlParams.get('n')

export default function App() {
  const [page, setPage]       = useState('dashboard')
  const [dark, setDark]       = useLS('crm_darkmode', false)
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [agentOpen, setAgentOpen]     = useState(false)
  const [mobSidebarOpen, setMobSidebarOpen] = useState(false)

  const c  = useContacts()
  const d  = useDeals()
  const t  = useTasks()
  const i  = useInstructors()
  const s  = useStudents()
  const le  = useLeads()
  const fin = useFinance()
  const cls = useClasses()
  const act = useActivities()
  const agent = useAgent()
  const wf    = useWorkflows()
  const inv   = useInvoices()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Ctrl+K → toggle agent panel
  useEffect(() => {
    const fn = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setAgentOpen(o => !o) } }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  // After agent creates items → reload the relevant data so pages update instantly
  useEffect(() => {
    const last = agent.messages[agent.messages.length - 1]
    if (last?.role !== 'agent' || !last.actions?.length) return
    const types = new Set(last.actions.map(a => a.type))
    if (types.has('create_task'))       t.load()
    if (types.has('create_lead'))       le.load()
    if (types.has('create_contact'))    c.load()
    if (types.has('create_deal'))       d.load()
    if (types.has('create_instructor')) i.load()
    if (types.has('create_salary'))     fin.load()
  }, [agent.messages])

  const loadAll = () => {
    c.load(); d.load(); t.load(); i.load(); s.load(); le.load(); fin.load(); cls.load(); act.load(); wf.load(); inv.load()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAll()
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadAll() }
      else {
        c.setContacts([]); d.setDeals([]); t.setTasks([])
        i.setInstructors([]); s.setStudents([]); le.setLeads([])
        fin.setPayments([]); fin.setSalaries([]); cls.setClasses([]); act.setActivities([]); inv.setInvoices([])
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  // Activity logger — optimistic + async persist
  const logAct = (cid, desc) => c.logActivity(cid, desc)

  // Contacts
  const addContact    = async data => { await c.addContact(data) }
  const updateContact = async (id, data) => { await c.editContact(id, data) }
  const deleteContact = async id => {
    c.removeContact(id)
    d.setDeals(p => p.filter(x => x.contactId !== id))
    t.setTasks(p => p.map(x => x.contactId === id ? { ...x, contactId: '' } : x))
    s.setStudents(p => p.map(x => x.contactId === id ? { ...x, contactId: '' } : x))
  }

  // Deals
  const addDeal = async data => {
    const row = await d.addDeal(data)
    if (data.contactId && row) logAct(data.contactId, `נוצרה עסקה: ${data.title}`)
  }
  const updateDeal = async (id, data, prevStage) => {
    await d.editDeal(id, data)
    if (data.contactId && prevStage && prevStage !== data.stage) {
      const st = STAGES.find(x => x.id === data.stage)
      logAct(data.contactId, `עסקה עודכנה: ${data.title} → ${st?.label}`)
    }
  }
  const deleteDeal = async id => { await d.removeDeal(id) }

  // Tasks
  const addTask    = async data => { await t.addTask(data) }
  const updateTask = async (id, data) => { await t.editTask(id, data) }
  const deleteTask = async id => { await t.removeTask(id) }
  const toggleTask = async id => {
    const updated = await t.toggleTask(id)
    if (updated?.completed && updated?.contactId) logAct(updated.contactId, `משימה הושלמה: ${updated.title}`)
  }

  // Instructors
  const addInstructor    = async data => { await i.addInstructor(data) }
  const updateInstructor = async (id, data) => { await i.editInstructor(id, data) }
  const deleteInstructor = async id => { await i.removeInstructor(id) }

  // Students
  const addStudent    = async data => { await s.addStudent(data) }
  const updateStudent = async (id, data) => { await s.editStudent(id, data) }
  const deleteStudent = async id => { await s.removeStudent(id) }

  // Show instructor portal without requiring auth
  if (_portalId) return <InstructorPortal instructorId={_portalId} instructorName={decodeURIComponent(_portalName || '')}/>

  // Only show full-screen loading on initial auth check — NOT on data refreshes
  if (loading) return (
    <div className="app-loading">
      <div className="app-loading-logo">W</div>
      <div className="app-loading-dots">
        <div className="app-loading-dot"/>
        <div className="app-loading-dot"/>
        <div className="app-loading-dot"/>
      </div>
    </div>
  )

  if (!user) return <AuthScreen/>

  const pages = {
    dashboard:   <Dashboard    contacts={c.contacts} deals={d.deals} tasks={t.tasks} instructors={i.instructors} students={s.students} leads={le.leads} classes={cls.classes} activities={act.activities} dark={dark} setPage={setPage}/>,
    sales:       <SalesPage leads={le.leads} onAddLead={le.addLead} onUpdateLead={le.editLead} onMoveStage={le.moveStage} onDeleteLead={le.removeLead} onReloadLeads={le.load} deals={d.deals} contacts={c.contacts} onAddDeal={addDeal} onUpdateDeal={updateDeal} onDeleteDeal={deleteDeal}/>,
    contacts:    <ContactsPage contacts={c.contacts} deals={d.deals} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onReload={c.load}/>,
    tasks:       <TasksPage    tasks={t.tasks} contacts={c.contacts} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} onToggle={toggleTask} onSnooze={t.snoozeTask}/>,
    instructors: <InstructorsPage instructors={i.instructors} contacts={c.contacts} onAdd={addInstructor} onUpdate={updateInstructor} onDelete={deleteInstructor}/>,
    students:    <StudentsPage students={s.students} contacts={c.contacts} onAdd={addStudent} onUpdate={updateStudent} onDelete={deleteStudent}/>,
    classes:     <ClassesPage classes={cls.classes} instructors={i.instructors} contacts={c.contacts} onAdd={cls.addClass} onUpdate={cls.editClass} onDelete={cls.removeClass} onDuplicate={cls.duplicateClass} onReload={cls.load} finance={fin}/>,
    financial:   <FinancialPage fin={fin} instructors={i.instructors} contacts={c.contacts} activities={act.activities} classes={cls.classes} onAddActivity={act.addActivity} onUpdateActivity={act.editActivity} onDeleteActivity={act.removeActivity} onReloadActivities={act.load}/>,
    activities:  <ActivitiesPage activities={act.activities} contacts={c.contacts} onAdd={act.addActivity} onUpdate={act.editActivity} onDelete={act.removeActivity} onReload={act.load}/>,
    reports:     <ReportsPage classes={cls.classes} activities={act.activities} leads={le.leads} contacts={c.contacts} deals={d.deals} dark={dark}/>,
    automations: <AutomationsPage rules={wf.rules} onAdd={wf.addRule} onUpdate={wf.editRule} onDelete={wf.removeRule} onToggle={wf.toggle} onReload={wf.load} tasks={t.tasks} classes={cls.classes}/>,
    invoices:    <InvoicesPage invoiceStore={inv}/>,
  }

  return (
    <div className="app">
      {/* Mobile backdrop */}
      <div className={`mob-backdrop ${mobSidebarOpen ? 'show' : ''}`} onClick={() => setMobSidebarOpen(false)}/>

      <Sidebar
        page={page} setPage={setPage}
        tasks={t.tasks} instructors={i.instructors} students={s.students} deals={d.deals} leads={le.leads}
        dark={dark} setDark={setDark}
        user={user} signOut={signOut}
        mobOpen={mobSidebarOpen} setMobOpen={setMobSidebarOpen}
      />
      <main className="main">
        <ErrorBoundary key={page}>
          <div key={page} className="page-enter">
            {pages[page] || pages.dashboard}
          </div>
        </ErrorBoundary>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav
        page={page} setPage={setPage}
        tasks={t.tasks} leads={le.leads}
        onMore={() => setMobSidebarOpen(o => !o)}
      />

      <AgentPanel
        open={agentOpen}
        onToggle={() => setAgentOpen(o => !o)}
        contacts={c.contacts}
        instructors={i.instructors}
        tasks={t.tasks}
        deals={d.deals}
        leads={le.leads}
        students={s.students}
        classes={cls.classes}
        finance={fin}
        activities={act.activities}
        agent={agent}
      />
      <ToastContainer/>
    </div>
  )
}
