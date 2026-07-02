-- =============================================
-- 005: Add logbook + PLU scheduled changes tables
-- Run this in the Supabase SQL Editor
-- =============================================

-- =============================================
-- LOGBOOK TABLE
-- =============================================
create table if not exists public.logbook (
  id            uuid          primary key default gen_random_uuid(),
  timestamp     timestamptz   not null default now(),
  entity        text          not null,
  entity_label  text          not null,
  field         text          not null,
  old_value     text,
  new_value     text,
  username      text          not null
);

create index if not exists logbook_timestamp_idx on public.logbook (timestamp desc);
create index if not exists logbook_entity_idx    on public.logbook (entity);

-- RLS: admins/super_users can read/write; regular users can only insert
alter table public.logbook enable row level security;

create policy "logbook_admin_read" on public.logbook
  for select
  using ( public.get_user_role() in ('super_user', 'admin') );

create policy "logbook_authenticated_insert" on public.logbook
  for insert
  with check ( public.get_user_role() in ('super_user', 'admin') );

-- =============================================
-- PLU SCHEDULED CHANGES TABLE
-- =============================================
create table if not exists public.plu_scheduled_changes (
  id              uuid          primary key default gen_random_uuid(),
  plu_id          uuid          not null references public.plu(plu_id) on delete cascade,
  payload         jsonb         not null,
  scheduled_at    timestamptz   not null,
  created_at      timestamptz   not null default now(),
  created_by      text,
  applied         boolean       not null default false,
  applied_at      timestamptz
);

create index if not exists plu_schedule_pending_idx on public.plu_scheduled_changes (scheduled_at, applied)
  where applied = false;

alter table public.plu_scheduled_changes enable row level security;

create policy "schedule_admin_full_access" on public.plu_scheduled_changes
  for all
  using ( public.get_user_role() in ('super_user', 'admin') )
  with check ( public.get_user_role() in ('super_user', 'admin') );
