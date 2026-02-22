import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useContacts }    from './hooks/useContacts'
import { useDeals }       from './hooks/useDeals'
import { useTasks }       from './hooks/useTasks'
import { useInstructors } from './hooks/useInstructors'
import { useStudents }    from './hooks/useStudents'
import { STAGES }         from './constants'
import Sidebar            from './components/Sidebar'
import Dashboard          from './components/pages/Dashboard'
import ContactsPage       from './components/pages/ContactsPage'
import DealsPage          from './components/pages/DealsPage'
import TasksPage          from './components/pages/TasksPage'
import InstructorsPage    from './components/pages/InstructorsPage'
import StudentsPage       from './components/pages/StudentsPage'
import AuthScreen         from './components/AuthScreen'

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

export default function App() {
  const [page, setPage]   = useState('dashboard')
  const [dark, setDark]   = useLS('crm_darkmode', false)
  const [user, setUser]   = useState(null)
  const [loading, setLoading] = useState(true)

  const c = useContacts()
  const d = useDeals()
  const t = useTasks()
  const i = useInstructors()
  const s = useStudents()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const loadAll = () => {
    c.load(); d.load(); t.load(); i.load(); s.load()
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
        i.setInstructors([]); s.setStudents([])
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

  const isLoading = loading || c.loading || d.loading || t.loading || i.loading || s.loading

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', flexDirection: 'column', gap: '14px', fontFamily: "'Rubik','Segoe UI',Arial,sans-serif" }}>
      <div style={{ width: '52px', height: '52px', background: '#f97316', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '800', color: '#fff' }}>W</div>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>טוען...</p>
    </div>
  )

  if (!user) return <AuthScreen/>

  const pages = {
    dashboard:   <Dashboard    contacts={c.contacts} deals={d.deals} tasks={t.tasks} instructors={i.instructors} students={s.students} dark={dark}/>,
    contacts:    <ContactsPage contacts={c.contacts} deals={d.deals} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact}/>,
    deals:       <DealsPage    deals={d.deals} contacts={c.contacts} onAdd={addDeal} onUpdate={updateDeal} onDelete={deleteDeal}/>,
    tasks:       <TasksPage    tasks={t.tasks} contacts={c.contacts} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} onToggle={toggleTask}/>,
    instructors: <InstructorsPage instructors={i.instructors} contacts={c.contacts} onAdd={addInstructor} onUpdate={updateInstructor} onDelete={deleteInstructor}/>,
    students:    <StudentsPage students={s.students} contacts={c.contacts} onAdd={addStudent} onUpdate={updateStudent} onDelete={deleteStudent}/>,
  }

  return (
    <div className="app">
      <Sidebar
        page={page} setPage={setPage}
        tasks={t.tasks} instructors={i.instructors} students={s.students} deals={d.deals}
        dark={dark} setDark={setDark}
        user={user} signOut={signOut}
      />
      <main className="main">{pages[page] || pages.dashboard}</main>
    </div>
  )
}
