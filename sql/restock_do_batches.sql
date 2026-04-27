alter table public.restock_history
  add column if not exists do_number text,
  add column if not exists batch_id text,
  add column if not exists color text,
  add column if not exists size text;

insert into storage.buckets (id, name, public)
values ('do-files', 'do-files', false)
on conflict (id) do nothing;

alter table public.restock_history enable row level security;

drop policy if exists "Allow read restock history" on public.restock_history;
create policy "Allow read restock history"
on public.restock_history
for select
using (true);

drop policy if exists "Allow insert restock history" on public.restock_history;
create policy "Allow insert restock history"
on public.restock_history
for insert
with check (true);

drop policy if exists "Allow update restock history" on public.restock_history;
create policy "Allow update restock history"
on public.restock_history
for update
using (true)
with check (true);

grant select, insert, update on public.restock_history to anon, authenticated;

drop policy if exists "Allow read DO files" on storage.objects;
create policy "Allow read DO files"
on storage.objects
for select
using (bucket_id = 'do-files');

drop policy if exists "Allow upload DO files" on storage.objects;
create policy "Allow upload DO files"
on storage.objects
for insert
with check (bucket_id = 'do-files');

drop policy if exists "Allow update DO files" on storage.objects;
create policy "Allow update DO files"
on storage.objects
for update
using (bucket_id = 'do-files')
with check (bucket_id = 'do-files');

create index if not exists idx_restock_history_batch_id
  on public.restock_history (batch_id);

create index if not exists idx_restock_history_do_number
  on public.restock_history (do_number);

update public.restock_history
set batch_id = coalesce(receipt_url, to_char(created_at, 'YYYY-MM-DD') || '-' || coalesce(added_by, 'Admin')),
    do_number = 'DO-' || to_char(created_at, 'YYYYMMDD')
where batch_id is null
  and do_number is null;

update public.restock_history rh
set color = coalesce(rh.color, inv.color),
    size = coalesce(rh.size, inv.size)
from public.ppe_inventory inv
where inv.id = rh.item_id
  and (rh.color is null or rh.size is null);
