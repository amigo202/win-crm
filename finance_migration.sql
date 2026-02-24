-- payments: income per contact/program/month
CREATE TABLE IF NOT EXISTS payments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  instructor_id UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  amount        NUMERIC     NOT NULL DEFAULT 0,
  month         SMALLINT    NOT NULL,
  year          SMALLINT    NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  program       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id      UUID        REFERENCES auth.users(id)
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_owner" ON payments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (true);
CREATE TRIGGER trg_payments_owner      BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- salaries: expense per instructor/month with tax breakdown
-- net_salary is auto-computed by PostgreSQL as a generated column
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
CREATE POLICY "salaries_owner" ON salaries FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (true);
CREATE TRIGGER trg_salaries_owner      BEFORE INSERT ON salaries FOR EACH ROW EXECUTE FUNCTION set_owner_id();
CREATE TRIGGER trg_salaries_updated_at BEFORE UPDATE ON salaries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
