create table if not exists public.ppe_size_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  deadline_at timestamptz,
  opened_by text,
  opened_at timestamptz not null default now(),
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crews
  add column if not exists ppe_size_confirmed_at timestamptz,
  add column if not exists ppe_size_confirmed_window_id uuid;

alter table public.ppe_size_windows enable row level security;

drop policy if exists "Allow ppe size window read" on public.ppe_size_windows;
drop policy if exists "Allow ppe size window insert" on public.ppe_size_windows;
drop policy if exists "Allow ppe size window update" on public.ppe_size_windows;

create policy "Allow ppe size window read"
on public.ppe_size_windows
for select
using (true);

create policy "Allow ppe size window insert"
on public.ppe_size_windows
for insert
with check (true);

create policy "Allow ppe size window update"
on public.ppe_size_windows
for update
using (true)
with check (true);

grant select, insert, update on public.ppe_size_windows to anon, authenticated;

create index if not exists idx_ppe_size_windows_status
on public.ppe_size_windows (status);

create index if not exists idx_ppe_size_windows_created_at
on public.ppe_size_windows (created_at desc);

create index if not exists idx_ppe_size_windows_status_opened_at
on public.ppe_size_windows (status, opened_at desc);

-- Database guard: only one survey window can stay open at a time.
with ranked_open_windows as (
  select
    id,
    row_number() over (order by opened_at desc nulls last, created_at desc) as rn
  from public.ppe_size_windows
  where status = 'open'
)
update public.ppe_size_windows
set
  status = 'closed',
  closed_by = coalesce(closed_by, 'System'),
  closed_at = coalesce(closed_at, now()),
  updated_at = now()
where id in (
  select id
  from ranked_open_windows
  where rn > 1
);

create unique index if not exists idx_ppe_size_windows_one_open
on public.ppe_size_windows (status)
where status = 'open';

create table if not exists public.ppe_size_responses (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.ppe_size_windows(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  crew_name text,
  position text,
  suit_color text,
  suit_size text,
  boot_size text,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (window_id, crew_id)
);

alter table public.ppe_size_responses enable row level security;

drop policy if exists "Allow ppe size responses read" on public.ppe_size_responses;
drop policy if exists "Allow ppe size responses insert" on public.ppe_size_responses;
drop policy if exists "Allow ppe size responses update" on public.ppe_size_responses;

create policy "Allow ppe size responses read"
on public.ppe_size_responses
for select
using (true);

create policy "Allow ppe size responses insert"
on public.ppe_size_responses
for insert
with check (true);

create policy "Allow ppe size responses update"
on public.ppe_size_responses
for update
using (true)
with check (true);

grant select, insert, update on public.ppe_size_responses to anon, authenticated;

create index if not exists idx_ppe_size_responses_window_id
on public.ppe_size_responses (window_id);

create index if not exists idx_ppe_size_responses_crew_id
on public.ppe_size_responses (crew_id);
