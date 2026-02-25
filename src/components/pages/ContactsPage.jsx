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
      <div className="ph"><h2>לקוחות</h2>
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
              : <table><thead><tr><th>שם</th><th>סוג</th><th>טלפון / איש קשר</th><th>מידע</th><th>תוכניות</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>{filtered.map(c => {
                  const ti = CONTACT_TYPES.find(t => t.id === c.type)
                  const si = STATUS_OPTS.find(s => s.value === c.status) || STATUS_OPTS[0]
                  return (
                    <tr key={c.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div className="av" style={{ width: 31, height: 31, fontSize: 12, background: avBg(c.name) }}>{ini(c.name)}</div><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email || ''}</div></div></div></td>
                      <td><span className={`badge ${ti?.badge || 'b-gray'}`}>{ti?.label}</span></td>
                      <td><div style={{ fontSize: 12 }}>{c.phone && <div style={{ fontWeight: 500 }}>{c.phone}</div>}{c.contactPerson && <div style={{ color: 'var(--muted)', fontSize: 11 }}>👤 {c.contactPerson}</div>}</div></td>
                      <td><span style={{ fontSize: 12, color: 'var(--muted)' }}>{keyInfo(c)}</span></td>
                      <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{(c.activePrograms || [c.program]).filter(Boolean).slice(0, 3).map((p, i) => <span key={i} className="badge b-teal" style={{ fontSize: 11, padding: '1px 7px' }}>{p}</span>)}</div></td>
                      <td><span className={`badge ${si.badge}`}>{si.label}</span></td>
                      <td><div className="ac-cell">
                        {c.phone && (
                          <a href={`https://wa.me/972${c.phone.replace(/^0/, '').replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className="icon-btn" title="שלח WhatsApp"
                            style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'#15803d', textDecoration:'none' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </a>
                        )}
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
