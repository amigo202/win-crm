import { supabase } from '../lib/supabase'
import { LEAD_STAGES } from '../constants'

// ── Mapper ─────────────────────────────────────────────────────────
export function fromDbLead(r) {
  return {
    id:             r.id,
    ownerId:        r.owner_id,
    name:           r.name,
    phone:          r.phone,
    email:          r.email,
    city:           r.city,
    type:           r.type,
    source:         r.source || 'manual',
    leadStage:      r.lead_stage,
    status:         r.status,
    atRisk:         r.at_risk || false,
    lastActivityAt: r.last_activity_at,
    createdAt:      r.created_at,
    notes:          r.notes || [],
    tags:           r.tags  || [],
  }
}

// ── Fetch all leads (contacts in the pipeline) ─────────────────────
export async function fetchLeads() {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, owner_id, name, phone, email, city, type, source, lead_stage, status, at_risk, last_activity_at, created_at, notes, tags')
    .not('lead_stage', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromDbLead)
}

// ── Create a new lead manually ─────────────────────────────────────
export async function createLead(data) {
  const { data: row, error } = await supabase
    .from('contacts')
    .insert({
      name:            data.name,
      phone:           data.phone    || null,
      email:           data.email?.toLowerCase().trim() || null,
      city:            data.city     || null,
      type:            data.type     || 'other',
      source:          data.source   || 'manual',
      lead_stage:      'new',
      status:          'lead',
      last_activity_at: new Date().toISOString(),
      active_programs: [],
      notes:           [],
      activities:      [],
      tags:            [],
    })
    .select('id, owner_id, name, phone, email, city, type, source, lead_stage, status, at_risk, last_activity_at, created_at, notes, tags')
    .single()
  if (error) throw error

  // Log activity
  await supabase.from('activities').insert({
    contact_id:  row.id,
    type:        'lead_created',
    description: `ליד נוצר ידנית`,
  })

  // Automation: create follow-up task in 2 days
  await _createAutoTask(row.id, `פולואפ עם ${row.name}`, 2, 'high')

  return fromDbLead(row)
}

// ── Update lead fields (name, phone, etc.) ─────────────────────────
export async function updateLead(id, data) {
  const { error } = await supabase
    .from('contacts')
    .update({
      name:   data.name,
      phone:  data.phone  || null,
      email:  data.email?.toLowerCase().trim() || null,
      city:   data.city   || null,
      source: data.source || 'manual',
    })
    .eq('id', id)
  if (error) throw error
}

// ── Move lead to a new pipeline stage (with automations) ───────────
export async function updateLeadStage(id, newStage, prevStage, contactName) {
  const stageLabel = s => LEAD_STAGES.find(x => x.id === s)?.label || s

  const updates = { lead_stage: newStage }
  if (newStage === 'won')  updates.status = 'customer'
  if (newStage === 'lost') updates.status = 'inactive'

  const { error } = await supabase.from('contacts').update(updates).eq('id', id)
  if (error) throw error

  // Log stage-change activity (this also triggers stamp_contact_last_activity)
  await supabase.from('activities').insert({
    contact_id:  id,
    type:        'stage_change',
    description: `שלב עודכן: ${stageLabel(prevStage)} ← ${stageLabel(newStage)}`,
  })

  // Automation: proposal → follow-up task in 3 days
  if (newStage === 'proposal') {
    await _createAutoTask(id, `שלח הצעת מחיר ל-${contactName}`, 3, 'high')
  }
}

// ── Update at_risk flag in bulk ────────────────────────────────────
export async function bulkSetAtRisk(atRiskIds, recoveredIds) {
  const ops = []
  if (atRiskIds.length)   ops.push(supabase.from('contacts').update({ at_risk: true  }).in('id', atRiskIds))
  if (recoveredIds.length) ops.push(supabase.from('contacts').update({ at_risk: false }).in('id', recoveredIds))
  if (ops.length) await Promise.all(ops)
}

// ── Delete lead from pipeline (removes from contacts entirely) ─────
export async function deleteLead(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw error
}

// ── Internal: create an auto-generated follow-up task ─────────────
async function _createAutoTask(contactId, title, daysFromNow, priority) {
  const due = new Date()
  due.setDate(due.getDate() + daysFromNow)

  await supabase.from('tasks').insert({
    contact_id:     contactId,
    title,
    priority,
    due_date:       due.toISOString().split('T')[0],
    completed:      false,
    auto_generated: true,
  })
}
