-- Portal v2 migration
-- Run this in Supabase SQL Editor AFTER hour_reports_migration.sql

-- 1. Allow instructors to read their own reports (needed for History tab)
CREATE POLICY "hour_reports_anon_select" ON hour_reports
  FOR SELECT TO anon
  USING (true);  -- filtered client-side by instructor_id (UUID is unguessable)

-- 2. Payslips table — owner sends, instructor views via portal
CREATE TABLE IF NOT EXISTS payslips (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID        REFERENCES instructors(id) ON DELETE CASCADE,
  month         INT         NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          INT         NOT NULL,
  amount        NUMERIC     NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Owner can manage payslips for their instructors
CREATE POLICY "payslips_owner_all" ON payslips
  FOR ALL TO authenticated
  USING (
    instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    instructor_id IN (SELECT id FROM instructors WHERE owner_id = auth.uid())
  );

-- Instructors can read their own payslips via portal (anon)
CREATE POLICY "payslips_anon_read" ON payslips
  FOR SELECT TO anon
  USING (true);  -- filtered client-side by instructor_id
