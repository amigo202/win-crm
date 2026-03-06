import { useState } from 'react'
import { LeadsContent } from './LeadsPipelinePage'
import { DealsContent } from './DealsPage'

export default function SalesPage({
  leads, onAddLead, onUpdateLead, onMoveStage, onDeleteLead, onReloadLeads,
  deals, contacts, onAddDeal, onUpdateDeal, onDeleteDeal,
}) {
  const [tab, setTab] = useState('leads')

  return (
    <>
      <div className="ph">
        <h2>מכירות</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab ${tab === 'leads' ? 'on' : ''}`} onClick={() => setTab('leads')}>לידים</button>
            <button className={`tab ${tab === 'deals' ? 'on' : ''}`} onClick={() => setTab('deals')}>עסקאות</button>
          </div>
        </div>
      </div>

      {tab === 'leads' && (
        <LeadsContent
          leads={leads}
          onAdd={onAddLead}
          onUpdate={onUpdateLead}
          onMoveStage={onMoveStage}
          onDelete={onDeleteLead}
          onReload={onReloadLeads}
          hideHeader
        />
      )}
      {tab === 'deals' && (
        <DealsContent
          deals={deals}
          contacts={contacts}
          onAdd={onAddDeal}
          onUpdate={onUpdateDeal}
          onDelete={onDeleteDeal}
          hideHeader
        />
      )}
    </>
  )
}
