-- Versioned Monthly Report master setup.
-- Existing submissions keep their original master_id, while changes can take
-- effect from a selected month without rewriting earlier monthly checklists.

alter table public.monthly_report_master
  add column if not exists definition_key uuid,
  add column if not exists effective_from_month date,
  add column if not exists effective_to_month date,
  add column if not exists created_by text,
  add column if not exists updated_by text;

update public.monthly_report_master
set definition_key = id
where definition_key is null;

update public.monthly_report_master
set effective_from_month = date '2000-01-01'
where effective_from_month is null;

alter table public.monthly_report_master
  alter column definition_key set default gen_random_uuid(),
  alter column definition_key set not null,
  alter column effective_from_month set default date '2000-01-01',
  alter column effective_from_month set not null;

alter table public.monthly_report_master
  drop constraint if exists monthly_report_master_form_no_details_pic_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_report_master_effective_months_check'
      and conrelid = 'public.monthly_report_master'::regclass
  ) then
    alter table public.monthly_report_master
      add constraint monthly_report_master_effective_months_check check (
        effective_from_month = date_trunc('month', effective_from_month)::date
        and (effective_to_month is null or effective_to_month = date_trunc('month', effective_to_month)::date)
        and (effective_to_month is null or effective_to_month >= effective_from_month)
      );
  end if;
end $$;

create unique index if not exists monthly_report_master_definition_month_uidx
  on public.monthly_report_master (definition_key, effective_from_month);

create index if not exists monthly_report_master_effective_lookup_idx
  on public.monthly_report_master (schedule, effective_from_month, effective_to_month, sort_order);

alter table public.monthly_report_master enable row level security;

drop policy if exists "Allow anon monthly report master read" on public.monthly_report_master;
drop policy if exists "Allow monthly report master read" on public.monthly_report_master;
create policy "Allow monthly report master read"
on public.monthly_report_master for select
to anon, authenticated
using (true);

grant select on public.monthly_report_master to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.monthly_report_master from anon, authenticated;
grant select, insert, update, delete on public.monthly_report_master to service_role;
