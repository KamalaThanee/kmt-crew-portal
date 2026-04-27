create or replace function public.delete_restock_history_lines(p_restock_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if p_restock_ids is null or array_length(p_restock_ids, 1) is null then
    return 0;
  end if;

  update public.ppe_inventory inv
  set quantity = greatest(0, coalesce(inv.quantity, 0) - adjustments.total_added)
  from (
    select item_id, sum(coalesce(quantity_added, 0))::integer as total_added
    from public.restock_history
    where id = any(p_restock_ids)
      and item_id is not null
    group by item_id
  ) adjustments
  where inv.id = adjustments.item_id;

  delete from public.restock_history
  where id = any(p_restock_ids);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_restock_history_lines(uuid[]) to anon, authenticated;
