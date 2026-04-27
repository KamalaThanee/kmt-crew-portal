alter table public.crews
  add column if not exists is_active boolean not null default true,
  add column if not exists resigned_at timestamptz,
  add column if not exists resigned_by text;

update public.crews
set is_active = true
where is_active is null;

grant select, insert, update, delete on public.crews to anon, authenticated;
