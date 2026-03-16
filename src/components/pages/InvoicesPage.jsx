import { useState, useMemo, useRef, useEffect } from 'react'
import { INVOICE_CATEGORIES, CATEGORY_COLORS } from '../../services/invoicesService'
import { getGmailAuthUrl, exchangeCode } from '../../services/googleCalendarService'
import { toast, toast_ok, toast_err } from '../Toast'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

const fmtShekel = n => (Number(n) || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
const fmtDate   = d => d ? new Date(d).toLocaleDateString('he-IL') : '—'
const srcLabel  = s => s === 'email' ? '📧 מייל' : s === 'camera' ? '📷 צילום' : '📎 העלאה'

// ── Verification / Edit Modal ─────────────────────────────────────
function InvoiceModal({ invoice, onSave, onClose }) {
  const [form, setForm] = useState({
    vendor:        invoice?.vendor        || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    invoiceDate:   invoice?.invoiceDate   || new Date().toISOString().split('T')[0],
    amount:        invoice?.amount        || '',
    vatAmount:     invoice?.vatAmount     || '',
    totalAmount:   invoice?.totalAmount   || '',
    category:      invoice?.category      || 'אחר',
    description:   invoice?.description   || '',
    notes:         invoice?.notes         || '',
    status:        invoice?.status        || 'pending',
    imageUrl:      invoice?.imageUrl      || null,
    source:        invoice?.source        || 'upload',
    month:         invoice?.month         || (new Date().getMonth() + 1),
    year:          invoice?.year          || new Date().getFullYear(),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fill month/year from date
  const handleDateChange = v => {
    set('invoiceDate', v)
    if (v) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        set('month', d.getMonth() + 1)
        set('year',  d.getFullYear())
      }
    }
  }

  // Auto-calculate totals
  const handleAmountChange = v => {
    set('amount', v)
    const vat = Math.round(Number(v) * 0.17 * 100) / 100
    set('vatAmount',   vat)
    set('totalAmount', Math.round((Number(v) + vat) * 100) / 100)
  }

  const INP = {
    background: 'var(--surface)', border: '1px solid var(--border, #334155)',
    borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'rtl',
  }
  const LBL = { fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'block' }
  const GRP = { display: 'flex', flexDirection: 'column', gap: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{invoice?.id ? 'עריכת חשבונית' : 'חשבונית חדשה'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Image preview */}
        {form.imageUrl && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', maxHeight: 200, textAlign: 'center', background: 'var(--bg)' }}>
            <img src={form.imageUrl} alt="חשבונית" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}/>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ ...GRP, gridColumn: '1/-1' }}>
            <label style={LBL}>שם ספק *</label>
            <input style={INP} value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="שם החברה / הספק"/>
          </div>

          <div style={GRP}>
            <label style={LBL}>מספר חשבונית</label>
            <input style={INP} value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} placeholder="12345"/>
          </div>

          <div style={GRP}>
            <label style={LBL}>תאריך</label>
            <input style={INP} type="date" value={form.invoiceDate} onChange={e => handleDateChange(e.target.value)}/>
          </div>

          <div style={GRP}>
            <label style={LBL}>סכום לפני מע"מ ₪</label>
            <input style={INP} type="number" value={form.amount} onChange={e => handleAmountChange(e.target.value)} placeholder="100"/>
          </div>

          <div style={GRP}>
            <label style={LBL}>מע"מ ₪</label>
            <input style={INP} type="number" value={form.vatAmount} onChange={e => set('vatAmount', e.target.value)} placeholder="17"/>
          </div>

          <div style={{ ...GRP, gridColumn: '1/-1' }}>
            <label style={LBL}>סה"כ לתשלום ₪ *</label>
            <input style={{ ...INP, border: '2px solid var(--accent)', fontWeight: 700, fontSize: 16 }} type="number" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} placeholder="117"/>
          </div>

          <div style={{ ...GRP, gridColumn: '1/-1' }}>
            <label style={LBL}>קטגוריה</label>
            <select style={INP} value={form.category} onChange={e => set('category', e.target.value)}>
              {INVOICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ ...GRP, gridColumn: '1/-1' }}>
            <label style={LBL}>תיאור / פירוט</label>
            <textarea style={{ ...INP, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="תיאור השירות או המוצר"/>
          </div>

          <div style={GRP}>
            <label style={LBL}>סטטוס</label>
            <select style={INP} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">ממתין לאישור</option>
              <option value="verified">אושר ✓</option>
            </select>
          </div>

          <div style={GRP}>
            <label style={LBL}>הערות</label>
            <input style={INP} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערה אופציונלית"/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>ביטול</button>
          <button onClick={() => onSave(form)} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>שמור חשבונית</button>
        </div>
      </div>
    </div>
  )
}

