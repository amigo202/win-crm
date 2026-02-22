import { useState } from 'react'
import { STAGES } from '../../constants'
import { fmtShekel, fmtDate } from '../../utils/format'
import { Ico } from '../icons/Ico'
import DealModal from '../modals/DealModal'

export default function DealsPage({ deals, contacts, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null)
  const pipe   = deals.filter(d => ['lead','meeting','proposal'].includes(d.stage)).reduce((s, d) => s + Number(d.value || 0), 0)
  const cname  = id => contacts.find(c => c.id === id)?.name || ''

  return (
    <>
      <div className="ph">
        <h2>עסקאות</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>פייפליין: <strong>{fmtShekel(pipe)}</strong></span>
          <button className="btn btn-p" onClick={() => setModal({ deal: null, stage: 'lead' })}><Ico.plus/>הוסף</button>
        </div>
      </div>
      <div className="pb">
        <div className="kanban">
          {STAGES.map(stage => {
            const sd = deals.filter(d => d.stage === stage.id)
            const sv = sd.reduce((s, d) => s + Number(d.value || 0), 0)
            return (
              <div key={stage.id} className="kcol">
                <div className="kch"><span style={{ color: stage.color }}>{stage.label}</span><span className="kcnt">{sd.length}</span></div>
                {sv > 0 && <div className="kval">{fmtShekel(sv)}</div>}
                <div className="kbody">
                  {sd.map(d => (
                    <div key={d.id} className="kcard" onClick={() => setModal({ deal: d, stage: d.stage })}>
                      <div className="kct">{d.title}</div>
                      <div className="kcm">
                        {d.contactId && <div>{cname(d.contactId)}</div>}
                        {d.program   && <div>{d.program}</div>}
                        {d.closeDate && <div>סגירה: {fmtDate(d.closeDate)?.text}</div>}
                      </div>
                      {d.value && <div className="kcv">{fmtShekel(d.value)}</div>}
                    </div>
                  ))}
                  <button className="kadd" onClick={() => setModal({ deal: null, stage: stage.id })}><Ico.plus s={11}/>הוסף</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {modal && (
        <DealModal
          deal={modal.deal}
          contacts={contacts}
          initStage={modal.stage}
          onSave={d => { if (modal.deal) onUpdate(modal.deal.id, d, modal.deal.stage); else onAdd(d) }}
          onClose={() => setModal(null)}
          onDel={id => { onDelete(id); setModal(null) }}
        />
      )}
    </>
  )
}
