-- ═══════════════════════════════════════════════════════════════
-- WIN CRM — Phase 2: Multi-tenant permissions
-- Run in Supabase SQL Editor (safe to re-run — uses IF NOT EXISTS / DROP IF EXISTS)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- §1  Trigger function: stamp updated_at on every UPDATE
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- §2  Trigger function: auto-assign owner_id = auth.uid() on INSERT
--     Runs BEFORE INSERT so the value is in place before constraint checks.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- §3  Add missing columns
--     contacts already has id, created_at, updated_at — only needs owner_id.
--     deals / tasks / instructors / students need both owner_id and updated_at.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE contacts    ADD COLUMN IF NOT EXISTS owner_id   uuid        REFERENCES auth.users(id);

ALTER TABLE deals       ADD COLUMN IF NOT EXISTS owner_id   uuid        REFERENCES auth.users(id);
ALTER TABLE deals       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS owner_id   uuid        REFERENCES auth.users(id);
ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS owner_id   uuid        REFERENCES auth.users(id);
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE students    ADD COLUMN IF NOT EXISTS owner_id   uuid        REFERENCES auth.users(id);
ALTER TABLE students    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ────────────────────────────────────────────────────────────────
-- §4  Backfill owner_id for any pre-existing rows
--     Assigns all existing data to the oldest user in auth.users
--     (the founding account — safe for a single-team CRM).
--     No-op if the tables are already empty.
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  first_uid uuid;
BEGIN
  SELECT id INTO first_uid
    FROM auth.users
   ORDER BY created_at
   LIMIT 1;

  IF first_uid IS NOT NULL THEN
    UPDATE contacts    SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE deals       SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE tasks       SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE instructors SET owner_id = first_uid WHERE owner_id IS NULL;
    UPDATE students    SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- §5  Make owner_id NOT NULL (safe now that backfill is done)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE contacts    ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE deals       ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE tasks       ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE instructors ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE students    ALTER COLUMN owner_id SET NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- §6  Install triggers
-- ────────────────────────────────────────────────────────────────

-- Drop first so the script is idempotent
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

-- updated_at — fire on every UPDATE row
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON deals       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_instructors_updated_at
  BEFORE UPDATE ON instructors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- owner_id — fire on INSERT so the app never needs to pass it explicitly
CREATE TRIGGER trg_contacts_owner
  BEFORE INSERT ON contacts    FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_deals_owner
  BEFORE INSERT ON deals       FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_tasks_owner
  BEFORE INSERT ON tasks       FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_instructors_owner
  BEFORE INSERT ON instructors FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_students_owner
  BEFORE INSERT ON students    FOR EACH ROW EXECUTE FUNCTION set_owner_id();

-- ────────────────────────────────────────────────────────────────
-- §7  Replace wide-open policies with per-owner policies
-- ────────────────────────────────────────────────────────────────

-- Drop the old catch-all policies from schema.sql / phase 0
DROP POLICY IF EXISTS "crm_contacts"    ON contacts;
DROP POLICY IF EXISTS "crm_deals"       ON deals;
DROP POLICY IF EXISTS "crm_tasks"       ON tasks;
DROP POLICY IF EXISTS "crm_instructors" ON instructors;
DROP POLICY IF EXISTS "crm_students"    ON students;

