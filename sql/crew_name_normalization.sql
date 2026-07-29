begin;

create or replace function public.canonical_crew_name(input_name text)
returns text
language sql
immutable
set search_path = ''
as $function$
  with cleaned as (
    select btrim(
      regexp_replace(
        replace(coalesce(input_name, ''), chr(160), ' '),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ) as value
  )
  select case
    when value ~* '^mr\.?[[:space:]]+' then
      'Mr. ' || initcap(lower(regexp_replace(value, '^mr\.?[[:space:]]+', '', 'i')))
    when value ~* '^mrs\.?[[:space:]]+' then
      'Mrs. ' || initcap(lower(regexp_replace(value, '^mrs\.?[[:space:]]+', '', 'i')))
    when value ~* '^ms\.?[[:space:]]+' then
      'Ms. ' || initcap(lower(regexp_replace(value, '^ms\.?[[:space:]]+', '', 'i')))
    else initcap(lower(value))
  end
  from cleaned;
$function$;

create or replace function public.crew_name_sort_key(input_name text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select regexp_replace(
    lower(
      regexp_replace(
        public.canonical_crew_name(input_name),
        '^(mr|mrs|ms)\.?[[:space:]]+',
        '',
        'i'
      )
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$function$;

create or replace function public.normalize_crew_name_before_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.full_name := public.canonical_crew_name(new.full_name);
  return new;
end;
$function$;

drop trigger if exists normalize_crew_name_before_write on public.crews;
create trigger normalize_crew_name_before_write
before insert or update of full_name on public.crews
for each row
execute function public.normalize_crew_name_before_write();

alter table public.crews
add column if not exists full_name_sort text
generated always as (public.crew_name_sort_key(full_name)) stored;

create index if not exists crews_full_name_sort_idx
on public.crews (full_name_sort, full_name);

update public.crews
set full_name = full_name;

update public.crews
set position = 'Radio Operator'
where regexp_replace(lower(position), '[^a-z0-9]+', '', 'g') = 'radiooperator'
  and position <> 'Radio Operator';

commit;
