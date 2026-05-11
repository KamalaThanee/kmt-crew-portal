create table if not exists public.monthly_report_master (
  id uuid primary key default gen_random_uuid(),
  schedule text not null,
  form_no text not null default 'N/A',
  details text not null,
  period text,
  pic text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_no, details, pic)
);

create table if not exists public.monthly_report_submissions (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.monthly_report_master(id) on delete cascade,
  report_month date not null,
  status text not null default 'uploaded',
  file_name text,
  file_path text,
  file_url text,
  file_size bigint,
  mime_type text,
  remarks text,
  uploaded_by uuid,
  uploaded_by_name text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_id, report_month)
);

create table if not exists public.monthly_report_completion_notices (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  position text not null,
  completed_count integer not null default 0,
  notified_by uuid,
  notified_by_name text,
  notified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (report_month, position)
);

create table if not exists public.monthly_report_exports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null,
  position text not null,
  exported_count integer not null default 0,
  exported_by uuid,
  exported_by_name text,
  exported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (report_month, position)
);

create index if not exists monthly_report_master_pic_idx on public.monthly_report_master(pic);
create index if not exists monthly_report_master_active_idx on public.monthly_report_master(active);
create index if not exists monthly_report_submissions_month_idx on public.monthly_report_submissions(report_month);
create index if not exists monthly_report_submissions_master_idx on public.monthly_report_submissions(master_id);
create index if not exists monthly_report_completion_notices_month_idx on public.monthly_report_completion_notices(report_month);
create index if not exists monthly_report_exports_month_idx on public.monthly_report_exports(report_month);

insert into public.monthly_report_master (schedule, form_no, details, period, pic, sort_order)
values
  ('Weekly', '11.81', 'Master HSE Weekly Inspection 1st week', 'Within on Friday of 1st week', 'Safety Officer', 10),
  ('Weekly', '11.82', 'Master HSE Weekly Inspection 2nd week', 'Within on Friday of 2nd week', 'Safety Officer', 20),
  ('Weekly', '11.83', 'Master HSE Weekly Inspection 3rd week', 'Within on Friday of 3rd week', 'Safety Officer', 30),
  ('Weekly', '11.84', 'Master HSE Weekly Inspection 4th week', 'Within on Friday of 4th week', 'Safety Officer', 40),
  ('Inventory', 'N/A', 'Engine room Log abstract (Inventory Bunker)', 'On 22nd of each month', 'Chief Engineer', 50),
  ('Inventory', 'N/A', 'L.O Inventory', 'On 22nd of each month', 'Chief Engineer', 60),
  ('Inventory', 'N/A', 'Chemical Inventory', 'On 22nd of each month', 'Chief Engineer', 70),
  ('Inventory', '11.34', 'Ship Spare Inventory (Paint)', 'On 22nd of each month', 'Chief Officer', 80),
  ('Monthly Report', '11.01', 'Seafarers Shipboard Orientation Checklist (When crew change)', 'Within on 30th of each month', 'Safety Officer', 90),
  ('Monthly Report', '11.03', 'Shipboard training report', 'Within on 30th of each month', 'Safety Officer', 100),
  ('Monthly Report', '11.04', 'Shipboard Drilling Exercise', 'Within on 30th of each month', 'Safety Officer', 110),
  ('Monthly Report', '11.05', 'Shipboard Monthly SSHE Safety Meeting', 'Within on 30th of each month', 'Safety Officer', 120),
  ('Monthly Report', '11.06', 'Unannounced Drug & Alcohol testing record', 'Within on 30th of each month', 'Safety Officer', 130),
  ('Monthly Report', '11.09', 'Work and Rest Hours', 'Within on 30th of each month', 'Chief Officer / Chief Engineer', 140),
  ('Monthly Report', '11.12', 'Rescue Boat/FRC weekly inspection', 'Within on 30th of each month', 'Chief Engineer', 150),
  ('Monthly Report', '11.44', 'Weekly CCTV & Security Equipment Condition Checklist', 'Within on 30th of each month', 'Radio Operator', 160),
  ('Monthly Report', '11.5', 'Chemical Handling and Inspection Checklist', 'Within on 30th of each month', 'Safety Officer', 170),
  ('Monthly Report', '11.56', 'Safety Officer monthly inspection', 'Within on 30th of each month', 'Safety Officer', 180),
  ('Monthly Report', '11.58', 'Onboard Health and Hygiene Inspection', 'Within on 30th of each month', 'Safety Officer', 190),
  ('Monthly Report', '11.62', 'Ship certificate checklist', 'Within on 30th of each month', 'Radio Operator', 200),
  ('Monthly Report', '11.67', 'Portable electrical, pneumatic and power tools maintenance record', 'Within on 30th of each month', 'Chief Engineer', 210),
  ('Monthly Report', '11.96', 'Monthly HSE Statistics report', 'Within on 30th of each month', 'Safety Officer', 220),
  ('Monthly Report', '11.98', 'Garbage landing receipt', 'Within on 30th of each month', 'Chief Officer', 230),
  ('Monthly Report', '11.107', 'Batteries weekly report', 'Within on 30th of each month', 'Electrician', 240),
  ('Monthly Report', '11.133', 'Plan Maintenance System (AWB)', 'Within on 30th of each month', 'Chief Engineer', 250),
  ('Monthly Report', 'N/A', 'Ship Stability calculation monthly test report', 'Within on 30th of each month', 'Chief Officer', 260),
  ('Monthly Report', 'N/A', 'MAE Report (Only Vessel under PTTEP Charter)', 'Within on 30th of each month', 'Safety Officer', 270)
