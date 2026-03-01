-- ══════════════════════════════════════════════════════════════════════
-- WIN CRM — Patch Migration (FULL)
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. payments: add missing columns ─────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS notes   TEXT;

-- ── 2. hour_reports ───────────────────────────────────────────────────────
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
ALTER TABLE hour_reports ADD COLUMN IF NOT EXISTS subject TEXT;

DROP POLICY IF EXISTS "hour_reports_anon_insert"  ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_select" ON hour_reports;
DROP POLICY IF EXISTS "hour_reports_owner_delete" ON hour_reports;

CREATE POLICY "hour_reports_anon_insert" ON hour_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "hour_reports_owner_select" ON hour_reports
  FOR SELECT TO authenticated
  USING (instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid()));

CREATE POLICY "hour_reports_owner_delete" ON hour_reports
  FOR DELETE TO authenticated
  USING (instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid()));

-- ── 3. classes (CREATE with full schema) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Activity info
  class_name                  TEXT,
  activity_type               TEXT,
  location                    TEXT,          -- שם בית ספר / מתנ"ס
  city                        TEXT,
  contact_name                TEXT,
  contact_phone               TEXT,
  contact_id                  UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  year                        SMALLINT    DEFAULT 2026,
  month                       SMALLINT,

  -- Class details
  day                         TEXT,
  time_start                  TEXT,
  groups_count                SMALLINT    DEFAULT 1,
  students_count              SMALLINT,
  grades                      TEXT,
  sessions_count              SMALLINT,
  session_length              SMALLINT    DEFAULT 60,
  subject                     TEXT,

  -- Instructor
  instructor_id               UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  instructor_price_per_session NUMERIC,
  total_instructor_cost       NUMERIC,

  -- Income
  price_per_student           NUMERIC,
  price_per_session           NUMERIC,
  agreed_price                NUMERIC,
  actual_income               NUMERIC,
  payment_date                DATE,
  payment_method              TEXT,
  invoice_number              TEXT,
  paid                        BOOLEAN     NOT NULL DEFAULT false,

  -- Management
  status                      TEXT        DEFAULT 'פעיל',
  responsible                 TEXT,
  notes                       TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_owner_all" ON classes;
DROP POLICY IF EXISTS "classes_anon_read" ON classes;

CREATE POLICY "classes_owner_all" ON classes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "classes_anon_read" ON classes
  FOR SELECT TO anon USING (true);

-- Add any columns that might be missing if table already existed
ALTER TABLE classes ADD COLUMN IF NOT EXISTS city                        TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS contact_phone               TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS contact_id                  UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS activity_type               TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS year                        SMALLINT DEFAULT 2026;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS month                       SMALLINT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS time_start                  TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS groups_count                SMALLINT DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS students_count              SMALLINT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grades                      TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sessions_count              SMALLINT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS session_length              SMALLINT DEFAULT 60;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_per_student           NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_per_session           NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS agreed_price                NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS actual_income               NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS payment_method              TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS invoice_number              TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS payment_date                DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS paid                        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS instructor_price_per_session NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS total_instructor_cost       NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS status                      TEXT DEFAULT 'פעיל';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS responsible                 TEXT;

-- ── 4. class_attendance ───────────────────────────────────────────────────
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

-- ── 5. students: add class_id if missing ─────────────────────────────────
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

COMMIT;
