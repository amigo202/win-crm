import { supabase } from '../lib/supabase'
import JSZip from 'jszip'

// ── Categories ────────────────────────────────────────────────────
export const INVOICE_CATEGORIES = [
  'משרד וציוד',
  'שיווק ופרסום',
  'תחבורה ונסיעות',
  'מזון ואירוח',
  'שירותים מקצועיים',
  'תוכנה ומנויים',
  'תחזוקה ותיקונים',
  'שכירות',
  'חשמל ומים',
  'ביטוח',
  'ציוד ומכשור',
  'הדרכה והשתלמות',
  'אחר',
]

export const CATEGORY_COLORS = {
  'משרד וציוד':         '#6366f1',
  'שיווק ופרסום':       '#ec4899',
  'תחבורה ונסיעות':     '#f59e0b',
  'מזון ואירוח':        '#10b981',
  'שירותים מקצועיים':   '#3b82f6',
  'תוכנה ומנויים':      '#8b5cf6',
  'תחזוקה ותיקונים':    '#f97316',
  'שכירות':             '#ef4444',
  'חשמל ומים':          '#06b6d4',
  'ביטוח':              '#84cc16',
  'ציוד ומכשור':        '#14b8a6',
  'הדרכה והשתלמות':     '#f43f5e',
  'אחר':                '#94a3b8',
}

// ── DB mapping ────────────────────────────────────────────────────
export function fromDbInvoice(r) {
  return {
    id:             r.id,
    ownerId:        r.owner_id,
    vendor:         r.vendor        || '',
    invoiceNumber:  r.invoice_number || '',
    invoiceDate:    r.invoice_date   || null,
    amount:         Number(r.amount       || 0),
    vatAmount:      Number(r.vat_amount   || 0),
    totalAmount:    Number(r.total_amount || 0),
    category:       r.category  || 'אחר',
    month:          r.month,
    year:           r.year,
    description:    r.description || '',
    source:         r.source      || 'upload',
    emailMessageId: r.email_message_id || null,
    imageUrl:       r.image_url   || null,
    status:         r.status      || 'pending',
    notes:          r.notes       || '',
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  }
}

function toDbInvoice(inv) {
  return {
    vendor:          inv.vendor         || null,
    invoice_number:  inv.invoiceNumber  || null,
    invoice_date:    inv.invoiceDate    || null,
    amount:          Number(inv.amount)      || null,
    vat_amount:      Number(inv.vatAmount)   || null,
    total_amount:    Number(inv.totalAmount) || null,
    category:        inv.category       || 'אחר',
    month:           Number(inv.month)  || null,
    year:            Number(inv.year)   || null,
    description:     inv.description   || null,
    source:          inv.source         || 'upload',
    email_message_id: inv.emailMessageId || null,
    image_url:       inv.imageUrl       || null,
    status:          inv.status         || 'pending',
    notes:           inv.notes          || null,
  }
}

// ── CRUD ──────────────────────────────────────────────────────────
export async function fetchInvoices({ month, year, category, status } = {}) {
  let q = supabase.from('invoices').select('*').order('invoice_date', { ascending: false })
  if (month)    q = q.eq('month', month)
  if (year)     q = q.eq('year', year)
  if (category) q = q.eq('category', category)
  if (status)   q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data.map(fromDbInvoice)
}

export async function fetchAllInvoices({ year } = {}) {
  let q = supabase.from('invoices').select('*').order('invoice_date', { ascending: false })
  if (year) q = q.eq('year', year)
  const { data, error } = await q
  if (error) throw error
  return data.map(fromDbInvoice)
}

export async function createInvoice(data) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = { ...toDbInvoice(data), owner_id: user.id }
  const { data: row, error } = await supabase
    .from('invoices').insert(payload).select().single()
  if (error) throw error
  return fromDbInvoice(row)
}

export async function updateInvoice(id, data) {
  const { error } = await supabase
    .from('invoices').update(toDbInvoice(data)).eq('id', id)
  if (error) throw error
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

// ── File Upload ───────────────────────────────────────────────────
export async function uploadInvoiceImage(file) {
  const { data: { user } } = await supabase.auth.getUser()
  const now    = new Date()
  const year   = now.getFullYear()
  const month  = String(now.getMonth() + 1).padStart(2, '0')
  const ext    = file.name.split('.').pop() || 'jpg'
  const uuid   = crypto.randomUUID()
  const path   = `${user.id}/${year}/${month}/${uuid}.${ext}`

  const { error } = await supabase.storage
    .from('invoices')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('invoices').getPublicUrl(path)
  return publicUrl
}

// ── AI Extraction ─────────────────────────────────────────────────
export async function processInvoiceImage(fileOrBase64, mimeType) {
  let base64
  if (typeof fileOrBase64 === 'string') {
    base64 = fileOrBase64
  } else {
    // Convert File to base64
    base64 = await fileToBase64(fileOrBase64)
    mimeType = fileOrBase64.type || mimeType
  }

  const { data, error } = await supabase.functions.invoke('process-invoice', {
    body: { imageBase64: base64, mimeType: mimeType || 'image/jpeg' }
  })
  if (error) throw error
  return data
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Gmail Scan ────────────────────────────────────────────────────
export async function scanGmail() {
  const { data, error } = await supabase.functions.invoke('scan-gmail', {
    body: {}
  })
  if (error) throw error
  return data
}

// ── ZIP Batch Import ──────────────────────────────────────────────
export async function importFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile)
  const SUPPORTED = /\.(pdf|jpg|jpeg|png|webp)$/i

  const files = Object.values(zip.files).filter(f => !f.dir && SUPPORTED.test(f.name))
  if (files.length === 0) throw new Error('לא נמצאו קבצי PDF או תמונה ב-ZIP')

  const results = []

  for (const f of files) {
    try {
      const arrayBuf = await f.async('arraybuffer')
      // btoa with large buffers — use chunk approach to avoid call-stack limit
      const bytes   = new Uint8Array(arrayBuf)
      let binary    = ''
      const CHUNK   = 8192
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
      }
      const base64   = btoa(binary)
      const nameLow  = f.name.toLowerCase()
      const mimeType = nameLow.endsWith('.pdf') ? 'application/pdf'
                     : nameLow.endsWith('.png') ? 'image/png'
                     : nameLow.endsWith('.webp') ? 'image/webp'
                     : 'image/jpeg'
      const extracted = await processInvoiceImage(base64, mimeType)
      results.push({ filename: f.name, extracted, selected: true, error: null })
    } catch (e) {
      results.push({ filename: f.name, extracted: null, selected: false, error: e.message })
    }
  }

  return results // [{ filename, extracted, selected, error }]
}

// ── CSV Export ────────────────────────────────────────────────────
export function exportInvoicesCSV(invoices, filename = 'חשבוניות.csv') {
  const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

  const headers = ['תאריך','ספק','מספר חשבונית','קטגוריה','לפני מע"מ','מע"מ','סה"כ','תיאור','מקור','סטטוס']
  const rows = invoices.map(inv => [
    inv.invoiceDate || '',
    inv.vendor      || '',
    inv.invoiceNumber || '',
    inv.category    || '',
    inv.amount      || '0',
    inv.vatAmount   || '0',
    inv.totalAmount || '0',
    inv.description || '',
    inv.source === 'email' ? 'מייל' : inv.source === 'camera' ? 'צילום' : 'העלאה',
    inv.status === 'verified' ? 'אושר' : 'ממתין',
  ])

  const bom = '\uFEFF' // UTF-8 BOM for Excel Hebrew support
  const csv = bom + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
