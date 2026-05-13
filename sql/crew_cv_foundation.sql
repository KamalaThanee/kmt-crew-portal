-- CV foundation: crew CV profile helpers, vessel shortcuts, and sea service records.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.crews
  add column if not exists national_id_no text,
  add column if not exists nationality text,
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists cv_company text,
  add column if not exists cv_last_updated_at timestamptz,
  add column if not exists passport_cv_updated_at timestamptz;

alter table public.crew_certs
  add column if not exists cert_number text,
  add column if not exists place_of_issue text,
  add column if not exists issue_authority text,
  add column if not exists cv_section text,
  add column if not exists cv_row_no integer,
  add column if not exists cv_capacity text;

create table if not exists public.cv_vessel_master (
  id uuid primary key default gen_random_uuid(),
  vessel_name text not null,
  vessel_type text,
  flag text,
  imo_no text,
  grt text,
  dwt text,
  engine_type text,
  bhp text,
  company text,
  trading_area text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vessel_name)
);

create table if not exists public.crew_cv_sea_services (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  vessel_master_id uuid references public.cv_vessel_master(id) on delete set null,
  vessel_name text not null,
  vessel_type text,
  flag text,
  imo_no text,
  grt text,
  dwt text,
  engine_type text,
  bhp text,
  company text,
  trading_area text,
  rank text,
  charterer text,
  joining_date date,
  sign_off_date date,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_cv_vaccinations (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  vaccine_name text not null,
  dose_detail text,
  date_given date,
  expiry_date date,
  place_given text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crew_cv_sea_services
  add column if not exists charterer text;

create index if not exists idx_cv_vessel_master_name
on public.cv_vessel_master (vessel_name);

create index if not exists idx_crew_cv_sea_services_crew_dates
on public.crew_cv_sea_services (crew_id, joining_date desc);

create index if not exists idx_crew_cv_vaccinations_crew_dates
on public.crew_cv_vaccinations (crew_id, date_given desc);

alter table public.cv_vessel_master enable row level security;
alter table public.crew_cv_sea_services enable row level security;
alter table public.crew_cv_vaccinations enable row level security;

drop policy if exists "Allow cv vessel master read" on public.cv_vessel_master;
drop policy if exists "Allow cv vessel master write" on public.cv_vessel_master;
drop policy if exists "Allow crew cv sea service read" on public.crew_cv_sea_services;
drop policy if exists "Allow crew cv sea service write" on public.crew_cv_sea_services;
drop policy if exists "Allow crew cv vaccination read" on public.crew_cv_vaccinations;
drop policy if exists "Allow crew cv vaccination write" on public.crew_cv_vaccinations;

create policy "Allow cv vessel master read"
on public.cv_vessel_master
for select
using (true);

create policy "Allow cv vessel master write"
on public.cv_vessel_master
for all
using (true)
with check (true);

create policy "Allow crew cv sea service read"
on public.crew_cv_sea_services
for select
using (true);

create policy "Allow crew cv sea service write"
on public.crew_cv_sea_services
for all
using (true)
with check (true);

create policy "Allow crew cv vaccination read"
on public.crew_cv_vaccinations
for select
using (true);

create policy "Allow crew cv vaccination write"
on public.crew_cv_vaccinations
for all
using (true)
with check (true);

grant select, insert, update, delete on public.cv_vessel_master to anon, authenticated;
grant select, insert, update, delete on public.crew_cv_sea_services to anon, authenticated;
grant select, insert, update, delete on public.crew_cv_vaccinations to anon, authenticated;
