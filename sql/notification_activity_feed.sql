create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid,
  actor_name text not null,
  actor_position text,
  audience text not null check (audience in ('admins', 'all', 'roles', 'users')),
  target_roles text[] not null default '{}',
  target_user_ids uuid[] not null default '{}',
  title text not null,
  description text not null,
  href text not null default '/',
  icon text not null default 'activity',
  tone text not null default 'sky',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_user_state (
  user_id uuid primary key references public.crews(id) on delete cascade,
  last_read_at timestamptz,
  cleared_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ship_cert_push_logs (
  id uuid primary key default gen_random_uuid(),
  unique_key text not null unique,
  certificate_id uuid not null,
  trigger_day integer not null,
  expiry_date date not null,
  target_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_created_at_idx
  on public.notification_events (created_at desc);
create index if not exists notification_events_audience_idx
  on public.notification_events (audience, created_at desc);
create index if not exists notification_events_target_roles_gin_idx
  on public.notification_events using gin (target_roles);
create index if not exists notification_events_target_users_gin_idx
  on public.notification_events using gin (target_user_ids);
create index if not exists ship_cert_push_logs_created_at_idx
  on public.ship_cert_push_logs (created_at desc);

alter table public.notification_events enable row level security;
alter table public.notification_user_state enable row level security;
alter table public.ship_cert_push_logs enable row level security;

revoke all on table public.notification_events from anon, authenticated;
revoke all on table public.notification_user_state from anon, authenticated;
revoke all on table public.ship_cert_push_logs from anon, authenticated;

grant select, insert, update, delete on table public.notification_events to service_role;
grant select, insert, update, delete on table public.notification_user_state to service_role;
grant select, insert, update, delete on table public.ship_cert_push_logs to service_role;
