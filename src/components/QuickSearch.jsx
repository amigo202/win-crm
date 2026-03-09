import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = [
  { key: 'contacts',    icon: '👤', label: 'לקוחות',     route: '/contacts',    fields: ['name', 'email', 'phone', 'city', 'contactPerson'] },
  { key: 'classes',     icon: '🏫', label: 'חוגים',      route: '/classes',     fields: ['class_name', 'subject', 'location', 'city'] },
  { key: 'instructors', icon: '🎓', label: 'מדריכים',    route: '/instructors', fields: ['name', 'phone', 'email'] },
  { key: 'students',    icon: '📚', label: 'תלמידים',    route: '/students',    fields: ['name'] },
  { key: 'leads',       icon: '🎯', label: 'לידים',      route: '/sales',       fields: ['name', 'phone', 'email', 'city'] },
  { key: 'deals',       icon: '💼', label: 'עסקאות',     route: '/sales',       fields: ['title'] },
]

function getDisplayName(item, key) {
  if (key === 'classes') return item.class_name || item.activity_type || '—'
  if (key === 'deals') return item.title || '—'
  return item.name || '—'
}

function getSubtext(item, key) {
  if (key === 'contacts') return [item.phone, item.city].filter(Boolean).join(' · ')
  if (key === 'classes') return [item.subject, item.location].filter(Boolean).join(' · ')
  if (key === 'instructors') return item.phone || ''
  if (key === 'students') return ''
  if (key === 'leads') return [item.phone, item.city].filter(Boolean).join(' · ')
  if (key === 'deals') return item.stage || ''
  return ''
}

export default function QuickSearch({ open, onClose, contacts, classes, instructors, students, leads, deals }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const dataSources = useMemo(() => ({
    contacts: contacts || [],
    classes: classes || [],
    instructors: instructors || [],
    students: students || [],
    leads: leads || [],
    deals: deals || [],
  }), [contacts, classes, instructors, students, leads, deals])

  const results = useMemo(() => {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()
    const all = []
    for (const cat of CATEGORIES) {
      const items = dataSources[cat.key] || []
      const matches = items.filter(item =>
        cat.fields.some(f => item[f]?.toString().toLowerCase().includes(q))
      ).slice(0, 5)
      if (matches.length > 0) {
        all.push({ ...cat, items: matches })
      }
    }
    return all
  }, [query, dataSources])

  const flatResults = useMemo(() => {
    const flat = []
    for (const group of results) {
      for (const item of group.items) {
        flat.push({ item, category: group })
      }
    }
    return flat
  }, [results])

  useEffect(() => { setSelectedIdx(0) }, [query])

  const handleKeyDown = e => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && flatResults[selectedIdx]) {
      e.preventDefault()
      navigate(flatResults[selectedIdx].category.route)
      onClose()
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', paddingTop: '15vh',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
        maxHeight: '60vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Search input */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="חיפוש לקוח, חוג, מדריך, ליד..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <kbd style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {query.length < 2 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              הקלד לפחות 2 תווים לחיפוש
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              לא נמצאו תוצאות ל-"{query}"
            </div>
          ) : (
            results.map(group => {
              let groupStartIdx = 0
              for (const r of results) {
                if (r.key === group.key) break
                groupStartIdx += r.items.length
              }
              return (
                <div key={group.key}>
                  <div style={{ padding: '8px 20px 4px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {group.icon} {group.label}
                  </div>
                  {group.items.map((item, idx) => {
                    const flatIdx = groupStartIdx + idx
                    const isSelected = flatIdx === selectedIdx
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => { navigate(group.route); onClose() }}
                        style={{
                          padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                          background: isSelected ? 'var(--accent-light, rgba(249,115,22,.1))' : 'transparent',
                          borderRight: isSelected ? '3px solid #f97316' : '3px solid transparent',
                        }}
                        onMouseEnter={() => setSelectedIdx(flatIdx)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getDisplayName(item, group.key)}
                          </div>
                          {getSubtext(item, group.key) && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                              {getSubtext(item, group.key)}
                            </div>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>↑↓ ניווט</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>↵ בחירה</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Ctrl+Shift+K פתיחה</span>
        </div>
      </div>
    </div>
  )
}
