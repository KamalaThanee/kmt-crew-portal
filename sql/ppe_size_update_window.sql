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
