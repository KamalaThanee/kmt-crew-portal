alter table public.ppe_requests
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists approved_by_name text;

update public.ppe_requests as pr
set approved_by_name = c.full_name
from public.crews as c
where pr.approved_by is not null
  and c.id = pr.approved_by
  and (pr.approved_by_name is null or btrim(pr.approved_by_name) = '');

update public.ppe_requests
set approved_at = coalesce(approved_at, received_at, created_at)
where status in ('approved', 'received')
  and approved_at is null;

update public.ppe_requests
set rejected_at = coalesce(rejected_at, created_at)
where status = 'rejected'
  and rejected_at is null;
