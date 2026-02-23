-- ═══════════════════════════════════════════════════════════════════
-- WIN CRM — Leads / Pipeline / Tasks snooze migration
-- Run ONCE in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE throughout)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- §1  Fix set_owner_id trigger so Edge Functions can supply explicit
--     owner_id without it being overwritten by auth.uid() (which is
--     NULL in server-side / service-role contexts).
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- §2  contacts — lead pipeline columns
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_stage       TEXT,                              -- NULL = not in pipeline
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual',    -- website|whatsapp|facebook|instagram|referral|manual|csv
  ADD COLUMN IF NOT EXISTS at_risk          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill last_activity_at for existing contacts that have no value
UPDATE contacts
   SET last_activity_at = created_at
 WHERE last_activity_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage ON contacts(lead_stage) WHERE lead_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_at_risk    ON contacts(at_risk)    WHERE at_risk = true;
CREATE INDEX IF NOT EXISTS idx_contacts_source     ON contacts(source);

-- ────────────────────────────────────────────────────────────────────
-- §3  activities — add deal link (was NULL in Phase 0)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id) WHERE deal_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────
-- §4  tasks — snooze + auto_generated + deal link
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS snoozed_until  DATE,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_id        UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_snooze  ON tasks(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due     ON tasks(due_date)      WHERE NOT completed;

-- ────────────────────────────────────────────────────────────────────
-- §5  Trigger: auto-stamp contacts.last_activity_at when an activity
--     is inserted for that contact.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION stamp_contact_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
       SET last_activity_at = NEW.created_at
     WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activities_stamp_contact ON activities;
CREATE TRIGGER trg_activities_stamp_contact
  AFTER INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION stamp_contact_last_activity();

-- ────────────────────────────────────────────────────────────────────
-- §6  Trigger: stamp completed_at when task is marked done
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION stamp_task_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = now();
  ELSIF NEW.completed = false THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_completed_at ON tasks;
CREATE TRIGGER trg_tasks_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION stamp_task_completed();

COMMIT;
