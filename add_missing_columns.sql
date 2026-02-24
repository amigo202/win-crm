-- ═══════════════════════════════════════════════════════════════════
-- WIN CRM — Add Missing Columns
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- ═══════════════════════════════════════════════════════════════════

-- ── contacts: leads pipeline columns ────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_stage       TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS lead_score       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS at_risk          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE contacts SET last_activity_at = created_at WHERE last_activity_at IS NULL;

-- ── contacts: owner_id (multi-tenant) ───────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE deals    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Backfill owner_id → assign to first user
DO $$
DECLARE first_uid UUID;
BEGIN
  SELECT id INTO first_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_uid IS NOT NULL THEN
    UPDATE contacts SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE deals    SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE tasks    SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

-- ── tasks: snooze + auto_generated ──────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS snoozed_until  DATE,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

-- ── activities table (if missing) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL DEFAULT 'note',
  description TEXT        NOT NULL DEFAULT '',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_all" ON activities;
CREATE POLICY "activities_all" ON activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage ON contacts(lead_stage) WHERE lead_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_at_risk    ON contacts(at_risk)    WHERE at_risk = true;
CREATE INDEX IF NOT EXISTS idx_tasks_snooze        ON tasks(snoozed_until) WHERE snoozed_until IS NOT NULL;
