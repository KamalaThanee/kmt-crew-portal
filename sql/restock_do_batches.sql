alter table public.restock_history
  add column if not exists do_number text,
  add column if not exists batch_id text;

insert into storage.buckets (id, name, public)
values ('do-files', 'do-files', false)
on conflict (id) do nothing;

create index if not exists idx_restock_history_batch_id
  on public.restock_history (batch_id);

create index if not exists idx_restock_history_do_number
  on public.restock_history (do_number);

update public.restock_history
set batch_id = coalesce(receipt_url, to_char(created_at, 'YYYY-MM-DD') || '-' || coalesce(added_by, 'Admin')),
    do_number = 'DO-' || to_char(created_at, 'YYYYMMDD')
where batch_id is null
  and do_number is null;
