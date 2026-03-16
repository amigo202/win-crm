-- google_tokens: stores OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT        NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Only the owning user can read/modify their own token
CREATE POLICY "Users can manage own google_tokens"
  ON public.google_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- calendar_events: maps CRM entities to Google Calendar event IDs
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('task','class')),
  entity_id       UUID        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar_events"
  ON public.calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- index for fast lookups
CREATE INDEX IF NOT EXISTS idx_google_tokens_user    ON public.google_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user  ON public.calendar_events (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_entity ON public.calendar_events (entity_type, entity_id);
