create table if not exists public.cert_email_settings (
  id text primary key default 'default',
  ship_alert_enabled boolean not null default true,
  my_cert_alert_enabled boolean not null default true,
  ship_to_emails text[] not null default '{}',
  ship_cc_emails text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cert_email_logs (
  id uuid primary key default gen_random_uuid(),
  unique_key text unique,
  alert_type text not null,
  scope text not null,
  trigger_label text,
  recipient text,
  cc text[],
  subject text,
  status text not null default 'pending',
  error_message text,
  crew_id uuid,
  crew_name text,
  related_cert_count integer not null default 0,
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.cert_email_settings (id)
values ('default')
on conflict (id) do nothing;

create index if not exists cert_email_logs_created_at_idx on public.cert_email_logs(created_at desc);
create index if not exists cert_email_logs_scope_idx on public.cert_email_logs(scope);
create index if not exists cert_email_logs_status_idx on public.cert_email_logs(status);
create index if not exists cert_email_logs_crew_idx on public.cert_email_logs(crew_id);

alter table public.cert_email_settings enable row level security;
alter table public.cert_email_logs enable row level security;

drop policy if exists "Allow anon cert email settings read" on public.cert_email_settings;
create policy "Allow anon cert email settings read"
on public.cert_email_settings for select
using (true);

drop policy if exists "Allow anon cert email settings insert" on public.cert_email_settings;
create policy "Allow anon cert email settings insert"
on public.cert_email_settings for insert
with check (true);

drop policy if exists "Allow anon cert email settings update" on public.cert_email_settings;
create policy "Allow anon cert email settings update"
on public.cert_email_settings for update
using (true)
with check (true);

drop policy if exists "Allow anon cert email logs read" on public.cert_email_logs;
create policy "Allow anon cert email logs read"
on public.cert_email_logs for select
using (true);

drop policy if exists "Allow anon cert email logs insert" on public.cert_email_logs;
create policy "Allow anon cert email logs insert"
on public.cert_email_logs for insert
with check (true);

drop policy if exists "Allow anon cert email logs update" on public.cert_email_logs;
create policy "Allow anon cert email logs update"
on public.cert_email_logs for update
using (true)
with check (true);
