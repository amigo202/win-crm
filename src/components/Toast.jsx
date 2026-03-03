import { useState, useEffect, useCallback } from 'react'

let _push = () => {}

export function toast(msg, type = 'success') { _push({ id: Date.now(), msg, type }) }
export function toast_ok(msg)  { toast(msg, 'success') }
export function toast_err(msg) { toast(msg, 'error') }

export default function ToastContainer() {
  const [items, setItems] = useState([])

  _push = useCallback(item => {
    setItems(p => [...p, item])
    setTimeout(() => setItems(p => p.filter(i => i.id !== item.id)), 3500)
  }, [])

  if (!items.length) return null

  return (
    <div style={{
      position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
    }}>
      {items.map(t => (
        <div key={t.id} onClick={() => setItems(p => p.filter(i => i.id !== t.id))}
          style={{
            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            color: '#fff', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.18)',
            animation: 'fadeUp .25s ease', direction: 'rtl',
            background: t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#f59e0b' : '#10b981',
          }}>
          {t.type === 'error' ? '✕ ' : t.type === 'warning' ? '⚠ ' : '✓ '}{t.msg}
        </div>
      ))}
    </div>
  )
}
