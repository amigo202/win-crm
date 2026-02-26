-- ══════════════════════════════════════════════════════════════════════
-- WIN CRM — Patch Migration
-- Fixes:
--   1. instructor_id missing from payments table
--   2. hour_reports table missing / missing subject column
--   3. classes table missing new columns for Classes & Courses page
--
-- Run this once in Supabase SQL Editor → paste all → Run
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS everywhere
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. payments: add instructor_id if missing ─────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL;

-- ── 2. hour_reports table ─────────────────────────────────────────────────
-- Create if it doesn't exist yet
CREATE TABLE IF NOT EXISTS hour_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID        REFERENCES instructors(id) ON DELETE CASCADE,
  report_date   DATE        NOT NULL,
  hours         NUMERIC     NOT NULL DEFAULT 0,
  location      TEXT,
  subject       TEXT,
  notes         TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hour_reports ENABLE ROW LEVEL SECURITY;

-- Add subject if the table existed before without it
ALTER TABLE hour_reports ADD COLUMN IF NOT EXISTS subject TEXT;

-- Policies (idempotent)
DROP POLICY IF EXISTS "hour_reports_anon_insert"    ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_select"   ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_delete"   ON hour_reports;

CREATE POLICY "hour_reports_anon_insert" ON hour_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "hour_reports_owner_select" ON hour_reports
  FOR SELECT TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "hour_reports_owner_delete" ON hour_reports
  FOR DELETE TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

-- ── 3. classes: add new columns for Classes & Courses page ───────────────
-- Core info
ALTER TABLE classes ADD COLUMN IF NOT EXISTS city                      TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS contact_phone             TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS contact_id                UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS activity_type             TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS year                      SMALLINT DEFAULT 2026;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS month                     SMALLINT;

-- Class details
ALTER TABLE classes ADD COLUMN IF NOT EXISTS time_start               TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS groups_count             SMALLINT DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS students_count           SMALLINT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grades                   TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sessions_count           SMALLINT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS session_length           SMALLINT DEFAULT 60;

-- Income
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_per_student        NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_per_session        NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS agreed_price             NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS actual_income            NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS payment_method           TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS invoice_number           TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS payment_date             DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS paid                     BOOLEAN NOT NULL DEFAULT false;

-- Instructor cost
ALTER TABLE classes ADD COLUMN IF NOT EXISTS instructor_price_per_session NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS total_instructor_cost    NUMERIC;

-- Management
ALTER TABLE classes ADD COLUMN IF NOT EXISTS status                   TEXT DEFAULT 'פעיל';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS responsible              TEXT;

-- Also add class_attendance if not exists (for instructor portal)
CREATE TABLE IF NOT EXISTS class_attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID        REFERENCES classes(id) ON DELETE CASCADE,
  instructor_id UUID        REFERENCES instructors(id),
  session_date  DATE        NOT NULL,
  students_data JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_owner_all" ON class_attendance;
DROP POLICY IF EXISTS "attendance_anon_all"  ON class_attendance;

CREATE POLICY "attendance_owner_all" ON class_attendance
  FOR ALL TO authenticated
  USING  (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()));

CREATE POLICY "attendance_anon_all" ON class_attendance
  FOR ALL TO anon USING (true);

-- Add class_id to students if missing
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

COMMIT;
