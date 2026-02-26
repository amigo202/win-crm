-- ════════════════════════════════════════════════════════════════
-- WIN CRM — Create salaries table ONLY
-- Paste this entire script into Supabase SQL Editor → Run
-- Safe to re-run (IF NOT EXISTS / DROP IF EXISTS)
-- ════════════════════════════════════════════════════════════════

-- Helper functions (safe no-op if they already exist)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Salaries table
CREATE TABLE IF NOT EXISTS salaries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id      UUID        REFERENCES instructors(id) ON DELETE CASCADE,
  month              SMALLINT    NOT NULL,
  year               SMALLINT    NOT NULL,
  base_salary        NUMERIC     NOT NULL DEFAULT 0,
  additions          NUMERIC     NOT NULL DEFAULT 0,
  deductions         NUMERIC     NOT NULL DEFAULT 0,
  tax                NUMERIC     NOT NULL DEFAULT 0,
  national_insurance NUMERIC     NOT NULL DEFAULT 0,
  health_insurance   NUMERIC     NOT NULL DEFAULT 0,
  net_salary         NUMERIC GENERATED ALWAYS AS
    (base_salary + additions - deductions - tax - national_insurance - health_insurance) STORED,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id           UUID        REFERENCES auth.users(id),
  UNIQUE (instructor_id, month, year)
);

ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salaries_owner" ON salaries;
CREATE POLICY "salaries_owner" ON salaries
  FOR ALL TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

DROP TRIGGER IF EXISTS trg_salaries_owner      ON salaries;
DROP TRIGGER IF EXISTS trg_salaries_updated_at ON salaries;

CREATE TRIGGER trg_salaries_owner
  BEFORE INSERT ON salaries
  FOR EACH ROW EXECUTE FUNCTION set_owner_id();

CREATE TRIGGER trg_salaries_updated_at
  BEFORE UPDATE ON salaries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
