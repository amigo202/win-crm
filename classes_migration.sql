-- ============================================================
-- WIN CRM — Classes & Attendance Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Classes table
CREATE TABLE IF NOT EXISTS classes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network          TEXT,
  settlement       TEXT,
  location         TEXT,
  contact_name     TEXT,
  day              TEXT,
  time             TEXT,
  subject          TEXT,
  class_name       TEXT,
  instructor_id    UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  monthly_fee      NUMERIC     NOT NULL DEFAULT 0,
  instructor_cost  NUMERIC     NOT NULL DEFAULT 0,
  invoice_number   TEXT,
  send_date        DATE,
  payment_date     DATE,
  paid             BOOLEAN     NOT NULL DEFAULT false,
  collection_status TEXT,
  next_action      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "classes_owner_all" ON classes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Portal (anon): instructor can read their own assigned classes
CREATE POLICY "classes_anon_read" ON classes FOR SELECT TO anon USING (true);

-- 2. Attendance table (instructor marks session attendance per class)
CREATE TABLE IF NOT EXISTS class_attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID        REFERENCES classes(id) ON DELETE CASCADE,
  instructor_id UUID        REFERENCES instructors(id),
  session_date  DATE        NOT NULL,
  students_data JSONB,      -- [{student_id, student_name, present}]
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_owner_all" ON class_attendance FOR ALL TO authenticated
  USING (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()));

CREATE POLICY "attendance_anon_all" ON class_attendance FOR ALL TO anon USING (true);

-- 3. Add subject column to hour_reports
ALTER TABLE hour_reports ADD COLUMN IF NOT EXISTS subject TEXT;

-- 4. Link students to classes
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
