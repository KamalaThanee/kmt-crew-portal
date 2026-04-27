create extension if not exists pgcrypto;

alter table public.ppe_requests
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists approved_by_name text;

create table if not exists public.ppe_stock_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_id text,
  request_id uuid,
  item_name text,
  color text,
  size text,
  quantity_delta integer not null,
  movement_type text not null default 'issue',
  actor_name text,
  crew_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ppe_stock_transactions_created_at
  on public.ppe_stock_transactions (created_at desc);

create index if not exists idx_ppe_stock_transactions_inventory_id
  on public.ppe_stock_transactions (inventory_id);

create or replace function public.deduct_ppe_stock(
  p_items jsonb,
  p_request_id uuid default null,
  p_actor_name text default null,
  p_crew_name text default null,
  p_movement_type text default 'issue',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_record jsonb;
  item_id text;
  inventory_row public.ppe_inventory%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for item_record in select value from jsonb_array_elements(p_items)
  loop
    item_id := item_record ->> 'id';
    if item_id is null or btrim(item_id) = '' then
      continue;
    end if;

    select *
    into inventory_row
    from public.ppe_inventory
    where id::text = item_id
    for update;

    if not found then
      continue;
    end if;

    update public.ppe_inventory
    set quantity = greatest(0, coalesce(quantity, 0) - 1)
    where id::text = item_id;

    insert into public.ppe_stock_transactions (
      inventory_id,
      request_id,
      item_name,
      color,
      size,
      quantity_delta,
      movement_type,
      actor_name,
      crew_name,
      note
    )
    values (
      item_id,
      p_request_id,
      coalesce(inventory_row.item_name, item_record ->> 'item_name'),
      coalesce(inventory_row.color, item_record ->> 'color'),
      coalesce(inventory_row.size, item_record ->> 'size'),
      -1,
      coalesce(nullif(p_movement_type, ''), 'issue'),
      p_actor_name,
      p_crew_name,
      p_note
    );
  end loop;
end;
$$;

create or replace function public.receive_ppe_request(
  p_request_id uuid,
  p_actor_name text default null,
  p_crew_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.ppe_requests%rowtype;
begin
  select *
  into request_row
  from public.ppe_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'PPE request not found: %', p_request_id;
  end if;

  if request_row.status = 'received' then
    return;
  end if;

  if request_row.status <> 'approved' then
    raise exception 'Only approved PPE requests can be received. Current status: %', request_row.status;
  end if;

  perform public.deduct_ppe_stock(
    request_row.items,
    p_request_id,
    p_actor_name,
    p_crew_name,
    'receive',
    'Crew confirmed received'
  );

  update public.ppe_requests
  set status = 'received',
      received_at = coalesce(received_at, now())
  where id = p_request_id;
end;
$$;

grant select, insert on public.ppe_stock_transactions to anon, authenticated;
grant execute on function public.deduct_ppe_stock(jsonb, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.receive_ppe_request(uuid, text, text) to anon, authenticated;

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
