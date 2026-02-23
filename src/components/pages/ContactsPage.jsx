import { useState } from 'react'
import { CONTACT_TYPES, STATUS_OPTS } from '../../constants'
import { ini, avBg } from '../../utils/format'
import { exportContactsCSV } from '../../utils/csv'
import { Ico } from '../icons/Ico'
import ContactModal from '../modals/ContactModal'
import ContactImportModal from '../import/ContactImportModal'

export default function ContactsPage({ contacts, deals, onAdd, onUpdate, onDelete, onReload }) {
  const [tf, setTf]          = useState('all')
  const [q, setQ]            = useState('')
  const [modal, setModal]    = useState(null)
  const [importing, setImporting] = useState(false)

  const filtered = contacts.filter(c => {
    if (tf !== 'all' && c.type !== tf) return false
    if (q) { const ql = q.toLowerCase(); return [c.name, c.email, c.city, c.phone, c.contactPerson].some(v => v?.toLowerCase().includes(ql)) }
    return true
  })

  function keyInfo(c) {
    if (c.type === 'school')         return [c.city, c.studentCount ? c.studentCount + ' תלמידים' : ''].filter(Boolean).join(' • ')
    if (c.type === 'municipality')   return [c.city, c.department].filter(Boolean).join(' • ')
    if (c.type === 'community')      return [c.city, c.targetAudience].filter(Boolean).join(' • ')
    if (c.type === 'event_producer') return c.eventTypes || c.city || ''
    if (c.type === 'private_student') return [c.program, c.age ? 'גיל ' + c.age : ''].filter(Boolean).join(' • ')
    return c.city || ''
  }

  return (
    <>
      <div className="ph"><h2>אנשי קשר</h2>
        <div style={{ display: 'flex', gap: 7 }}>
          <button className="btn btn-o btn-sm" onClick={() => exportContactsCSV(contacts)}><Ico.dl/>ייצוא</button>
          <button className="btn btn-o btn-sm" onClick={() => setImporting(true)}><Ico.ul/>ייבוא</button>
          <button className="btn btn-p" onClick={() => setModal({ mode: 'add' })}><Ico.plus/>הוסף</button>
        </div>
      </div>
      <div className="pb">
        <div className="card">
          <div className="filter-bar">
            {[{ id: 'all', label: 'הכל' }, ...CONTACT_TYPES].map(t => {
              const cnt = t.id === 'all' ? contacts.length : contacts.filter(c => c.type === t.id).length
              return <button key={t.id} className={`fp ${tf === t.id ? 'on' : ''}`} onClick={() => setTf(t.id)}>{t.label}<span className="fp-cnt">{cnt}</span></button>
            })}
          </div>
          <div className="search-bar"><input className="si-input" value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש שם, עיר, אימייל..."/></div>
          <div className="tbl-wrap">
            {!filtered.length
              ? <div className="empty"><div className="empty-ico">👥</div><p>{q ? 'לא נמצאו תוצאות' : 'לחץ "הוסף" להוסיף איש קשר ראשון'}</p></div>
              : <table><thead><tr><th>שם</th><th>סוג</th><th>מידע</th><th>תוכניות</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>{filtered.map(c => {
                  const ti = CONTACT_TYPES.find(t => t.id === c.type)
                  const si = STATUS_OPTS.find(s => s.value === c.status) || STATUS_OPTS[0]
                  return (
                    <tr key={c.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div className="av" style={{ width: 31, height: 31, fontSize: 12, background: avBg(c.name) }}>{ini(c.name)}</div><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email || c.phone || ''}</div></div></div></td>
                      <td><span className={`badge ${ti?.badge || 'b-gray'}`}>{ti?.label}</span></td>
                      <td><span style={{ fontSize: 12, color: 'var(--muted)' }}>{keyInfo(c)}</span></td>
                      <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{(c.activePrograms || [c.program]).filter(Boolean).slice(0, 3).map((p, i) => <span key={i} className="badge b-teal" style={{ fontSize: 11, padding: '1px 7px' }}>{p}</span>)}</div></td>
                      <td><span className={`badge ${si.badge}`}>{si.label}</span></td>
                      <td><div className="ac-cell">
                        <button className="icon-btn" onClick={() => setModal({ mode: 'edit', contact: c })}><Ico.edit/></button>
                        <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm(`למחוק ${c.name}?`)) onDelete(c.id) }}><Ico.trash/></button>
                      </div></td>
                    </tr>
                  )
                })}</tbody>
              </table>}
          </div>
        </div>
      </div>
      {modal && (
        <ContactModal
          contact={modal.mode === 'edit' ? modal.contact : null}
          deals={deals}
          onSave={d => modal.mode === 'edit' ? onUpdate(modal.contact.id, d) : onAdd(d)}
          onClose={() => setModal(null)}
        />
      )}
      {importing && (
        <ContactImportModal
          onClose={() => setImporting(false)}
          onDone={() => { setImporting(false); onReload?.() }}
        />
      )}
    </>
  )
}
