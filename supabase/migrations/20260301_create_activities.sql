-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Business Activities – non-class income sources            ║
-- ║  (PIXMIX, videos, content, lectures, consulting, other)    ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS business_activities (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID REFERENCES auth.users(id) DEFAULT auth.uid(),

  -- Core fields
  name            TEXT NOT NULL,
  activity_type   TEXT NOT NULL DEFAULT 'other',
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name    TEXT,

  -- Dates & period
  activity_date   DATE,
  month           INT,
  year            INT,

  -- Financials
  income          NUMERIC DEFAULT 0,
  expenses        NUMERIC DEFAULT 0,
  profit          NUMERIC GENERATED ALWAYS AS (income - expenses) STORED,

  -- Payment tracking
  payment_status  TEXT DEFAULT 'pending',
  payment_date    DATE,
  payment_method  TEXT,
  invoice_number  TEXT,

  -- Meta
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE business_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_activities' AND policyname = 'business_activities_owner'
  ) THEN
    CREATE POLICY "business_activities_owner" ON business_activities
      FOR ALL TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_biz_act_year_month ON business_activities(year, month);
CREATE INDEX IF NOT EXISTS idx_biz_act_type ON business_activities(activity_type);
