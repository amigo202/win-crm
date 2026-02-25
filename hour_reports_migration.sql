-- hour_reports: instructor hours submitted via shareable public form
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS hour_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID        REFERENCES instructors(id) ON DELETE CASCADE,
  report_date   DATE        NOT NULL,
  hours         NUMERIC     NOT NULL DEFAULT 0,
  program       TEXT,
  location      TEXT,
  notes         TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hour_reports ENABLE ROW LEVEL SECURITY;

-- Instructors can insert via public form (no auth needed)
CREATE POLICY "hour_reports_anon_insert" ON hour_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only the owner can read reports for their instructors
CREATE POLICY "hour_reports_owner_select" ON hour_reports
  FOR SELECT TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );

-- Only the owner can delete reports
CREATE POLICY "hour_reports_owner_delete" ON hour_reports
  FOR DELETE TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM instructors WHERE owner_id = auth.uid()
    )
  );
