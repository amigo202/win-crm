-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Invoices — business expense tracking with AI extraction       ║
-- ║  Supports: image upload, camera capture, Gmail auto-scan       ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),

  -- Core invoice fields
  vendor           TEXT,                          -- שם הספק
  invoice_number   TEXT,                          -- מספר חשבונית
  invoice_date     DATE,                          -- תאריך חשבונית
  amount           NUMERIC(10,2),                 -- סכום לפני מע"מ
  vat_amount       NUMERIC(10,2),                 -- מע"מ
  total_amount     NUMERIC(10,2),                 -- סה"כ לתשלום

  -- Classification
  category         TEXT    DEFAULT 'אחר',         -- קטגוריה
  month            INTEGER,                       -- חודש (1-12)
  year             INTEGER,                       -- שנה
  description      TEXT,                          -- תיאור / פירוט שירות

  -- Source tracking
  source           TEXT    DEFAULT 'upload',      -- 'upload' | 'email' | 'camera'
  email_message_id TEXT    UNIQUE,                -- Gmail message ID (מניעת כפילויות)

  -- File storage
  image_url        TEXT,                          -- Supabase Storage URL

  -- Workflow status
  status           TEXT    DEFAULT 'pending',     -- 'pending' | 'verified'
  notes            TEXT,                          -- הערות

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_owner" ON invoices
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_invoices_owner    ON invoices(owner_id);
CREATE INDEX idx_invoices_year_month ON invoices(year, month);
CREATE INDEX idx_invoices_category ON invoices(category);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_invoices_source   ON invoices(source);
