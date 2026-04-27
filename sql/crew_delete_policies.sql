alter table public.crews enable row level security;
alter table public.crew_certs enable row level security;

drop policy if exists "Allow read crews" on public.crews;
create policy "Allow read crews"
on public.crews
for select
using (true);

drop policy if exists "Allow insert crews" on public.crews;
create policy "Allow insert crews"
on public.crews
for insert
with check (true);

drop policy if exists "Allow update crews" on public.crews;
create policy "Allow update crews"
on public.crews
for update
using (true)
with check (true);

drop policy if exists "Allow delete crews" on public.crews;
create policy "Allow delete crews"
on public.crews
for delete
using (true);

drop policy if exists "Allow read crew certificates" on public.crew_certs;
create policy "Allow read crew certificates"
on public.crew_certs
for select
using (true);

drop policy if exists "Allow insert crew certificates" on public.crew_certs;
create policy "Allow insert crew certificates"
on public.crew_certs
for insert
with check (true);

drop policy if exists "Allow update crew certificates" on public.crew_certs;
create policy "Allow update crew certificates"
on public.crew_certs
for update
using (true)
with check (true);

drop policy if exists "Allow delete crew certificates" on public.crew_certs;
create policy "Allow delete crew certificates"
on public.crew_certs
for delete
using (true);

grant select, insert, update, delete on public.crews to anon, authenticated;
grant select, insert, update, delete on public.crew_certs to anon, authenticated;
