export const fmtShekel = n => '\u20AA' + Number(n || 0).toLocaleString('he-IL')

export const ini = name =>
  (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

const APAL = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
export const avBg = name => APAL[(name || 'A').charCodeAt(0) % APAL.length]

export function fmtDate(iso) {
  if (!iso) return null
  const d = new Date(iso), t = new Date()
  t.setHours(0, 0, 0, 0)
  const tm = new Date(t)
  tm.setDate(tm.getDate() + 1)
  if (d < t) return { text: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }), ov: true }
  if (d.toDateString() === t.toDateString()) return { text: 'היום', ov: false }
  if (d.toDateString() === tm.toDateString()) return { text: 'מחר', ov: false }
  return { text: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }), ov: false }
}

export function fmtDT(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtD(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}
