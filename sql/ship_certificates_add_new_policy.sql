drop policy if exists "Allow anon ship certificates insert" on public.ship_certificates;

create policy "Allow anon ship certificates insert"
on public.ship_certificates
for insert
with check (true);
