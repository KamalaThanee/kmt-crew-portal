alter table public.crews enable row level security;
alter table public.crew_certs enable row level security;

drop policy if exists "Allow delete crews" on public.crews;
create policy "Allow delete crews"
on public.crews
for delete
using (true);

drop policy if exists "Allow delete crew certificates" on public.crew_certs;
create policy "Allow delete crew certificates"
on public.crew_certs
for delete
using (true);

grant delete on public.crews to anon, authenticated;
grant delete on public.crew_certs to anon, authenticated;
