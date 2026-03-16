import { useState, useCallback } from 'react'
import {
  fetchAllInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  uploadInvoiceImage,
  processInvoiceImage,
  scanGmailEmails,
  processGmailEmails,
  exportInvoicesCSV,
  importFromZip,
} from '../services/invoicesService'

export function useInvoices() {
  const now  = new Date()
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [processing, setProcessing] = useState(false)
  const [year, setYear]           = useState(now.getFullYear())

  // ── Load ───────────────────────────────────────────────────────
  const load = useCallback(async (y) => {
    setLoading(true)
    try {
      const targetYear = y ?? now.getFullYear()
      const data = await fetchAllInvoices({ year: targetYear })
      setInvoices(data)
    } catch (e) {
      console.error('[useInvoices] load error:', e?.message ?? e)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── CRUD ───────────────────────────────────────────────────────
  const addInvoice = useCallback(async data => {
    const row = await createInvoice(data)
    setInvoices(prev => [row, ...prev])
    return row
  }, [])

  const editInvoice = useCallback(async (id, data) => {
    await updateInvoice(id, data)
    setInvoices(prev => prev.map(x => x.id === id ? { ...x, ...data } : x))
  }, [])

  const removeInvoice = useCallback(async id => {
    await deleteInvoice(id)
    setInvoices(prev => prev.filter(x => x.id !== id))
  }, [])

  // ── Image processing ───────────────────────────────────────────
  // Returns extracted draft data (does NOT save to DB yet)
  const processImage = useCallback(async file => {
    setProcessing(true)
    try {
      // 1. Upload to Supabase Storage
      const imageUrl = await uploadInvoiceImage(file)
      // 2. AI extraction via Gemini
      const extracted = await processInvoiceImage(file, file.type)
      return { ...extracted, imageUrl, source: 'upload' }
    } finally {
      setProcessing(false)
    }
  }, [])

  // Camera capture uses same flow (File from input)
  const processCamera = useCallback(async file => {
    setProcessing(true)
    try {
      const imageUrl  = await uploadInvoiceImage(file)
      const extracted = await processInvoiceImage(file, file.type)
      return { ...extracted, imageUrl, source: 'camera' }
    } finally {
      setProcessing(false)
    }
  }, [])

  // ── ZIP batch import ───────────────────────────────────────────
  // Returns array of { filename, extracted, selected, error } for review modal
  const importZip = useCallback(async (zipFile) => {
    setProcessing(true)
    try {
      return await importFromZip(zipFile)
    } finally {
      setProcessing(false)
    }
  }, [])

  // ── Gmail scan — Phase 1: fast scan, returns email candidates ───
  const scanEmails = useCallback(async () => {
    setScanning(true)
    try {
      const result = await scanGmailEmails()
      return result // { emails: [...], total }
    } finally {
      setScanning(false)
    }
  }, [])

  // ── Gmail scan — Phase 2: process selected message IDs ──────────
  const importGmailEmails = useCallback(async (messageIds) => {
    setProcessing(true)
    try {
      const result = await processGmailEmails(messageIds)
      if (result?.processed > 0) await load(year)
      return result
    } finally {
      setProcessing(false)
    }
  }, [load, year])

  // ── Export ─────────────────────────────────────────────────────
  const exportCSV = useCallback((filtered, filename) => {
    exportInvoicesCSV(filtered || invoices, filename)
  }, [invoices])

  return {
    invoices, setInvoices,
    loading,
    scanning,
    processing,
    year, setYear,
    load,
    addInvoice,
    editInvoice,
    removeInvoice,
    processImage,
    processCamera,
    importZip,
    scanEmails,
    importGmailEmails,
    exportCSV,
  }
}
