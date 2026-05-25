-- =====================================================
-- Pipeline / Revenue Planning Tables
-- Run this in Supabase SQL Editor
-- =====================================================

create table if not exists revenue_lines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  line_type   text not null default 'קורסים',
  sort_order  int  not null default 0,
  has_vat     boolean not null default true,
  created_at  timestamptz default now()
);

create table if not exists revenue_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  line_id     uuid not null references revenue_lines(id) on delete cascade,
  year        int  not null,
  month       int  not null check (month between 1 and 12),
  amount      numeric(12,2) not null default 0,
  is_paid     boolean not null default false,
  created_at  timestamptz default now(),
  unique(user_id, line_id, year, month)
);

alter table revenue_lines  enable row level security;
alter table revenue_entries enable row level security;

create policy "own revenue_lines"
  on revenue_lines for all using (auth.uid() = user_id);

create policy "own revenue_entries"
  on revenue_entries for all using (auth.uid() = user_id);
