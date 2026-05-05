alter table public.ship_cert_ai_page_maps enable row level security;

drop policy if exists "Allow anon ship cert page maps read" on public.ship_cert_ai_page_maps;
drop policy if exists "Allow anon ship cert page maps insert" on public.ship_cert_ai_page_maps;
drop policy if exists "Allow anon ship cert page maps update" on public.ship_cert_ai_page_maps;

create policy "Allow anon ship cert page maps read"
on public.ship_cert_ai_page_maps for select
using (true);

create policy "Allow anon ship cert page maps insert"
on public.ship_cert_ai_page_maps for insert
with check (true);

create policy "Allow anon ship cert page maps update"
on public.ship_cert_ai_page_maps for update
using (true)
with check (true);
