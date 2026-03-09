import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MONTHS_HE = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

// ── Excel Export ─────────────────────────────────────────────────────────────

export function exportFinancialExcel({ month, year, classData, activities, payments, salaries, instructors, contacts }) {
  const wb = XLSX.utils.book_new()
  const monthName = MONTHS_HE[month]
  const fmt = v => Number(v || 0)

  // Helper to get names
  const instName = id => instructors?.find(i => i.id === id)?.name || '–'
  const contName = id => contacts?.find(c => c.id === id)?.name || '–'

  // ── Sheet 1: Summary ──────────────────────────────────────
  const classIncome = classData.reduce((s, c) => s + (c._income || 0), 0)
  const actIncome = activities.reduce((s, a) => s + fmt(a.income), 0)
  const payIncome = payments.reduce((s, p) => s + fmt(p.amount), 0)
  const totalIncome = classIncome + actIncome + payIncome

  const classExpense = classData.reduce((s, c) => s + (c._expense || 0), 0)
  const actExpense = activities.reduce((s, a) => s + fmt(a.expenses), 0)
  const salaryExpense = salaries.reduce((s, x) => s + fmt(x.netSalary), 0)
  const totalExpense = classExpense + actExpense + salaryExpense

  const summaryData = [
    ['סיכום פיננסי', `${monthName} ${year}`],
    [],
    ['קטגוריה', 'סכום (₪)'],
    ['הכנסות מחוגים', classIncome],
    ['הכנסות מפעילויות', actIncome],
    ['תשלומים ישירים', payIncome],
    ['סה"כ הכנסות', totalIncome],
    [],
    ['הוצאות מדריכים (חוגים)', classExpense],
    ['הוצאות פעילויות', actExpense],
    ['משכורות', salaryExpense],
    ['סה"כ הוצאות', totalExpense],
    [],
    ['רווח נקי', totalIncome - totalExpense],
    ['מרג\'ין', totalIncome > 0 ? `${Math.round(((totalIncome - totalExpense) / totalIncome) * 100)}%` : '0%'],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  ws1['!cols'] = [{ wch: 25 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'סיכום')

  // ── Sheet 2: Income Details ───────────────────────────────
  const incomeRows = [
    ['מקור', 'שם', 'סוג', 'תלמידים', 'מחיר/תלמיד', 'סכום (₪)'],
    ...classData.map(c => ['חוג', c.class_name || c.activity_type, c.activity_type, c.students_count || 0, c.price_per_student || 0, c._income || 0]),
    ...activities.map(a => ['פעילות', a.name, a.activityType || '', '', '', fmt(a.income)]),
    ...payments.map(p => ['תשלום', contName(p.contactId), p.program || '', '', '', fmt(p.amount)]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(incomeRows)
  ws2['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'הכנסות')

  // ── Sheet 3: Expense Details ──────────────────────────────
  const expenseRows = [
    ['מקור', 'שם', 'פרטים', 'סכום (₪)'],
    ...classData.filter(c => c._expense > 0).map(c => ['מדריך חוג', c.class_name || c.activity_type, c.instructors?.name || '–', c._expense || 0]),
    ...activities.filter(a => a.expenses > 0).map(a => ['פעילות', a.name, a.activityType || '', fmt(a.expenses)]),
    ...salaries.map(s => ['משכורת', instName(s.instructorId), `בסיס: ₪${fmt(s.baseSalary)}`, fmt(s.netSalary)]),
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(expenseRows)
  ws3['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'הוצאות')

  // ── Save ──────────────────────────────────────────────────
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `דוח_פיננסי_${monthName}_${year}.xlsx`)
}

// ── PDF Export ───────────────────────────────────────────────────────────────

export function exportFinancialPDF({ month, year, classData, activities, payments, salaries, instructors, contacts }) {
  const monthName = MONTHS_HE[month]
  const fmt = v => Number(v || 0)
  const fmtS = v => `₪${Number(v || 0).toLocaleString()}`

  const instName = id => instructors?.find(i => i.id === id)?.name || '–'
  const contName = id => contacts?.find(c => c.id === id)?.name || '–'

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Use built-in font (Helvetica) - Hebrew may not render perfectly but works for numbers
  doc.setFont('Helvetica')

  // ── Header ────────────────────────────────────────────────
  doc.setFontSize(18)
  doc.text(`WIN CRM - Financial Report`, 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`${monthName} ${year}`, 105, 28, { align: 'center' })
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleDateString('he-IL')}`, 105, 34, { align: 'center' })

  // ── Summary Table ─────────────────────────────────────────
  const classIncome = classData.reduce((s, c) => s + (c._income || 0), 0)
  const actIncome = activities.reduce((s, a) => s + fmt(a.income), 0)
  const payIncome = payments.reduce((s, p) => s + fmt(p.amount), 0)
  const totalIncome = classIncome + actIncome + payIncome
  const classExpense = classData.reduce((s, c) => s + (c._expense || 0), 0)
  const actExpense = activities.reduce((s, a) => s + fmt(a.expenses), 0)
  const salaryExpense = salaries.reduce((s, x) => s + fmt(x.netSalary), 0)
  const totalExpense = classExpense + actExpense + salaryExpense
  const profit = totalIncome - totalExpense

  autoTable(doc, {
    startY: 42,
    head: [['Category', 'Amount']],
    body: [
      ['Classes Income', fmtS(classIncome)],
      ['Activities Income', fmtS(actIncome)],
      ['Direct Payments', fmtS(payIncome)],
      ['Total Income', fmtS(totalIncome)],
      ['', ''],
      ['Instructor Costs (Classes)', fmtS(classExpense)],
      ['Activity Expenses', fmtS(actExpense)],
      ['Salaries', fmtS(salaryExpense)],
      ['Total Expenses', fmtS(totalExpense)],
      ['', ''],
      ['Net Profit', fmtS(profit)],
      ['Margin', totalIncome > 0 ? `${Math.round((profit / totalIncome) * 100)}%` : '0%'],
    ],
    theme: 'striped',
    styles: { fontSize: 10, halign: 'left' },
    headStyles: { fillColor: [249, 115, 22] },
  })

  // ── Income Details ────────────────────────────────────────
  const incY = doc.lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.text('Income Details', 14, incY)

  autoTable(doc, {
    startY: incY + 4,
    head: [['Source', 'Name', 'Type', 'Students', 'Amount']],
    body: [
      ...classData.map(c => ['Class', c.class_name || c.activity_type || '', c.activity_type || '', c.students_count || 0, fmtS(c._income)]),
      ...activities.map(a => ['Activity', a.name || '', a.activityType || '', '', fmtS(a.income)]),
      ...payments.map(p => ['Payment', contName(p.contactId), p.program || '', '', fmtS(p.amount)]),
    ],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'left' },
    headStyles: { fillColor: [16, 185, 129] },
  })

  // ── Expense Details ───────────────────────────────────────
  const expY = doc.lastAutoTable.finalY + 10
  if (expY > 250) doc.addPage()
  const startExpY = expY > 250 ? 20 : expY

  doc.setFontSize(13)
  doc.text('Expense Details', 14, startExpY)

  autoTable(doc, {
    startY: startExpY + 4,
    head: [['Source', 'Name', 'Details', 'Amount']],
    body: [
      ...classData.filter(c => c._expense > 0).map(c => ['Instructor', c.class_name || c.activity_type || '', c.instructors?.name || '', fmtS(c._expense)]),
      ...activities.filter(a => a.expenses > 0).map(a => ['Activity', a.name || '', '', fmtS(a.expenses)]),
      ...salaries.map(s => ['Salary', instName(s.instructorId), '', fmtS(s.netSalary)]),
    ],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'left' },
    headStyles: { fillColor: [239, 68, 68] },
  })

  doc.save(`financial_report_${monthName}_${year}.pdf`)
}
