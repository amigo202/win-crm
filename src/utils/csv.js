import { CONTACT_TYPES, STATUS_OPTS, PROGRAMS } from '../constants'
import { monthlyHours, monthlyPay } from './alerts'

export function dlCSV(name, hd, rows) {
  const bom = '\uFEFF'
  const csv = bom + [hd, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}

export function exportContactsCSV(contacts) {
  const hd = ['סוג','שם','איש קשר','עיר','טלפון','אימייל','סטטוס','תוכניות','מנהל','מספר תלמידים','גיל','הורה','מחלקה','קהל יעד','סוג אירוע','תאריך']
  const rows = contacts.map(c => [
    CONTACT_TYPES.find(t => t.id === c.type)?.label || '',
    c.name || '', c.contactPerson || '', c.city || '', c.phone || '', c.email || '',
    STATUS_OPTS.find(s => s.value === c.status)?.label || '',
    (c.activePrograms || []).join(';'),
    c.principal || c.manager || '', c.studentCount || '', c.age || '',
    c.parentName || '', c.department || '', c.targetAudience || '', c.eventTypes || '',
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('he-IL') : '',
  ])
  dlCSV('win-crm-contacts.csv', hd, rows)
}

export function exportInstructorsCSV(instructors) {
  const hd = ['שם','טלפון','תוכניות','תעריף/שעה','שעות חודש','תשלום חודש']
  const rows = instructors.map(i => [
    i.name || '', i.phone || '', (i.programs || []).join(';'),
    i.hourlyRate || 0, monthlyHours(i), monthlyPay(i),
  ])
  dlCSV('win-crm-instructors.csv', hd, rows)
}

export function exportStudentsCSV(students, contacts) {
  const cname = id => contacts?.find(c => c.id === id)?.name || ''
  const hd = ['שם','תוכנית','מוסד','סטטוס תשלום','טלפון הורה','הערות']
  const rows = students.map(s => [
    s.name || '', s.program || '', cname(s.contactId),
    s.paymentStatus || '', s.parentPhone || '', s.notes || '',
  ])
  dlCSV('win-crm-students.csv', hd, rows)
}

export function exportClassesCSV(classes) {
  const hd = ['שם חוג','סוג','מוסד','עיר','מדריך','יום','שעה','תלמידים','מפגשים','סוכם','בפועל','סטטוס','תשלום']
  const rows = classes.map(c => [
    c.class_name || '', c.activity_type || '', c.location || '', c.city || '',
    c.instructors?.name || '', c.day || '', c.time_start || '',
    c.students_count || '', c.sessions_count || '',
    c.agreed_price || '', c.actual_income || '',
    c.status || '', c.paid ? 'שולם' : 'ממתין',
  ])
  dlCSV('win-crm-classes.csv', hd, rows)
}

export function exportLeadsCSV(leads) {
  const srcLabels = { website: 'אתר', whatsapp: 'WhatsApp', facebook: 'פייסבוק', instagram: 'אינסטגרם', referral: 'המלצה', manual: 'ידני', csv: 'CSV' }
  const stageLabels = { new: 'חדש', contacted: 'פנינו', qualified: 'מוסמך', proposal: 'הצעה', won: 'סגרנו', lost: 'הפסדנו' }
  const hd = ['שם','טלפון','אימייל','עיר','מקור','שלב','תוכנית','הערות','תאריך יצירה']
  const rows = leads.map(l => [
    l.name || '', l.phone || '', l.email || '', l.city || '',
    srcLabels[l.source] || l.source || '',
    stageLabels[l.leadStage] || l.leadStage || '',
    l.program || '', l.notes || '',
    l.createdAt ? new Date(l.createdAt).toLocaleDateString('he-IL') : '',
  ])
  dlCSV('win-crm-leads.csv', hd, rows)
}

function splitCSV(line) {
  const v = []; let c = '', q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { v.push(c.replace(/^"|"$/g, '')); c = '' }
    else c += ch
  }
  v.push(c.replace(/^"|"$/g, ''))
  return v
}

export function parseCSV(text) {
  const L = text.trim().split(/\r?\n/)
  if (L.length < 2) return []
  const hd = splitCSV(L[0])
  return L.slice(1).map(l => {
    const v = splitCSV(l)
    const o = {}
    hd.forEach((h, i) => o[h] = v[i] || '')
    return o
  })
}

export function csvToContact(row) {
  const tm = { 'בית ספר': 'school', 'עירייה': 'municipality', 'מתנ"ס': 'community', 'מפיק אירועים': 'event_producer', 'תלמיד פרטי': 'private_student' }
  const sm = { 'ליד': 'lead', 'פרוספקט': 'prospect', 'פעיל': 'customer', 'לא פעיל': 'inactive' }
  const type = tm[row['סוג']] || 'school'
  const base = {
    type, name: row['שם'] || '', contactPerson: row['איש קשר'] || '',
    city: row['עיר'] || '', phone: row['טלפון'] || '', email: row['אימייל'] || '',
    status: sm[row['סטטוס']] || 'lead',
    activePrograms: (row['תוכניות'] || '').split(';').filter(Boolean),
    tags: [], notes: [], activities: [],
  }
  if (type === 'school') { base.principal = row['מנהל'] || ''; base.studentCount = row['מספר תלמידים'] || '' }
  if (type === 'municipality') base.department = row['מחלקה'] || ''
  if (type === 'community') { base.manager = row['מנהל'] || ''; base.targetAudience = row['קהל יעד'] || '' }
  if (type === 'event_producer') base.eventTypes = row['סוג אירוע'] || ''
  if (type === 'private_student') { base.age = row['גיל'] || ''; base.parentName = row['הורה'] || ''; base.program = row['תוכניות'] || PROGRAMS[0] }
  return base
}
