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
import DealsPage            from './components/pages/DealsPage'
import TasksPage            from './components/pages/TasksPage'
import InstructorsPage      from './components/pages/InstructorsPage'
import StudentsPage         from './components/pages/StudentsPage'
import LeadsPipelinePage    from './components/pages/LeadsPipelinePage'
import FinancePage          from './components/pages/FinancePage'
import ClassesPage          from './components/pages/ClassesPage'
import ActivitiesPage       from './components/pages/ActivitiesPage'
import AuthScreen           from './components/AuthScreen'
import AgentPanel           from './components/agent/AgentPanel'
import InstructorPortal     from './components/instructor/InstructorPortal'
import ToastContainer       from './components/Toast'

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
    c.load(); d.load(); t.load(); i.load(); s.load(); le.load(); fin.load(); cls.load(); act.load()
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
        fin.setPayments([]); fin.setSalaries([]); cls.setClasses([]); act.setActivities([])
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', flexDirection: 'column', gap: '14px', fontFamily: "'Rubik','Segoe UI',Arial,sans-serif" }}>
      <div style={{ width: '52px', height: '52px', background: '#f97316', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '800', color: '#fff' }}>W</div>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>טוען...</p>
    </div>
  )

  if (!user) return <AuthScreen/>

  const pages = {
    dashboard:   <Dashboard    contacts={c.contacts} deals={d.deals} tasks={t.tasks} instructors={i.instructors} students={s.students} leads={le.leads} classes={cls.classes} activities={act.activities} dark={dark} setPage={setPage}/>,
    leads:       <LeadsPipelinePage leads={le.leads} onAdd={le.addLead} onUpdate={le.editLead} onMoveStage={le.moveStage} onDelete={le.removeLead} onReload={le.load}/>,
    contacts:    <ContactsPage contacts={c.contacts} deals={d.deals} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onReload={c.load}/>,
    deals:       <DealsPage    deals={d.deals} contacts={c.contacts} onAdd={addDeal} onUpdate={updateDeal} onDelete={deleteDeal}/>,
    tasks:       <TasksPage    tasks={t.tasks} contacts={c.contacts} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} onToggle={toggleTask} onSnooze={t.snoozeTask}/>,
    instructors: <InstructorsPage instructors={i.instructors} contacts={c.contacts} onAdd={addInstructor} onUpdate={updateInstructor} onDelete={deleteInstructor}/>,
    students:    <StudentsPage students={s.students} contacts={c.contacts} onAdd={addStudent} onUpdate={updateStudent} onDelete={deleteStudent}/>,
    finance:     <FinancePage fin={fin} instructors={i.instructors} contacts={c.contacts}/>,
    classes:     <ClassesPage classes={cls.classes} instructors={i.instructors} contacts={c.contacts} onAdd={cls.addClass} onUpdate={cls.editClass} onDelete={cls.removeClass} onDuplicate={cls.duplicateClass} onReload={cls.load} finance={fin}/>,
    activities:  <ActivitiesPage activities={act.activities} contacts={c.contacts} onAdd={act.addActivity} onUpdate={act.editActivity} onDelete={act.removeActivity} onReload={act.load}/>,
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
      <main className="main">{pages[page] || pages.dashboard}</main>

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
        agent={agent}
      />
      <ToastContainer/>
    </div>
  )
}
