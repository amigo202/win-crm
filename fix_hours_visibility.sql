-- ══════════════════════════════════════════════════════════════════════
-- WIN CRM — Fix Hours Report Visibility + Admin Editing
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS throughout)
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Ensure owner_id exists on instructors ────────────────────────
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- ── 2. Backfill owner_id for all instructors that have NULL ─────────
DO $$
DECLARE first_uid UUID;
BEGIN
  SELECT id INTO first_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_uid IS NOT NULL THEN
    UPDATE instructors SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

-- ── 3. Ensure trigger function exists ───────────────────────────────
CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger on instructors
DROP TRIGGER IF EXISTS trg_instructors_owner ON instructors;
CREATE TRIGGER trg_instructors_owner
  BEFORE INSERT ON instructors
  FOR EACH ROW EXECUTE FUNCTION set_owner_id();

-- ── 4. Add status column to hour_reports for admin approval ─────────
ALTER TABLE hour_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Backfill existing reports as approved (they were already visible)
UPDATE hour_reports SET status = 'approved' WHERE status = 'pending'
  AND submitted_at < NOW() - INTERVAL '1 minute';

-- ── 5. Fix hour_reports RLS policies ────────────────────────────────
-- Drop and recreate all policies to ensure clean state
DROP POLICY IF EXISTS "hour_reports_anon_insert"  ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_anon_select"  ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_select" ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_delete" ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_update" ON hour_reports;

-- Anon can INSERT (instructor public portal)
CREATE POLICY "hour_reports_anon_insert" ON hour_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Anon can SELECT (instructor portal history — filtered client-side by instructor_id)
CREATE POLICY "hour_reports_anon_select" ON hour_reports
  FOR SELECT TO anon
  USING (true);

-- Owner can SELECT reports for their instructors
CREATE POLICY "hour_reports_owner_select" ON hour_reports
  FOR SELECT TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

-- Owner can UPDATE reports (edit hours, approve/reject, add notes)
CREATE POLICY "hour_reports_owner_update" ON hour_reports
  FOR UPDATE TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

-- Owner can DELETE reports
CREATE POLICY "hour_reports_owner_delete" ON hour_reports
  FOR DELETE TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

-- ── 6. Ensure instructors RLS allows owner access ───────────────────
-- Keep the original "crm_instructors" policy if it exists (backward compat)
-- Add owner-specific policies for finer control
DROP POLICY IF EXISTS "instructors_owner_insert" ON instructors;
CREATE POLICY "instructors_owner_insert" ON instructors
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

COMMIT;
