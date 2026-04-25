create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  crew_name text,
  role text,
  endpoint text unique not null,
  subscription jsonb not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_crew_id
on public.push_subscriptions (crew_id);

create index if not exists idx_push_subscriptions_enabled
on public.push_subscriptions (enabled);

create index if not exists idx_push_subscriptions_role
on public.push_subscriptions (role);
