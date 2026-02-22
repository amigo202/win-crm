export function missed2Consec(att) {
  if (!att || att.length < 2) return false
  const s = [...att].sort((a, b) => new Date(b.date) - new Date(a.date))
  return !s[0].present && !s[1].present
}

export function noSessionDays(inst, days = 14) {
  const ss = inst.sessions || []
  if (!ss.length) return true
  const last = ss.reduce((m, s) => new Date(s.date) > new Date(m.date) ? s : m)
  return (Date.now() - new Date(last.date)) / 86400000 > days
}

export function stuckDays(deal, days = 30) {
  if (!['meeting', 'proposal'].includes(deal.stage)) return false
  return (Date.now() - new Date(deal.createdAt)) / 86400000 > days
}

export function monthlyHours(inst) {
  const n = new Date()
  return (inst.sessions || [])
    .filter(s => {
      const d = new Date(s.date)
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
    })
    .reduce((sum, s) => sum + Number(s.hours || 0), 0)
}

export function monthlyPay(inst) {
  return monthlyHours(inst) * Number(inst.hourlyRate || 0)
}

export function attPct(student) {
  const a = student.attendance || []
  if (!a.length) return null
  return Math.round(a.filter(x => x.present).length / a.length * 100)
}

export function studentStatus(student) {
  const a = [...(student.attendance || [])].sort((x, y) => new Date(y.date) - new Date(x.date))
  if (a.length >= 2 && !a[0].present && !a[1].present) return 'risk'
  if (a.length >= 1 && !a[0].present) return 'warn'
  return 'ok'
}

export function computeAlerts(tasks, instructors, students, deals) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return {
    overdue:     tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now),
    instructors: instructors.filter(i => noSessionDays(i, 14)),
    students:    students.filter(s => studentStatus(s) === 'risk'),
    deals:       deals.filter(d => stuckDays(d, 30)),
  }
}
