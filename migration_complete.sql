-- ═══════════════════════════════════════════════════════════════════
-- WIN CRM — Complete Migration (Phase 0 + Phase 2 + Leads)
-- Run ONCE in Supabase SQL Editor → paste all → Run
-- Safe to re-run (IF NOT EXISTS / OR REPLACE throughout)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- §1  activities table (needed by Edge Functions + leadsService)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL DEFAULT 'note',
  description TEXT        NOT NULL DEFAULT '',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_contact_id_idx ON activities(contact_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at DESC);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_all" ON activities;
CREATE POLICY "activities_all" ON activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────
-- §2  Add owner_id to all tables
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE contacts    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
ALTER TABLE deals       ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
ALTER TABLE students    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

ALTER TABLE deals       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE students    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill owner_id for existing rows → assign to first/only user
DO $$
DECLARE first_uid uuid;
BEGIN
  SELECT id INTO first_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_uid IS NOT NULL THEN
    UPDATE contacts    SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE deals       SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE tasks       SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE instructors SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE students    SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- §3  Contacts — leads pipeline columns
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_stage       TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS at_risk          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE contacts SET last_activity_at = created_at WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage ON contacts(lead_stage) WHERE lead_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_at_risk    ON contacts(at_risk)    WHERE at_risk = true;

-- ────────────────────────────────────────────────────────────────────
-- §4  Tasks — snooze + auto_generated
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS snoozed_until  DATE,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_snooze ON tasks(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due    ON tasks(due_date)      WHERE NOT completed;

-- ────────────────────────────────────────────────────────────────────
-- §5  Trigger functions
-- ────────────────────────────────────────────────────────────────────

-- updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- owner_id: only set if NULL (allows Edge Functions to pass explicit value)
CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

-- stamp contacts.last_activity_at on new activity
CREATE OR REPLACE FUNCTION stamp_contact_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts SET last_activity_at = NEW.created_at WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

-- stamp tasks.completed_at
CREATE OR REPLACE FUNCTION stamp_task_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN NEW.completed_at = now();
  ELSIF NEW.completed = false THEN NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- §6  Install triggers (drop first for idempotency)
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_contacts_updated_at    ON contacts;
DROP TRIGGER IF EXISTS trg_deals_updated_at       ON deals;
DROP TRIGGER IF EXISTS trg_tasks_updated_at       ON tasks;
DROP TRIGGER IF EXISTS trg_instructors_updated_at ON instructors;
DROP TRIGGER IF EXISTS trg_students_updated_at    ON students;

DROP TRIGGER IF EXISTS trg_contacts_owner    ON contacts;
DROP TRIGGER IF EXISTS trg_deals_owner       ON deals;
DROP TRIGGER IF EXISTS trg_tasks_owner       ON tasks;
DROP TRIGGER IF EXISTS trg_instructors_owner ON instructors;
DROP TRIGGER IF EXISTS trg_students_owner    ON students;

DROP TRIGGER IF EXISTS trg_activities_stamp_contact ON activities;
DROP TRIGGER IF EXISTS trg_tasks_completed_at       ON tasks;

CREATE TRIGGER trg_contacts_updated_at    BEFORE UPDATE ON contacts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_deals_updated_at       BEFORE UPDATE ON deals       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at       BEFORE UPDATE ON tasks       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_instructors_updated_at BEFORE UPDATE ON instructors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated_at    BEFORE UPDATE ON students    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_owner    BEFORE INSERT ON contacts    FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_deals_owner       BEFORE INSERT ON deals       FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_tasks_owner       BEFORE INSERT ON tasks       FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_instructors_owner BEFORE INSERT ON instructors FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_students_owner    BEFORE INSERT ON students    FOR EACH ROW EXECUTE FUNCTION set_owner_id();

CREATE TRIGGER trg_activities_stamp_contact AFTER INSERT ON activities FOR EACH ROW EXECUTE FUNCTION stamp_contact_last_activity();
CREATE TRIGGER trg_tasks_completed_at       BEFORE UPDATE ON tasks     FOR EACH ROW EXECUTE FUNCTION stamp_task_completed();

-- ────────────────────────────────────────────────────────────────────
-- §7  RLS policies (replace open policies with owner-scoped ones)
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crm_contacts"    ON contacts;
DROP POLICY IF EXISTS "crm_deals"       ON deals;
DROP POLICY IF EXISTS "crm_tasks"       ON tasks;
DROP POLICY IF EXISTS "crm_instructors" ON instructors;
DROP POLICY IF EXISTS "crm_students"    ON students;

DROP POLICY IF EXISTS "contacts_select" ON contacts; DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts; DROP POLICY IF EXISTS "contacts_delete" ON contacts;
DROP POLICY IF EXISTS "deals_select"    ON deals;    DROP POLICY IF EXISTS "deals_insert"    ON deals;
DROP POLICY IF EXISTS "deals_update"    ON deals;    DROP POLICY IF EXISTS "deals_delete"    ON deals;
DROP POLICY IF EXISTS "tasks_select"    ON tasks;    DROP POLICY IF EXISTS "tasks_insert"    ON tasks;
DROP POLICY IF EXISTS "tasks_update"    ON tasks;    DROP POLICY IF EXISTS "tasks_delete"    ON tasks;
DROP POLICY IF EXISTS "instructors_select" ON instructors; DROP POLICY IF EXISTS "instructors_insert" ON instructors;
DROP POLICY IF EXISTS "instructors_update" ON instructors; DROP POLICY IF EXISTS "instructors_delete" ON instructors;
DROP POLICY IF EXISTS "students_select" ON students; DROP POLICY IF EXISTS "students_insert" ON students;
DROP POLICY IF EXISTS "students_update" ON students; DROP POLICY IF EXISTS "students_delete" ON students;

-- contacts
CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- deals
CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- instructors
CREATE POLICY "instructors_select" ON instructors FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "instructors_insert" ON instructors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "instructors_update" ON instructors FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "instructors_delete" ON instructors FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- students
CREATE POLICY "students_select" ON students FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "students_insert" ON students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "students_update" ON students FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "students_delete" ON students FOR DELETE TO authenticated USING (owner_id = auth.uid());

COMMIT;
