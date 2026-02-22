import { useState, useCallback } from 'react'
import {
  fetchContacts, createContact, updateContact, deleteContact, appendActivity,
} from '../services/contactsService'

export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setContacts(await fetchContacts()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const addContact = useCallback(async data => {
    const row = await createContact(data)
    setContacts(p => [row, ...p])
    return row
  }, [])

  const editContact = useCallback(async (id, data) => {
    setContacts(p => p.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
    await updateContact(id, data)
  }, [])

  const removeContact = useCallback(async id => {
    setContacts(p => p.filter(c => c.id !== id))
    await deleteContact(id)
  }, [])

  const logActivity = useCallback(async (contactId, desc) => {
    if (!contactId) return
    const act = { id: crypto.randomUUID(), desc, date: new Date().toISOString() }
    setContacts(p => p.map(c =>
      c.id === contactId ? { ...c, activities: [...(c.activities || []), act] } : c
    ))
    await appendActivity(contactId, act)
  }, [])

  return { contacts, setContacts, loading, error, load, addContact, editContact, removeContact, logActivity }
}
