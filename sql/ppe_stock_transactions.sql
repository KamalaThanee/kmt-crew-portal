alter table public.ppe_requests
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists approved_by_name text;

create or replace function public.deduct_ppe_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_record jsonb;
  item_id text;
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

    update public.ppe_inventory
    set quantity = greatest(0, coalesce(quantity, 0) - 1)
    where id::text = item_id;
  end loop;
end;
$$;

create or replace function public.receive_ppe_request(p_request_id uuid)
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

  perform public.deduct_ppe_stock(request_row.items);

  update public.ppe_requests
  set status = 'received',
      received_at = coalesce(received_at, now())
  where id = p_request_id;
end;
$$;

grant execute on function public.deduct_ppe_stock(jsonb) to anon, authenticated;
grant execute on function public.receive_ppe_request(uuid) to anon, authenticated;

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
