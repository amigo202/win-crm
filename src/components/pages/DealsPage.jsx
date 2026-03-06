import { useState, useMemo } from 'react'
import { STAGES, PROGRAMS } from '../../constants'
import { fmtShekel, fmtDate } from '../../utils/format'
import { Ico } from '../icons/Ico'
import DealModal from '../modals/DealModal'

export function DealsContent({ deals, contacts, onAdd, onUpdate, onDelete, hideHeader }) {
  const [modal, setModal] = useState(null)
  const [view,  setView]  = useState('kanban') // kanban | table
  const [stageFilter, setStageFilter] = useState('all')
  const [progFilter, setProgFilter]   = useState('all')

  const cname  = id => contacts.find(c => c.id === id)?.name || ''

  // Stats
  const stats = useMemo(() => {
    const active   = deals.filter(d => !['lost'].includes(d.stage))
    const pipeline = active.filter(d => ['lead','meeting','proposal'].includes(d.stage))
    const pipeVal  = pipeline.reduce((s, d) => s + Number(d.value || 0), 0)
    const signed   = active.filter(d => d.stage === 'signed')
    const signedVal = signed.reduce((s, d) => s + Number(d.value || 0), 0)
    const activeVal = active.filter(d => d.stage === 'active').reduce((s, d) => s + Number(d.value || 0), 0)
    const lostCount = deals.filter(d => d.stage === 'lost').length
    return { pipeline: pipeVal, signed: signedVal, active: activeVal, lostCount, total: deals.length }
  }, [deals])

  // Filtered
  const filtered = useMemo(() => {
    let arr = [...deals]
    if (stageFilter !== 'all') arr = arr.filter(d => d.stage === stageFilter)
    if (progFilter !== 'all')  arr = arr.filter(d => d.program === progFilter)
    return arr
  }, [deals, stageFilter, progFilter])

  return (
    <>
      {!hideHeader && <div className="ph">
        <div>
          <h2>עסקאות</h2>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, flexWrap:'wrap' }}>
            <span style={{ color: 'var(--muted)' }}>📅 {new Date().toLocaleDateString('he-IL', { month:'long', year:'numeric' })}</span>
            <span style={{ color: 'var(--muted)' }}>•</span>
            <span style={{ color: 'var(--muted)' }}>פייפליין: <strong style={{ color: 'var(--accent)' }}>{fmtShekel(stats.pipeline)}</strong></span>
            <span style={{ color: 'var(--muted)' }}>חתום: <strong style={{ color: 'var(--success)' }}>{fmtShekel(stats.signed)}</strong></span>
            <span style={{ color: 'var(--muted)' }}>פעיל: <strong>{fmtShekel(stats.active)}</strong></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-o btn-sm" onClick={() => setView(v => v === 'kanban' ? 'table' : 'kanban')} style={{ fontSize: 12 }}>
            {view === 'kanban' ? '📋 טבלה' : '📊 קנבן'}
          </button>
          <button className="btn btn-p" onClick={() => setModal({ deal: null, stage: 'lead' })}><Ico.plus/>הוסף עסקה</button>
        </div>
      </div>}
      {hideHeader && <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, flexWrap:'wrap' }}>
          <span style={{ color: 'var(--muted)' }}>פייפליין: <strong style={{ color: 'var(--accent)' }}>{fmtShekel(stats.pipeline)}</strong></span>
          <span style={{ color: 'var(--muted)' }}>חתום: <strong style={{ color: 'var(--success)' }}>{fmtShekel(stats.signed)}</strong></span>
          <span style={{ color: 'var(--muted)' }}>פעיל: <strong>{fmtShekel(stats.active)}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-o btn-sm" onClick={() => setView(v => v === 'kanban' ? 'table' : 'kanban')} style={{ fontSize: 12 }}>
            {view === 'kanban' ? '📋 טבלה' : '📊 קנבן'}
          </button>
          <button className="btn btn-p" onClick={() => setModal({ deal: null, stage: 'lead' })}><Ico.plus/>הוסף עסקה</button>
        </div>
      </div>}

      {/* ── Info banner explaining deals ── */}
      <div style={{ padding: '0 20px 10px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
          borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span><strong>עסקאות</strong> = הזדמנויות עסקיות עם ערך כספי. ליד שהתקדם לשלב מסחרי הופך לעסקה. כאן מנהלים את התקציב, הצעות מחיר וחתימות.</span>
        </div>
      </div>

      {/* ── Stage filter chips ── */}
      {view === 'table' && (
        <div style={{ padding: '0 20px', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className={`fp ${stageFilter === 'all' ? 'on' : ''}`} onClick={() => setStageFilter('all')}>
            הכל <span className="fp-cnt">{deals.length}</span>
          </button>
          {STAGES.map(s => {
            const cnt = deals.filter(d => d.stage === s.id).length
            return cnt > 0 ? (
              <button key={s.id} className={`fp ${stageFilter === s.id ? 'on' : ''}`}
                onClick={() => setStageFilter(stageFilter === s.id ? 'all' : s.id)}
                style={{ color: stageFilter === s.id ? s.color : undefined }}
              >
                {s.label} <span className="fp-cnt">{cnt}</span>
              </button>
            ) : null
          })}
          <div style={{ borderRight: '1px solid var(--border)', margin: '0 4px', height: 20 }}/>
          {PROGRAMS.map(p => {
            const cnt = deals.filter(d => d.program === p).length
            return cnt > 0 ? (
              <button key={p} className={`fp ${progFilter === p ? 'on' : ''}`}
                onClick={() => setProgFilter(progFilter === p ? 'all' : p)}>
                {p} <span className="fp-cnt">{cnt}</span>
              </button>
            ) : null
          })}
        </div>
      )}

      {view === 'kanban' ? (
        <div className="pb">
          <div className="kanban">
            {STAGES.map(stage => {
              const sd = filtered.filter(d => d.stage === stage.id)
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
      ) : (
        /* ── Table view ── */
        <div className="pb"><div className="card">
          {!filtered.length
            ? <div className="empty"><div className="empty-ico">📊</div><p>אין עסקאות</p></div>
            : <div className="tbl-wrap"><table><thead><tr>
                <th>שם עסקה</th><th>לקוח</th><th>תוכנית</th><th>שלב</th><th>שווי (₪)</th><th>תאריך סגירה</th><th>הערות</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(d => {
                  const stage = STAGES.find(s => s.id === d.stage) || STAGES[0]
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.title}</strong></td>
                      <td style={{ color: 'var(--muted)' }}>{cname(d.contactId) || '–'}</td>
                      <td>{d.program ? <span className="badge b-teal" style={{ fontSize: 11 }}>{d.program}</span> : '–'}</td>
                      <td><span style={{ color: stage.color, fontWeight: 600 }}>{stage.label}</span></td>
                      <td><strong>{d.value ? fmtShekel(d.value) : '–'}</strong></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{d.closeDate ? fmtDate(d.closeDate)?.text : '–'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.notes || '–'}</td>
                      <td><div className="ac-cell">
                        <button className="icon-btn" onClick={() => setModal({ deal: d, stage: d.stage })}><Ico.edit/></button>
                        <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm('למחוק עסקה?')) onDelete(d.id) }}><Ico.trash/></button>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg)' }}>
                  <td colSpan={4}><strong>סה"כ</strong></td>
                  <td><strong>{fmtShekel(filtered.reduce((s, d) => s + Number(d.value || 0), 0))}</strong></td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table></div>
          }
        </div></div>
      )}

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

export default function DealsPage(props) {
  return <DealsContent {...props} />
}
