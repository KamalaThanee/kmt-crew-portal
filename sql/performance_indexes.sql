-- Performance indexes for frequently filtered KMT Crew Portal tables.
-- Safe to run more than once in Supabase SQL Editor.

create index if not exists idx_ppe_requests_created_at
on public.ppe_requests (created_at desc);

create index if not exists idx_ppe_requests_status_created_at
on public.ppe_requests (status, created_at desc);

create index if not exists idx_ppe_requests_crew_id_created_at
on public.ppe_requests (crew_id, created_at desc);

create index if not exists idx_crew_certs_crew_id
on public.crew_certs (crew_id);

create index if not exists idx_crew_certs_cert_name
on public.crew_certs (cert_name);

create index if not exists idx_crew_certs_expiry_date
on public.crew_certs (expiry_date);

create index if not exists idx_ppe_inventory_category
on public.ppe_inventory (category);

create index if not exists idx_ppe_inventory_item_name
on public.ppe_inventory (item_name);

create index if not exists idx_ppe_stock_transactions_created_at
on public.ppe_stock_transactions (created_at desc);

create index if not exists idx_ppe_stock_transactions_inventory_id_created_at
on public.ppe_stock_transactions (inventory_id, created_at desc);
