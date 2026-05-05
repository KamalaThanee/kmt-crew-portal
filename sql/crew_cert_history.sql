create table if not exists public.crew_cert_history (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid,
  cert_name text,
  action text not null default 'upload_certificate',
  old_data jsonb,
  new_data jsonb,
  actor_name text,
  created_at timestamptz not null default now()
);

alter table public.crew_cert_history enable row level security;

drop policy if exists "Allow crew cert history read" on public.crew_cert_history;
drop policy if exists "Allow crew cert history insert" on public.crew_cert_history;

create policy "Allow crew cert history read"
on public.crew_cert_history
for select
using (true);

create policy "Allow crew cert history insert"
on public.crew_cert_history
for insert
with check (true);

grant select, insert on public.crew_cert_history to anon, authenticated;

create index if not exists idx_crew_cert_history_created_at
on public.crew_cert_history (created_at desc);

create index if not exists idx_crew_cert_history_crew_id
on public.crew_cert_history (crew_id);

create index if not exists idx_crew_cert_history_cert_name
on public.crew_cert_history (cert_name);