on conflict (form_no, details, pic) do update
set
  schedule = excluded.schedule,
  period = excluded.period,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

insert into storage.buckets (id, name, public)
values ('monthly-reports', 'monthly-reports', true)
on conflict (id) do update set public = true;

alter table public.monthly_report_master enable row level security;
alter table public.monthly_report_submissions enable row level security;
alter table public.monthly_report_completion_notices enable row level security;
alter table public.monthly_report_exports enable row level security;

drop policy if exists "Allow anon monthly report master read" on public.monthly_report_master;
create policy "Allow anon monthly report master read"
on public.monthly_report_master for select
using (true);

drop policy if exists "Allow anon monthly report submissions read" on public.monthly_report_submissions;
create policy "Allow anon monthly report submissions read"
on public.monthly_report_submissions for select
using (true);

drop policy if exists "Allow anon monthly report submissions insert" on public.monthly_report_submissions;
create policy "Allow anon monthly report submissions insert"
on public.monthly_report_submissions for insert
with check (true);

drop policy if exists "Allow anon monthly report submissions update" on public.monthly_report_submissions;
create policy "Allow anon monthly report submissions update"
on public.monthly_report_submissions for update
using (true)
with check (true);

drop policy if exists "Allow anon monthly report completion notices read" on public.monthly_report_completion_notices;
create policy "Allow anon monthly report completion notices read"
on public.monthly_report_completion_notices for select
using (true);

drop policy if exists "Allow anon monthly report completion notices insert" on public.monthly_report_completion_notices;
create policy "Allow anon monthly report completion notices insert"
on public.monthly_report_completion_notices for insert
with check (true);

drop policy if exists "Allow anon monthly report exports read" on public.monthly_report_exports;
create policy "Allow anon monthly report exports read"
on public.monthly_report_exports for select
using (true);

drop policy if exists "Allow anon monthly report exports insert" on public.monthly_report_exports;
create policy "Allow anon monthly report exports insert"
on public.monthly_report_exports for insert
with check (true);

drop policy if exists "Allow anon monthly report exports update" on public.monthly_report_exports;
create policy "Allow anon monthly report exports update"
on public.monthly_report_exports for update
using (true)
with check (true);

drop policy if exists "Allow public monthly reports storage read" on storage.objects;
create policy "Allow public monthly reports storage read"
on storage.objects for select
using (bucket_id = 'monthly-reports');

drop policy if exists "Allow public monthly reports storage upload" on storage.objects;
create policy "Allow public monthly reports storage upload"
on storage.objects for insert
with check (bucket_id = 'monthly-reports');

drop policy if exists "Allow public monthly reports storage update" on storage.objects;
create policy "Allow public monthly reports storage update"
on storage.objects for update
using (bucket_id = 'monthly-reports')
with check (bucket_id = 'monthly-reports');
