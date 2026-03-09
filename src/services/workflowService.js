import { supabase } from '../lib/supabase'
import { createTask } from './tasksService'

// ── Mappers ────────────────────────────────────────────────────────
function fromDbRule(r) {
  return {
    id:          r.id,
    ownerId:     r.owner_id,
    name:        r.name,
    description: r.description || '',
    triggerType: r.trigger_type,
    conditions:  r.conditions || [],
    actions:     r.actions || [],
    enabled:     r.enabled,
    runCount:    r.run_count || 0,
    lastRunAt:   r.last_run_at,
    createdAt:   r.created_at,
  }
}

function toDbRule(r) {
  return {
    name:         r.name,
    description:  r.description || null,
    trigger_type: r.triggerType,
    conditions:   r.conditions || [],
    actions:      r.actions || [],
    enabled:      r.enabled !== false,
  }
}

// ── CRUD ───────────────────────────────────────────────────────────
let _fetchRulesWarned = false
export async function fetchRules() {
  const { data, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (!_fetchRulesWarned) { console.warn('fetchRules: table may not exist yet –', error.message); _fetchRulesWarned = true }
    return []
  }
  return data.map(fromDbRule)
}

export async function createRule(data) {
  const { data: row, error } = await supabase
    .from('workflow_rules').insert(toDbRule(data)).select().single()
  if (error) throw error
  return fromDbRule(row)
}

export async function updateRule(id, data) {
  const { error } = await supabase
    .from('workflow_rules').update(toDbRule(data)).eq('id', id)
  if (error) throw error
}

export async function deleteRule(id) {
  const { error } = await supabase.from('workflow_rules').delete().eq('id', id)
  if (error) throw error
}

export async function toggleRule(id, enabled) {
  const { error } = await supabase
    .from('workflow_rules').update({ enabled }).eq('id', id)
  if (error) throw error
}

// ── Condition Evaluator ────────────────────────────────────────────
export function evaluateConditions(conditions, context) {
  if (!conditions || !conditions.length) return true
  return conditions.every(cond => {
    const fieldVal = context[cond.field]
    switch (cond.operator) {
      case '==': return String(fieldVal) === String(cond.value)
      case '!=': return String(fieldVal) !== String(cond.value)
      case '>':  return Number(fieldVal) > Number(cond.value)
      case '<':  return Number(fieldVal) < Number(cond.value)
      case '>=': return Number(fieldVal) >= Number(cond.value)
      case '<=': return Number(fieldVal) <= Number(cond.value)
      case 'contains': return String(fieldVal || '').includes(cond.value)
      default: return false
    }
  })
}

// ── Variable Interpolation ─────────────────────────────────────────
function interpolateVars(str, context) {
  if (typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? '')
}

// ── Action Executor ────────────────────────────────────────────────
export async function executeActions(actions, context) {
  const results = []
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_task': {
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (action.data?.dueDaysFromNow || 2))
          await createTask({
            title:    interpolateVars(action.data?.title || 'משימה אוטומטית', context),
            priority: action.data?.priority || 'high',
            dueDate:  dueDate.toISOString().split('T')[0],
            contactId: context.contactId || context.id || null,
          })
          results.push({ type: action.type, status: 'ok' })
          break
        }
        case 'create_activity_log': {
          if (context.contactId || context.id) {
            await supabase.from('activities').insert({
              contact_id:  context.contactId || context.id,
              type:        'note',
              description: interpolateVars(action.data?.description || 'פעילות אוטומטית', context),
            })
          }
          results.push({ type: action.type, status: 'ok' })
          break
        }
        case 'update_status': {
          if ((context.contactId || context.id) && action.data?.field) {
            await supabase.from('contacts')
              .update({ [action.data.field]: action.data.value })
              .eq('id', context.contactId || context.id)
          }
          results.push({ type: action.type, status: 'ok' })
          break
        }
        case 'send_whatsapp_template': {
          // Will be implemented in Feature 3 - for now log it
          console.log('Workflow: send_whatsapp_template (not yet configured)', action.data)
          results.push({ type: action.type, status: 'skipped', reason: 'not_configured' })
          break
        }
        case 'send_email': {
          // Will be implemented in Feature 4 - for now log it
          console.log('Workflow: send_email (not yet configured)', action.data)
          results.push({ type: action.type, status: 'skipped', reason: 'not_configured' })
          break
        }
        case 'show_notification': {
          // Import toast dynamically to avoid circular deps
          const msg = interpolateVars(action.data?.message || '', context)
          if (typeof window !== 'undefined' && window.__crm_toast) {
            window.__crm_toast(msg)
          }
          results.push({ type: action.type, status: 'ok' })
          break
        }
        default:
          results.push({ type: action.type, status: 'unknown_action' })
      }
    } catch (err) {
      console.error('Workflow action error:', action.type, err)
      results.push({ type: action.type, status: 'error', error: err.message })
    }
  }
  return results
}

// ── Main runner — called from services at trigger points ───────────
let _runWfWarned = false
export async function runWorkflows(triggerType, context) {
  try {
    const { data: rules, error } = await supabase
      .from('workflow_rules')
      .select('*')
      .eq('trigger_type', triggerType)
      .eq('enabled', true)

    if (error) {
      if (!_runWfWarned) { console.warn('runWorkflows: table may not exist yet'); _runWfWarned = true }
      return
    }
    if (!rules?.length) return

    for (const rule of rules) {
      if (evaluateConditions(rule.conditions, context)) {
        const results = await executeActions(rule.actions, context)

        // Log execution
        await supabase.from('workflow_logs').insert({
          rule_id:      rule.id,
          trigger_type: triggerType,
          trigger_data: context,
          actions_run:  results,
          status:       results.every(r => r.status === 'ok') ? 'success' : 'partial',
        }).then(() => {})

        // Update run count
        await supabase.from('workflow_rules')
          .update({ run_count: (rule.run_count || 0) + 1, last_run_at: new Date().toISOString() })
          .eq('id', rule.id)
      }
    }
  } catch (err) {
    console.error('runWorkflows error:', triggerType, err)
  }
}