// ── Upload Zone Modal ─────────────────────────────────────────────
function UploadModal({ onFile, onCamera, onClose, processing }) {
  const fileRef   = useRef()
  const cameraRef = useRef()

  const handleFile = e => {
    const files = e.target.files
    if (files?.length > 0) onFile(files[0])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, direction: 'rtl', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>הוסף חשבונית</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 24px' }}>העלה תמונה, PDF, או צלם עם המצלמה</p>

        {processing ? (
          <div style={{ padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
            <p>ה-AI מנתח את החשבונית...</p>
          </div>
        ) : (
          <>
            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#f97316' }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.style.borderColor = 'var(--border)'
                const file = e.dataTransfer.files?.[0]
                if (file) onFile(file)
              }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 20px',
                cursor: 'pointer', marginBottom: 16, transition: 'border-color .2s',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>גרור קובץ לכאן</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>JPG, PNG, PDF</div>
            </div>

            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFile}/>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile}/>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                📂 בחר קובץ
              </button>
              <button onClick={() => cameraRef.current?.click()} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                📷 צלם
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── View Invoice Modal ────────────────────────────────────────────
function ViewModal({ invoice, onClose, onEdit, onVerify }) {
  const color = CATEGORY_COLORS[invoice.category] || '#94a3b8'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{invoice.vendor || 'ספק לא ידוע'}</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{invoice.invoiceNumber ? `מס׳ ${invoice.invoiceNumber}` : ''} · {fmtDate(invoice.invoiceDate)}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {invoice.imageUrl && (
          <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16, textAlign: 'center', background: 'var(--bg)', maxHeight: 280 }}>
            <img src={invoice.imageUrl} alt="חשבונית" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}/>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'לפני מע"מ', value: fmtShekel(invoice.amount) },
            { label: 'מע"מ',      value: fmtShekel(invoice.vatAmount) },
            { label: 'סה"כ',      value: fmtShekel(invoice.totalAmount), big: true },
          ].map(({ label, value, big }) => (
            <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: big ? 18 : 14, fontWeight: big ? 700 : 500, color: big ? '#f97316' : 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <span style={{ background: color + '22', color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{invoice.category}</span>
          <span style={{ background: 'var(--bg)', color: 'var(--muted)', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{srcLabel(invoice.source)}</span>
          {invoice.month && <span style={{ background: 'var(--bg)', color: 'var(--muted)', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{MONTHS_HE[invoice.month - 1]} {invoice.year}</span>}
          <span style={{ background: invoice.status === 'verified' ? '#10b98122' : '#f9731622', color: invoice.status === 'verified' ? '#10b981' : '#f97316', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            {invoice.status === 'verified' ? '✓ אושר' : '⏳ ממתין'}
          </span>
        </div>

        {invoice.description && <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{invoice.description}</p>}
        {invoice.notes && <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>💬 {invoice.notes}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {invoice.status !== 'verified' && (
            <button onClick={() => onVerify(invoice.id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ✓ אשר חשבונית
            </button>
          )}
          <button onClick={() => onEdit(invoice)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ✏️ ערוך
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Batch ZIP Import Modal ─────────────────────────────────────────
function BatchImportModal({ results, onSave, onClose }) {
  const [items, setItems] = useState(() =>
    results.map((r, i) => ({ ...r, _key: i, editing: false }))
  )
  const [editIdx, setEditIdx] = useState(null)

  const toggle = (i) => setItems(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))

  const selectedItems = items.filter(x => x.selected && x.extracted)
  const fmtAmt = v => v ? `₪${Number(v).toLocaleString('he-IL')}` : '—'

  // Inline editing of a single result
  const [editForm, setEditForm] = useState(null)
  const openEdit = (i) => {
    const ext = items[i].extracted || {}
    setEditForm({
      idx: i,
      vendor:        ext.vendor         || '',
      invoiceNumber: ext.invoice_number || '',
      invoiceDate:   ext.invoice_date   || new Date().toISOString().split('T')[0],
      amount:        ext.amount         || '',
      vatAmount:     ext.vat_amount     || '',
      totalAmount:   ext.total_amount   || '',
      category:      ext.category       || 'אחר',
      description:   ext.description   || '',
    })
  }
  const saveEdit = () => {
    if (!editForm) return
    setItems(prev => prev.map((x, j) => {
      if (j !== editForm.idx) return x
      return {
        ...x,
        selected: true,
        extracted: {
          vendor:          editForm.vendor,
          invoice_number:  editForm.invoiceNumber,
          invoice_date:    editForm.invoiceDate,
          amount:          Number(editForm.amount)      || null,
          vat_amount:      Number(editForm.vatAmount)   || null,
          total_amount:    Number(editForm.totalAmount) || null,
          category:        editForm.category,
          description:     editForm.description,
        }
      }
    }))
    setEditForm(null)
  }

  const inp = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const sel = { ...inp, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>📦 יבוא חשבוניות מ-ZIP <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>({results.length} קבצים)</span></h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Inline edit form */}
        {editForm && (
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 16, border: '2px solid #7c3aed' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>✏️ עריכת: {items[editForm.idx]?.filename}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'ספק', key: 'vendor' },
                { label: 'מספר חשבונית', key: 'invoiceNumber' },
                { label: 'תאריך', key: 'invoiceDate', type: 'date' },
                { label: 'לפני מע"מ', key: 'amount', type: 'number' },
                { label: 'מע"מ', key: 'vatAmount', type: 'number' },
                { label: 'סה"כ', key: 'totalAmount', type: 'number' },
                { label: 'תיאור', key: 'description' },
              ].map(({ label, key, type = 'text' }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                  <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>קטגוריה</div>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={sel}>
                  {INVOICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditForm(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>ביטול</button>
              <button onClick={saveEdit} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>שמור עריכה</button>
            </div>
          </div>
        )}

        {/* Results list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {items.map((item, i) => (
            <div key={item._key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: item.error ? '#ef444411' : item.selected ? 'var(--bg)' : 'transparent', border: '1px solid var(--border)', opacity: item.error ? 0.7 : 1 }}>
              {/* Checkbox */}
              <input type="checkbox" checked={!!item.selected} disabled={!!item.error} onChange={() => toggle(i)} style={{ width: 16, height: 16, cursor: item.error ? 'not-allowed' : 'pointer', flexShrink: 0 }} />

              {/* Filename */}
              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 140, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={item.filename}>
                📄 {item.filename}
              </span>

              {item.error ? (
                <span style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>⚠️ שגיאה: {item.error}</span>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.extracted?.vendor || '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 70 }}>{fmtAmt(item.extracted?.total_amount)}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 90, textAlign: 'center' }}>{item.extracted?.category || ''}</span>
                  <button onClick={() => openEdit(i)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✏️</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>{selectedItems.length} מתוך {results.length} נבחרו לשמירה</span>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>ביטול</button>
          <button disabled={selectedItems.length === 0} onClick={() => onSave(selectedItems)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: selectedItems.length ? '#7c3aed' : '#94a3b8', color: '#fff', cursor: selectedItems.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            💾 שמור {selectedItems.length} חשבוניות
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function InvoicesPage({ invoiceStore }) {
  const {
    invoices, loading, scanning, processing,
    year, setYear, load,
    addInvoice, editInvoice, removeInvoice,
    processImage, processCamera, importZip, scanEmails, exportCSV,
  } = invoiceStore

  const now = new Date()
  const [tab,         setTab]         = useState('all')
  const [filterMonth, setFilterMonth] = useState(0)  // 0 = all months
  const [filterCat,   setFilterCat]   = useState('')
  const [filterStatus,setFilterStatus]= useState('')
  const [search,      setSearch]      = useState('')
  const [showUpload,  setShowUpload]  = useState(false)
  const [editingInv,  setEditingInv]  = useState(null)   // invoice being edited
  const [draftInv,    setDraftInv]    = useState(null)   // AI-extracted draft
  const [viewInv,     setViewInv]     = useState(null)   // invoice being viewed
  const [gmailConnected, setGmailConnected] = useState(false)
  const [exportFrom,  setExportFrom]  = useState(`${now.getFullYear()}-01-01`)
  const [exportTo,    setExportTo]    = useState(`${now.getFullYear()}-12-31`)
  const [batchResults,setBatchResults]= useState(null)  // ZIP import results
  const zipInputRef = useRef()

  // Load on mount
  useEffect(() => { load(year) }, [year])

  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const state  = params.get('state')
    if (code && state === 'gmail_connect') {
      exchangeCode(code).then(() => {
        setGmailConnected(true)
        toast_ok('Gmail חובר בהצלחה! 📧')
        window.history.replaceState({}, '', window.location.pathname)
      }).catch(() => toast_err('שגיאה בחיבור Gmail'))
    }
  }, [])

  // ── Filtered / derived data ──────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...invoices]
    if (filterMonth) list = list.filter(x => x.month === filterMonth)
    if (filterCat)   list = list.filter(x => x.category === filterCat)
    if (filterStatus) list = list.filter(x => x.status === filterStatus)
    if (search)      list = list.filter(x =>
      (x.vendor || '').includes(search) ||
      (x.description || '').includes(search) ||
      (x.invoiceNumber || '').includes(search)
    )
    return list
  }, [invoices, filterMonth, filterCat, filterStatus, search])

  const totalAmount  = filtered.reduce((s, x) => s + (x.totalAmount || 0), 0)
  const totalVAT     = filtered.reduce((s, x) => s + (x.vatAmount   || 0), 0)
  const avgPerMonth  = useMemo(() => {
    if (!invoices.length) return 0
    const months = new Set(invoices.map(x => `${x.year}-${x.month}`)).size
    return invoices.reduce((s, x) => s + (x.totalAmount || 0), 0) / Math.max(months, 1)
  }, [invoices])

  // By category
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach(inv => {
      const cat = inv.category || 'אחר'
      if (!map[cat]) map[cat] = { count: 0, total: 0, invoices: [] }
      map[cat].count++
      map[cat].total += inv.totalAmount || 0
      map[cat].invoices.push(inv)
    })
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total)
  }, [filtered])

  // By month
  const byMonth = useMemo(() => {
    const map = {}
    filtered.forEach(inv => {
      const key = `${inv.year || year}-${String(inv.month || 0).padStart(2,'0')}`
      if (!map[key]) map[key] = { month: inv.month, year: inv.year, count: 0, total: 0 }
      map[key].count++
      map[key].total += inv.totalAmount || 0
    })
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0])).map(([,v]) => v)
  }, [filtered, year])

  // ── Handlers ─────────────────────────────────────────────────
  const handleFile = async file => {
    try {
      const draft = await processImage(file)
      setShowUpload(false)
      setDraftInv({ ...draft, id: null })
    } catch (e) {
      toast_err('שגיאה בעיבוד הקובץ: ' + (e.message || e))
    }
  }

  const handleSaveDraft = async form => {
    try {
      await addInvoice(form)
      setDraftInv(null)
      toast_ok('החשבונית נשמרה בהצלחה ✓')
    } catch (e) {
      toast_err('שגיאה בשמירה: ' + (e.message || e))
    }
  }

  const handleSaveEdit = async form => {
    try {
      await editInvoice(editingInv.id, form)
      setEditingInv(null)
      setViewInv(null)
      toast_ok('החשבונית עודכנה ✓')
    } catch (e) {
      toast_err('שגיאה בעדכון: ' + (e.message || e))
    }
  }

  const handleVerify = async id => {
    try {
      await editInvoice(id, { status: 'verified' })
      setViewInv(null)
      toast_ok('החשבונית אושרה ✓')
    } catch (e) {
      toast_err('שגיאה: ' + (e.message || e))
    }
  }

  const handleDelete = async id => {
    if (!confirm('האם למחוק חשבונית זו?')) return
    try {
      await removeInvoice(id)
      setViewInv(null)
      toast_ok('החשבונית נמחקה')
    } catch (e) {
      toast_err('שגיאה: ' + (e.message || e))
    }
  }

  const handleScan = async () => {
    if (!gmailConnected) {
      try {
        const url = await getGmailAuthUrl()
        window.location.href = url
      } catch (e) {
        toast_err('שגיאה בחיבור Gmail: ' + (e.message || e))
      }
      return
    }
    try {
      const result = await scanEmails()
      if (result?.processed > 0) {
        toast_ok(`נמצאו ${result.processed} חשבוניות חדשות מהמייל! 📧`)
      } else {
        toast('לא נמצאו חשבוניות חדשות במייל', 'warning')
      }
    } catch (e) {
      if (e.message?.includes('needs_auth') || e.message?.includes('not connected')) {
        try {
          const url = await getGmailAuthUrl()
          window.location.href = url
        } catch { toast_err('שגיאה בחיבור Gmail') }
      } else {
        toast_err('שגיאה בסריקת מייל: ' + (e.message || e))
      }
    }
  }

  const handleExportFiltered = () => {
    const from = new Date(exportFrom)
    const to   = new Date(exportTo)
    const filtered = invoices.filter(inv => {
      if (!inv.invoiceDate) return true
      const d = new Date(inv.invoiceDate)
      return d >= from && d <= to
    })
    const months = `${from.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })} – ${to.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })}`
    exportCSV(filtered, `חשבוניות_${year}.csv`)
    toast_ok(`יוצאו ${filtered.length} חשבוניות לייצוא לרו"ח 📊`)
  }

  // ── ZIP batch import ─────────────────────────────────────────
  const handleZip = async (file) => {
    if (!file) return
    toast('⏳ מעבד ZIP — אנא המתן...')
    try {
      const results = await importZip(file)
      setBatchResults(results)
      if (zipInputRef.current) zipInputRef.current.value = ''
    } catch (e) {
      toast_err('שגיאה ביבוא ZIP: ' + (e.message || e))
      if (zipInputRef.current) zipInputRef.current.value = ''
    }
  }

  // ── Styles ────────────────────────────────────────────────────
  const S = {
    page:    { padding: '20px', direction: 'rtl', maxWidth: 1100, margin: '0 auto' },
    header:  { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 20, justifyContent: 'space-between' },
    h1:      { margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
    kpis:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 },
    kpi:     { background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', borderRight: '4px solid var(--accent)' },
    kpiVal:  { fontSize: 20, fontWeight: 700, margin: '4px 0' },
    kpiLbl:  { fontSize: 12, color: 'var(--muted)' },
    tabs:    { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, marginBottom: 20, overflowX: 'auto', flexWrap: 'nowrap' },
    tab:     active => ({ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', background: active ? '#f97316' : 'transparent', color: active ? '#fff' : 'var(--muted)', transition: 'all .2s', fontFamily: 'inherit' }),
    filters: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' },
    sel:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', direction: 'rtl', cursor: 'pointer' },
    inp:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', direction: 'rtl', minWidth: 180 },
    table:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th:      { textAlign: 'right', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
    td:      { padding: '10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
    btn:     (color = '#f97316') => ({ padding: '8px 18px', borderRadius: 9, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }),
    card:    { background: 'var(--surface)', borderRadius: 12, padding: 16 },
    empty:   { textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 },
  }

  const statusBadge = status => ({
    padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: status === 'verified' ? '#10b98122' : '#f9731622',
    color:      status === 'verified' ? '#10b981' : '#f97316',
  })

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>📋 חשבוניות</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={S.sel} value={year} onChange={e => { setYear(Number(e.target.value)); load(Number(e.target.value)) }}>
            {[now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleScan} disabled={scanning} style={S.btn(gmailConnected ? '#3b82f6' : '#64748b')}>
            {scanning ? '⏳ סורק...' : gmailConnected ? '📧 סרוק מייל' : '🔗 חבר Gmail'}
          </button>
          <button onClick={() => zipInputRef.current?.click()} disabled={processing} style={S.btn('#7c3aed')}>
            📦 יבא ZIP
          </button>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            style={{ display: 'none' }}
            onChange={e => handleZip(e.target.files?.[0])}
          />
          <button onClick={() => setShowUpload(true)} style={S.btn('#f97316')}>
            + הוסף חשבונית
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={S.kpis}>
        <div style={{ ...S.kpi, borderRightColor: '#ef4444' }}>
          <div style={S.kpiLbl}>סה"כ הוצאות</div>
          <div style={{ ...S.kpiVal, color: '#ef4444' }}>{fmtShekel(totalAmount)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{filtered.length} חשבוניות</div>
        </div>
        <div style={{ ...S.kpi, borderRightColor: '#f59e0b' }}>
          <div style={S.kpiLbl}>מע"מ לתביעה</div>
          <div style={{ ...S.kpiVal, color: '#f59e0b' }}>{fmtShekel(totalVAT)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>להחזר מרשות המסים</div>
        </div>
        <div style={{ ...S.kpi, borderRightColor: '#3b82f6' }}>
          <div style={S.kpiLbl}>ממוצע חודשי</div>
          <div style={{ ...S.kpiVal, color: '#3b82f6' }}>{fmtShekel(avgPerMonth)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>בכל החשבוניות</div>
        </div>
        <div style={{ ...S.kpi, borderRightColor: '#10b981' }}>
          <div style={S.kpiLbl}>ממתינות לאישור</div>
          <div style={{ ...S.kpiVal, color: '#10b981' }}>{invoices.filter(x => x.status === 'pending').length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>מתוך {invoices.length} סה"כ</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[['all','📄 כל החשבוניות'],['category','🏷️ לפי קטגוריה'],['month','📅 לפי חודש'],['accountant','📊 לרו"ח']].map(([id, lbl]) => (
          <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── Tab: All ────────────────────────────────────── */}
      {tab === 'all' && (
        <>
          <div style={S.filters}>
            <input style={S.inp} placeholder="🔍 חיפוש ספק / מספר..." value={search} onChange={e => setSearch(e.target.value)}/>
            <select style={S.sel} value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              <option value={0}>כל החודשים</option>
              {MONTHS_HE.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select style={S.sel} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">כל הקטגוריות</option>
              {INVOICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={S.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="verified">אושר</option>
            </select>
            <button onClick={() => exportCSV(filtered)} style={{ ...S.btn('#475569'), marginRight: 'auto' }}>
              📥 ייצא CSV
            </button>
          </div>

          {loading ? (
            <div style={S.empty}>⏳ טוען...</div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div>אין חשבוניות עדיין</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>לחץ על "הוסף חשבונית" כדי להתחיל</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>תמונה</th>
                    <th style={S.th}>ספק</th>
                    <th style={S.th}>תאריך</th>
                    <th style={S.th}>קטגוריה</th>
                    <th style={S.th}>סה"כ</th>
                    <th style={S.th}>מקור</th>
                    <th style={S.th}>סטטוס</th>
                    <th style={S.th}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, i) => (
                    <tr key={inv.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)', cursor: 'pointer' }}
                      onClick={() => setViewInv(inv)}>
                      <td style={S.td}>
                        {inv.imageUrl
                          ? <img src={inv.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
                          : null}
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', display: inv.imageUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.vendor || '—'}</div>
                        {inv.invoiceNumber && <div style={{ fontSize: 11, color: 'var(--muted)' }}>#{inv.invoiceNumber}</div>}
                      </td>
                      <td style={S.td}>{fmtDate(inv.invoiceDate)}</td>
                      <td style={S.td}>
                        <span style={{ background: (CATEGORY_COLORS[inv.category] || '#94a3b8') + '22', color: CATEGORY_COLORS[inv.category] || '#94a3b8', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {inv.category}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#ef4444' }}>{fmtShekel(inv.totalAmount)}</td>
                      <td style={{ ...S.td, fontSize: 12, color: 'var(--muted)' }}>{srcLabel(inv.source)}</td>
                      <td style={S.td}><span style={statusBadge(inv.status)}>{inv.status === 'verified' ? '✓ אושר' : '⏳ ממתין'}</span></td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditingInv(inv)} style={{ background: '#3b82f622', color: '#3b82f6', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>ערוך</button>
                          <button onClick={() => handleDelete(inv.id)} style={{ background: '#ef444422', color: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>מחק</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab: By Category ────────────────────────────── */}
      {tab === 'category' && (
        <>
          <div style={S.filters}>
            <select style={S.sel} value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              <option value={0}>כל החודשים</option>
              {MONTHS_HE.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>

          {byCategory.length === 0 ? (
            <div style={S.empty}>אין חשבוניות לתצוגה</div>
          ) : (
            <>
              {/* Bar chart */}
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>חלוקה לפי קטגוריה</div>
                {byCategory.map(([cat, { total }]) => {
                  const pct = totalAmount ? (total / totalAmount * 100) : 0
                  const col = CATEGORY_COLORS[cat] || '#94a3b8'
                  return (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: col, fontWeight: 600 }}>{cat}</span>
                        <span style={{ color: 'var(--muted)' }}>{fmtShekel(total)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 4, transition: 'width .3s' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {byCategory.map(([cat, { count, total, invoices: catInvs }]) => {
                  const col = CATEGORY_COLORS[cat] || '#94a3b8'
                  return (
                    <div key={cat} style={{ ...S.card, borderRight: `4px solid ${col}`, cursor: 'pointer' }}
                      onClick={() => { setFilterCat(cat); setTab('all') }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{cat}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{count} חשבוניות</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{fmtShekel(total)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: By Month ────────────────────────────────── */}
      {tab === 'month' && (
        <>
          {byMonth.length === 0 ? (
            <div style={S.empty}>אין חשבוניות לתצוגה</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byMonth.map(({ month, year: y, count, total }) => {
                const pct = totalAmount ? (total / totalAmount * 100) : 0
                return (
                  <div key={`${y}-${month}`} style={{ ...S.card, cursor: 'pointer' }}
                    onClick={() => { setFilterMonth(month); setTab('all') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS_HE[(month || 1) - 1]} {y}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{count} חשבוניות</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f97316', borderRadius: 5, transition: 'width .3s', minWidth: pct > 0 ? 4 : 0 }}/>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#ef4444', minWidth: 100, textAlign: 'left' }}>
                        {fmtShekel(total)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Accountant Export ───────────────────────── */}
      {tab === 'accountant' && (() => {
        const expFrom = new Date(exportFrom)
        const expTo   = new Date(exportTo)
        const expList = invoices.filter(inv => {
          if (!inv.invoiceDate) return true
          const d = new Date(inv.invoiceDate)
          return d >= expFrom && d <= expTo
        })
        const expTotal    = expList.reduce((s, x) => s + (x.totalAmount || 0), 0)
        const expVAT      = expList.reduce((s, x) => s + (x.vatAmount   || 0), 0)
        const expPreVAT   = expList.reduce((s, x) => s + (x.amount      || 0), 0)

        return (
          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📊 ייצוא לרו"ח</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>מתאריך</label>
                  <input type="date" style={S.sel} value={exportFrom} onChange={e => setExportFrom(e.target.value)}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>עד תאריך</label>
                  <input type="date" style={S.sel} value={exportTo} onChange={e => setExportTo(e.target.value)}/>
                </div>
                <button onClick={handleExportFiltered} style={S.btn('#10b981')}>
                  📥 הורד Excel/CSV
                </button>
                <button onClick={() => window.print()} style={S.btn('#475569')}>
                  🖨️ הדפס
                </button>
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'לפני מע"מ', val: fmtShekel(expPreVAT), col: '#3b82f6' },
                  { label: 'מע"מ לתביעה', val: fmtShekel(expVAT), col: '#f59e0b' },
                  { label: 'סה"כ הוצאות', val: fmtShekel(expTotal), col: '#ef4444' },
                  { label: 'מספר חשבוניות', val: expList.length, col: '#10b981' },
                ].map(({ label, val, col }) => (
                  <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>פירוט לפי קטגוריה</div>
              <table style={{ ...S.table, marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th style={S.th}>קטגוריה</th>
                    <th style={S.th}>מס׳ חשבוניות</th>
                    <th style={S.th}>לפני מע"מ</th>
                    <th style={S.th}>מע"מ</th>
                    <th style={S.th}>סה"כ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    expList.reduce((acc, inv) => {
                      const cat = inv.category || 'אחר'
                      if (!acc[cat]) acc[cat] = { count: 0, amount: 0, vat: 0, total: 0 }
                      acc[cat].count++
                      acc[cat].amount += inv.amount    || 0
                      acc[cat].vat    += inv.vatAmount || 0
                      acc[cat].total  += inv.totalAmount || 0
                      return acc
                    }, {})
                  ).sort((a,b) => b[1].total - a[1].total).map(([cat, d]) => (
                    <tr key={cat}>
                      <td style={S.td}><span style={{ background: (CATEGORY_COLORS[cat]||'#94a3b8') + '22', color: CATEGORY_COLORS[cat]||'#94a3b8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{cat}</span></td>
                      <td style={S.td}>{d.count}</td>
                      <td style={S.td}>{fmtShekel(d.amount)}</td>
                      <td style={S.td}>{fmtShekel(d.vat)}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{fmtShekel(d.total)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg)', fontWeight: 700 }}>
                    <td style={S.td}>סה"כ</td>
                    <td style={S.td}>{expList.length}</td>
                    <td style={S.td}>{fmtShekel(expPreVAT)}</td>
                    <td style={S.td}>{fmtShekel(expVAT)}</td>
                    <td style={{ ...S.td, color: '#ef4444', fontSize: 15 }}>{fmtShekel(expTotal)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Detailed list */}
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>רשימה מפורטת ({expList.length} חשבוניות)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>תאריך</th>
                      <th style={S.th}>ספק</th>
                      <th style={S.th}>מס׳ חשבונית</th>
                      <th style={S.th}>קטגוריה</th>
                      <th style={S.th}>לפני מע"מ</th>
                      <th style={S.th}>מע"מ</th>
                      <th style={S.th}>סה"כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expList.sort((a,b) => (a.invoiceDate||'') > (b.invoiceDate||'') ? -1 : 1).map((inv, i) => (
                      <tr key={inv.id} style={{ background: i % 2 ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                        <td style={S.td}>{fmtDate(inv.invoiceDate)}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{inv.vendor || '—'}</td>
                        <td style={{ ...S.td, color: 'var(--muted)' }}>{inv.invoiceNumber || '—'}</td>
                        <td style={S.td}><span style={{ background: (CATEGORY_COLORS[inv.category]||'#94a3b8') + '22', color: CATEGORY_COLORS[inv.category]||'#94a3b8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{inv.category}</span></td>
                        <td style={S.td}>{fmtShekel(inv.amount)}</td>
                        <td style={S.td}>{fmtShekel(inv.vatAmount)}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{fmtShekel(inv.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modals ──────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          processing={processing}
          onFile={handleFile}
          onClose={() => setShowUpload(false)}
        />
      )}

      {draftInv && (
        <InvoiceModal
          invoice={draftInv}
          onSave={handleSaveDraft}
          onClose={() => setDraftInv(null)}
        />
      )}

      {editingInv && (
        <InvoiceModal
          invoice={editingInv}
          onSave={handleSaveEdit}
          onClose={() => setEditingInv(null)}
        />
      )}

      {viewInv && !editingInv && (
        <ViewModal
          invoice={viewInv}
          onClose={() => setViewInv(null)}
          onEdit={inv => { setEditingInv(inv); setViewInv(null) }}
          onVerify={handleVerify}
        />
      )}

      {batchResults && (
        <BatchImportModal
          results={batchResults}
          onSave={async (selected) => {
            let saved = 0
            for (const item of selected) {
              try {
                const ext = item.extracted || {}
                const invDate = ext.invoice_date || new Date().toISOString().split('T')[0]
                const d = new Date(invDate)
                await addInvoice({
                  vendor:        ext.vendor         || item.filename,
                  invoiceNumber: ext.invoice_number || null,
                  invoiceDate:   invDate,
                  amount:        Number(ext.amount)       || null,
                  vatAmount:     Number(ext.vat_amount)   || null,
                  totalAmount:   Number(ext.total_amount) || null,
                  category:      ext.category       || 'אחר',
                  month:         ext.month          || (d.getMonth() + 1),
                  year:          ext.year           || d.getFullYear(),
                  description:   ext.description    || item.filename,
                  source:        'upload',
                  status:        'pending',
                })
                saved++
              } catch (e) {
                console.error('batch save error:', e)
              }
            }
            setBatchResults(null)
            toast_ok(`נשמרו ${saved} חשבוניות בהצלחה ✅`)
            await load(year)
          }}
          onClose={() => setBatchResults(null)}
        />
      )}
    </div>
  )
}
