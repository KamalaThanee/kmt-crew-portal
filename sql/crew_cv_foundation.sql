-- CV foundation: crew CV profile helpers, vessel shortcuts, and sea service records.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.crews
  add column if not exists national_id_no text,
  add column if not exists nationality text,
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists cv_company text,
  add column if not exists toeic_score text,
  add column if not exists toeic_test_date date,
  add column if not exists cv_picture_url text,
  add column if not exists cv_last_updated_at timestamptz,
  add column if not exists passport_cv_updated_at timestamptz;

alter table public.crew_certs
  add column if not exists cert_number text,
  add column if not exists place_of_issue text,
  add column if not exists issue_authority text,
  add column if not exists cv_section text,
  add column if not exists cv_row_no integer,
  add column if not exists cv_competency_title text,
  add column if not exists cv_capacity text;

alter table public.cert_master
  add column if not exists cert_family text default 'Other',
  add column if not exists cv_section text,
  add column if not exists stcw_group_key text,
  add column if not exists requires_proficiency boolean default false,
  add column if not exists required_proficiency_key text,
  add column if not exists cv_order integer,
  add column if not exists cv_notes text;

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

create index if not exists idx_cert_master_cv_section
on public.cert_master (cv_section);

create index if not exists idx_cert_master_stcw_group_key
on public.cert_master (stcw_group_key);

update public.cert_master
set
  cert_family = case
    when lower(cert_name) like '%passport%' then 'Personal Document'
    when lower(cert_name) like '%seaman%' then 'Personal Document'
    when lower(cert_name) like '%toeic%' then 'Personal Document'
    when lower(cert_name) like '%medical%' or lower(cert_name) like '%fitness%' then 'Medical'
    when lower(cert_name) like '%bosiet%' or lower(cert_name) like '%foet%' or lower(cert_name) like '%offshore%' or lower(cert_name) like '%huet%' then 'Offshore'
    when lower(cert_name) like '%stcw%' or lower(cert_name) like '%proficiency%' or lower(cert_name) like '%gmdss%' or lower(cert_name) like '%advanced fire%' or lower(cert_name) like '%advance fire%' or lower(cert_name) like '%survival craft%' or lower(cert_name) like '%security%' or lower(cert_name) like '%dangerous goods%' then 'STCW'
    else coalesce(nullif(cert_family, ''), 'Other')
  end,
  cv_section = case
    when lower(cert_name) like '%passport%' or lower(cert_name) like '%seaman%' or lower(cert_name) like '%toeic%' then 'Personal Document'
    when lower(cert_name) like '%medical%' or lower(cert_name) like '%fitness%' then 'Medical'
    when lower(cert_name) like '%competency%' or lower(cert_name) like '%coc%' or lower(cert_name) like '%certificate of competency%' then 'Certificate of Competency'
    when lower(cert_name) like '%proficiency%' or lower(cert_name) like '%cop%' then 'Certificate of Proficiency'
    else coalesce(nullif(cv_section, ''), 'Certificate of Training')
  end,
  stcw_group_key = case
    when lower(cert_name) like '%basic safety%' or lower(cert_name) like '%personal survival%' or lower(cert_name) like '%fire prevention%' or lower(cert_name) like '%elementary first aid%' or lower(cert_name) like '%personal safety%' then 'basic_safety'
    when lower(cert_name) like '%survival craft%' or lower(cert_name) like '%rescue boat%' or lower(cert_name) like '%pscrb%' then 'survival_craft'
    when lower(cert_name) like '%advanced fire%' or lower(cert_name) like '%advance fire%' then 'advanced_fire'
    when lower(cert_name) like '%medical first aid%' then 'medical_first_aid'
    when lower(cert_name) like '%medical care%' then 'medical_care'
    when lower(cert_name) like '%gmdss%' or lower(cert_name) like '%radio operator%' then 'gmdss'
    when lower(cert_name) like '%security awareness%' or lower(cert_name) like '%designated security%' or lower(cert_name) like '%ship security%' then 'security'
    when lower(cert_name) like '%dangerous goods%' or lower(cert_name) like '%hazmat%' or lower(cert_name) like '%chemical%' then 'dangerous_goods'
    else stcw_group_key
  end,
  requires_proficiency = case
    when lower(cert_name) like '%basic safety%' or lower(cert_name) like '%advanced fire%' or lower(cert_name) like '%advance fire%' or lower(cert_name) like '%survival craft%' or lower(cert_name) like '%medical first aid%' or lower(cert_name) like '%medical care%' or lower(cert_name) like '%gmdss%' or lower(cert_name) like '%security%' then true
    else coalesce(requires_proficiency, false)
  end,
  required_proficiency_key = case
    when lower(cert_name) like '%basic safety%' then 'basic_safety'
    when lower(cert_name) like '%survival craft%' or lower(cert_name) like '%rescue boat%' or lower(cert_name) like '%pscrb%' then 'survival_craft'
    when lower(cert_name) like '%advanced fire%' or lower(cert_name) like '%advance fire%' then 'advanced_fire'
    when lower(cert_name) like '%medical first aid%' then 'medical_first_aid'
    when lower(cert_name) like '%medical care%' then 'medical_care'
    when lower(cert_name) like '%gmdss%' then 'gmdss'
    when lower(cert_name) like '%security%' then 'security'
    else required_proficiency_key
  end,
  cv_order = case
    when lower(cert_name) like '%competency%' or lower(cert_name) like '%coc%' then 10
    when lower(cert_name) like '%basic safety%' then 100
    when lower(cert_name) like '%personal survival%' then 110
    when lower(cert_name) like '%fire prevention%' then 120
    when lower(cert_name) like '%elementary first aid%' then 130
    when lower(cert_name) like '%personal safety%' then 140
    when lower(cert_name) like '%security awareness%' then 150
    when lower(cert_name) like '%designated security%' then 160
    when lower(cert_name) like '%survival craft%' or lower(cert_name) like '%rescue boat%' or lower(cert_name) like '%pscrb%' then 170
    when lower(cert_name) like '%advanced fire%' or lower(cert_name) like '%advance fire%' then 180
    when lower(cert_name) like '%medical first aid%' then 190
    when lower(cert_name) like '%medical care%' then 200
    when lower(cert_name) like '%gmdss%' then 210
    when lower(cert_name) like '%dangerous goods%' then 220
    when lower(cert_name) like '%bosiet%' or lower(cert_name) like '%foet%' or lower(cert_name) like '%offshore%' then 500
    when lower(cert_name) like '%medical%' or lower(cert_name) like '%fitness%' then 900
    else cv_order
  end
where cert_name is not null;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crew-cv-pictures', 'crew-cv-pictures', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow CV picture read" on storage.objects;
drop policy if exists "Allow CV picture insert" on storage.objects;
drop policy if exists "Allow CV picture update" on storage.objects;
drop policy if exists "Allow CV picture delete" on storage.objects;

create policy "Allow CV picture read"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'crew-cv-pictures'
  and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
);

create policy "Allow CV picture insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'crew-cv-pictures');

create policy "Allow CV picture update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'crew-cv-pictures')
with check (bucket_id = 'crew-cv-pictures');

create policy "Allow CV picture delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'crew-cv-pictures');
