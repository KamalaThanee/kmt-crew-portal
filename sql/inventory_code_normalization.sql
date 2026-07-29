begin;

create or replace function public.canonical_inventory_item_code(
  input_category text,
  input_code text
)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  code_prefix text;
  code_number text;
begin
  code_prefix := case input_category
    when 'Head Protection' then 'Head'
    when 'Ears Protection' then 'Ear'
    when 'Eyes Protection' then 'Eyes'
    when 'Respiratory Protection' then 'Nose'
    when 'Body Protection' then 'Body'
    when 'Hands Protection' then 'Hand'
    when 'Foots Protection' then 'Foot'
    when 'Other' then 'Other'
    else null
  end;

  code_number := substring(coalesce(input_code, '') from '([0-9]+)[[:space:]]*$');
  if code_prefix is null or code_number is null then
    return btrim(coalesce(input_code, ''));
  end if;

  return code_prefix || '-' || lpad(code_number::integer::text, 2, '0');
end;
$function$;

create or replace function public.normalize_inventory_item_code_before_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.item_id_code := public.canonical_inventory_item_code(new.category, new.item_id_code);
  return new;
end;
$function$;

drop trigger if exists normalize_inventory_item_code_before_write on public.ppe_inventory;
create trigger normalize_inventory_item_code_before_write
before insert or update of category, item_id_code on public.ppe_inventory
for each row
execute function public.normalize_inventory_item_code_before_write();

update public.ppe_inventory
set item_id_code = item_id_code;

create unique index if not exists ppe_inventory_item_id_code_uidx
on public.ppe_inventory (item_id_code);

commit;