-- Drop any previous phase-2 attempt (idempotent)
DROP POLICY IF EXISTS "contacts_select"    ON contacts;
DROP POLICY IF EXISTS "contacts_insert"    ON contacts;
DROP POLICY IF EXISTS "contacts_update"    ON contacts;
DROP POLICY IF EXISTS "contacts_delete"    ON contacts;
DROP POLICY IF EXISTS "deals_select"       ON deals;
DROP POLICY IF EXISTS "deals_insert"       ON deals;
DROP POLICY IF EXISTS "deals_update"       ON deals;
DROP POLICY IF EXISTS "deals_delete"       ON deals;
DROP POLICY IF EXISTS "tasks_select"       ON tasks;
DROP POLICY IF EXISTS "tasks_insert"       ON tasks;
DROP POLICY IF EXISTS "tasks_update"       ON tasks;
DROP POLICY IF EXISTS "tasks_delete"       ON tasks;
DROP POLICY IF EXISTS "instructors_select" ON instructors;
DROP POLICY IF EXISTS "instructors_insert" ON instructors;
DROP POLICY IF EXISTS "instructors_update" ON instructors;
DROP POLICY IF EXISTS "instructors_delete" ON instructors;
DROP POLICY IF EXISTS "students_select"    ON students;
DROP POLICY IF EXISTS "students_insert"    ON students;
DROP POLICY IF EXISTS "students_update"    ON students;
DROP POLICY IF EXISTS "students_delete"    ON students;

-- ── contacts ─────────────────────────────────────────────────────
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── deals ─────────────────────────────────────────────────────────
CREATE POLICY "deals_select" ON deals
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "deals_insert" ON deals
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_update" ON deals
  FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "deals_delete" ON deals
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── tasks ─────────────────────────────────────────────────────────
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── instructors ───────────────────────────────────────────────────
CREATE POLICY "instructors_select" ON instructors
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "instructors_insert" ON instructors
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "instructors_update" ON instructors
  FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "instructors_delete" ON instructors
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── students ──────────────────────────────────────────────────────
CREATE POLICY "students_select" ON students
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "students_insert" ON students
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "students_update" ON students
  FOR UPDATE TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "students_delete" ON students
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- OPTIONAL — Organizations layer
-- Run this block separately only when you need multi-user teams.
-- The core CRM above works perfectly without it.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── organizations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── memberships ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS memberships (
  org_id     uuid     NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid     NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role       org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- ── RLS on org tables ─────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_select"         ON organizations;
DROP POLICY IF EXISTS "memberships_select"  ON memberships;
DROP POLICY IF EXISTS "memberships_insert"  ON memberships;

-- Any org member can see the org
CREATE POLICY "orgs_select" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- Members can see their own memberships
CREATE POLICY "memberships_select" ON memberships
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- Only org owners/admins can add members (enforced in app; RLS enforces read safety)
CREATE POLICY "memberships_insert" ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM memberships
       WHERE user_id = auth.uid()
         AND role IN ('owner', 'admin')
    )
  );

-- ── Add org_id to CRM tables ──────────────────────────────────────
ALTER TABLE contacts    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE deals       ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE tasks       ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE students    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- ── Helper: check membership (stable, avoids repeated subquery) ───
CREATE OR REPLACE FUNCTION is_org_member(oid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
     WHERE org_id = oid AND user_id = auth.uid()
  );
$$;

-- ── Upgrade SELECT policies to include org access ─────────────────
-- (INSERT/UPDATE/DELETE remain owner_id-only — org row writes need
--  explicit app-level logic to set org_id correctly.)

DROP POLICY IF EXISTS "contacts_select"    ON contacts;
DROP POLICY IF EXISTS "deals_select"       ON deals;
DROP POLICY IF EXISTS "tasks_select"       ON tasks;
DROP POLICY IF EXISTS "instructors_select" ON instructors;
DROP POLICY IF EXISTS "students_select"    ON students;

CREATE POLICY "contacts_select" ON contacts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (org_id IS NOT NULL AND is_org_member(org_id)));

CREATE POLICY "deals_select" ON deals
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (org_id IS NOT NULL AND is_org_member(org_id)));

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (org_id IS NOT NULL AND is_org_member(org_id)));

CREATE POLICY "instructors_select" ON instructors
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (org_id IS NOT NULL AND is_org_member(org_id)));

CREATE POLICY "students_select" ON students
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (org_id IS NOT NULL AND is_org_member(org_id)));

COMMIT;
