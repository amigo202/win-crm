import { useState } from 'react'
import { LEAD_STAGES, LEAD_SOURCES } from '../../constants'
import { Ico } from '../icons/Ico'
import LeadDetailsModal from '../leads/LeadDetailsModal'
import AddLeadModal     from '../leads/AddLeadModal'

// ── Days since a date ─────────────────────────────────────────────
function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso)) / 86_400_000)
}

function sourceInfo(id) {
  return LEAD_SOURCES.find(s => s.id === id) || { icon: '✍️', label: id }
}

// ── Lead card ─────────────────────────────────────────────────────
function LeadCard({ lead, onClick, onMoveStage }) {
  const ds   = daysSince(lead.lastActivityAt)
  const risk = lead.atRisk || (ds !== null && ds >= 7)

  return (
    <div
      className="lead-card"
      draggable
      onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
      onClick={onClick}
      style={{
        background:   'var(--card)',
        border:       `1px solid ${risk ? '#fca5a5' : 'var(--border)'}`,
        borderRadius: 10,
        padding:      '11px 13px',
        marginBottom: 8,
        cursor:       'grab',
        transition:   'box-shadow .15s',
        position:     'relative',
      }}
    >
      {risk && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 10, fontWeight: 700, color: '#ef4444',
          background: '#fee2e2', borderRadius: 4, padding: '1px 6px',
        }}>⚠ {ds}ד׳</div>
      )}

      {/* Name */}
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, paddingLeft: risk ? 40 : 0 }}>
        {lead.name}
      </div>

      {/* Source */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{sourceInfo(lead.source).icon}</span>
        <span>{sourceInfo(lead.source).label}</span>
        {lead.city && <span>• {lead.city}</span>}
      </div>

      {/* Contact info */}
      {lead.phone && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }} onClick={e => e.stopPropagation()}>
          <a href={`tel:${lead.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            📞 {lead.phone}
          </a>
        </div>
      )}
      {lead.email && (
        <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ✉️ {lead.email}
        </div>
      )}

      {/* Last touch */}
      {ds !== null && (
        <div style={{ fontSize: 11, marginTop: 6, color: risk ? '#ef4444' : 'var(--muted)' }}>
          נגיעה אחרונה לפני {ds} {ds === 1 ? 'יום' : 'ימים'}
        </div>
      )}
    </div>
  )
}

// ── Kanban column ─────────────────────────────────────────────────
function KanbanCol({ stage, leads, onDrop, onCardClick }) {
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        const id = e.dataTransfer.getData('leadId')
        if (id) onDrop(id, stage.id)
      }}
      style={{
        minWidth:     240,
        maxWidth:     260,
        flexShrink:   0,
        background:   over ? 'rgba(249,115,22,.05)' : 'var(--bg2)',
        border:       `1px solid ${over ? '#f97316' : 'var(--border)'}`,
        borderTop:    `3px solid ${stage.color}`,
        borderRadius: 12,
        display:      'flex',
        flexDirection: 'column',
        transition:   'border-color .15s, background .15s',
      }}
    >
      {/* Column header */}
      <div style={{
        padding:      '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: stage.color }}>{stage.label}</span>
        <span style={{
          background: stage.bg, color: stage.color,
          borderRadius: 20, fontSize: 11, fontWeight: 700,
          padding: '1px 8px', minWidth: 22, textAlign: 'center',
        }}>{leads.length}</span>
      </div>

      {/* Cards */}
      <div style={{ padding: 10, flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        {leads.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, padding: '20px 0' }}>
            גרור לכאן
          </div>
        )}
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function LeadsPipelinePage({ leads, onAdd, onUpdate, onMoveStage, onDelete }) {
  const [selected,    setSelected]    = useState(null)   // lead for details modal
  const [addOpen,     setAddOpen]     = useState(false)
  const [showClosed,  setShowClosed]  = useState(false)

  const visibleStages = showClosed
    ? LEAD_STAGES
    : LEAD_STAGES.filter(s => !['won','lost'].includes(s.id))

  const atRiskCount = leads.filter(l => l.atRisk && !['won','lost'].includes(l.leadStage)).length
  const newToday    = leads.filter(l => {
    const d = new Date(l.createdAt); d.setHours(0,0,0,0)
    const t = new Date(); t.setHours(0,0,0,0)
    return d.getTime() === t.getTime()
  }).length

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="ph">
        <div>
          <h2>Pipeline לידים</h2>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>{leads.filter(l => !['won','lost'].includes(l.leadStage)).length} פעילים</span>
            {atRiskCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ {atRiskCount} בסיכון</span>}
            {newToday   > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>+{newToday} היום</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <button
            className="btn btn-o btn-sm"
            onClick={() => setShowClosed(v => !v)}
            style={{ fontSize: 12 }}
          >
            {showClosed ? 'הסתר סגורים' : 'הצג סגורים'}
          </button>
          <button className="btn btn-p" onClick={() => setAddOpen(true)}>
            <Ico.plus/>ליד חדש
          </button>
        </div>
      </div>

      {/* ── Kanban board ─────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 14, minWidth: 'max-content', paddingBottom: 8 }}>
          {visibleStages.map(stage => (
            <KanbanCol
              key={stage.id}
              stage={stage}
              leads={leads.filter(l => l.leadStage === stage.id)}
              onDrop={onMoveStage}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {selected && (
        <LeadDetailsModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={(id, data) => { onUpdate(id, data); setSelected(p => ({ ...p, ...data })) }}
          onMoveStage={(id, stage) => { onMoveStage(id, stage); setSelected(p => ({ ...p, leadStage: stage })) }}
          onDelete={id => { onDelete(id); setSelected(null) }}
        />
      )}
      {addOpen && (
        <AddLeadModal
          onSave={async data => { await onAdd(data); setAddOpen(false) }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </>
  )
}
