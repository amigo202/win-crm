-- ============================================================
-- TAX RADAR / חדר בקרה פיננסי — Migration
-- הרץ את הקובץ הזה ב-Supabase SQL Editor
-- ============================================================

-- 1. טבלת חודשים פיננסיים
CREATE TABLE IF NOT EXISTS finance_months (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  year                  INT  NOT NULL,
  month                 INT  NOT NULL CHECK (month BETWEEN 1 AND 12),
  income                NUMERIC(12,2) DEFAULT 0,
  payroll_expenses      NUMERIC(12,2) DEFAULT 0,
  subcontractors        NUMERIC(12,2) DEFAULT 0,
  professional_services NUMERIC(12,2) DEFAULT 0,
  software_expenses     NUMERIC(12,2) DEFAULT 0,
  marketing_expenses    NUMERIC(12,2) DEFAULT 0,
  vehicle_expenses      NUMERIC(12,2) DEFAULT 0,
  office_expenses       NUMERIC(12,2) DEFAULT 0,
  other_expenses        NUMERIC(12,2) DEFAULT 0,
  total_expenses        NUMERIC(12,2) GENERATED ALWAYS AS (
    payroll_expenses + subcontractors + professional_services +
    software_expenses + marketing_expenses + vehicle_expenses +
    office_expenses + other_expenses
  ) STORED,
  net_profit            NUMERIC(12,2) GENERATED ALWAYS AS (
    income - (payroll_expenses + subcontractors + professional_services +
    software_expenses + marketing_expenses + vehicle_expenses +
    office_expenses + other_expenses)
  ) STORED,
  notes                 TEXT,
  is_closed             BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- 2. טבלת תשלומי מס
CREATE TABLE IF NOT EXISTS tax_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  year          INT NOT NULL,
  payment_date  DATE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('income_tax','bituach_leumi','vat','pension','hishtalmut','other')),
  amount        NUMERIC(12,2) NOT NULL,
  period_month  INT CHECK (period_month BETWEEN 1 AND 12),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. טבלת תחזיות מס
CREATE TABLE IF NOT EXISTS tax_forecasts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  year                     INT NOT NULL,
  tax_rate_pct             NUMERIC(5,2) DEFAULT 35,
  bank_balance             NUMERIC(12,2) DEFAULT 0,
  monthly_commitments      NUMERIC(12,2) DEFAULT 0,
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year)
);

-- 4. RLS policies
ALTER TABLE finance_months  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_forecasts   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own finance_months"  ON finance_months  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own tax_payments"    ON tax_payments    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own tax_forecasts"   ON tax_forecasts   FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED DATA — נתוני 2025 (ינואר–אוגוסט)
-- הרץ רק אחרי שמחובר עם המשתמש הנכון!
-- Replace 'YOUR_USER_ID' with your actual auth.uid()
-- ============================================================
/*
INSERT INTO finance_months (user_id, year, month, income, payroll_expenses, subcontractors, professional_services, software_expenses, marketing_expenses, vehicle_expenses, office_expenses, other_expenses, notes) VALUES
  ('YOUR_USER_ID', 2025, 1,  45000, 0, 5000, 3000, 2000, 2500, 2000, 1000, 3000, 'ינואר 2025'),
  ('YOUR_USER_ID', 2025, 2,  78000, 0, 6000, 2000, 2000, 3000, 2000, 1000, 3500, 'פברואר חזק'),
  ('YOUR_USER_ID', 2025, 3,  40000, 0, 5000, 47242, 2000, 2500, 2000, 1000, 2258, 'הוצאה גדולה שירותים מקצועיים'),
  ('YOUR_USER_ID', 2025, 4,  52000, 0, 4000, 2500, 2000, 3000, 2000, 1000, 3000, 'אפריל 2025'),
  ('YOUR_USER_ID', 2025, 5,  55000, 0, 5000, 2500, 2000, 3000, 2000, 1000, 2500, 'מאי 2025'),
  ('YOUR_USER_ID', 2025, 6,  60000, 0, 5500, 2500, 2000, 3500, 2000, 1000, 2500, 'יוני 2025'),
  ('YOUR_USER_ID', 2025, 7,  45000, 0, 4000, 2000, 2000, 2500, 2000, 1000, 1000, 'יולי – כמעט איזון'),
  ('YOUR_USER_ID', 2025, 8,  17466, 0, 1500, 1000, 1000, 500,  1000, 500,  459,  'אוגוסט חלש');
*/
