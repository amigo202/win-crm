import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Contacts from './components/Contacts'
import Deals from './components/Deals'
import Tasks from './components/Tasks'

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])

  return [value, setValue]
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [contacts, setContacts] = useLocalStorage('crm_contacts', [])
  const [deals, setDeals]       = useLocalStorage('crm_deals', [])
  const [tasks, setTasks]       = useLocalStorage('crm_tasks', [])

  // Contacts CRUD
  const addContact = (data) =>
    setContacts(prev => [...prev, { ...data, id: generateId(), createdAt: new Date().toISOString() }])

  const importContacts = (dataArray) =>
    setContacts(prev => [
      ...prev,
      ...dataArray.map(data => ({ ...data, id: generateId(), createdAt: new Date().toISOString() }))
    ])

  const updateContact = (id, data) =>
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))

  const deleteContact = (id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    setDeals(prev => prev.filter(d => d.contactId !== id))
    setTasks(prev => prev.map(t => t.contactId === id ? { ...t, contactId: '' } : t))
  }

  // Deals CRUD
  const addDeal = (data) =>
    setDeals(prev => [...prev, { ...data, id: generateId(), createdAt: new Date().toISOString() }])

  const updateDeal = (id, data) =>
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d))

  const deleteDeal = (id) =>
    setDeals(prev => prev.filter(d => d.id !== id))

  // Tasks CRUD
  const addTask = (data) =>
    setTasks(prev => [...prev, { ...data, id: generateId(), completed: false, createdAt: new Date().toISOString() }])

  const updateTask = (id, data) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))

  const deleteTask = (id) =>
    setTasks(prev => prev.filter(t => t.id !== id))

  const toggleTask = (id) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))

  const sharedProps = {
    contacts, deals, tasks,
    onAddContact: addContact, onUpdateContact: updateContact, onDeleteContact: deleteContact, onImportContacts: importContacts,
    onAddDeal: addDeal,       onUpdateDeal: updateDeal,       onDeleteDeal: deleteDeal,
    onAddTask: addTask,       onUpdateTask: updateTask,       onDeleteTask: deleteTask,
    onToggleTask: toggleTask,
  }

  const pages = { dashboard: Dashboard, contacts: Contacts, deals: Deals, tasks: Tasks }
  const CurrentPage = pages[page]

  return (
    <div className="app">
      <Sidebar currentPage={page} onNavigate={setPage} tasks={tasks} />
      <main className="main-content">
        <CurrentPage {...sharedProps} />
      </main>
    </div>
  )
}
