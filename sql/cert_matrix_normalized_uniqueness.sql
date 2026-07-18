begin;

-- Remove duplicate requirements that differ only by case, spaces, or punctuation.
-- Mandatory (P) wins over Optional (O), then the canonical position spelling wins.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        regexp_replace(lower(position), '[^a-z0-9]', '', 'g'),
        regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g')
      order by
        case when upper(trim(requirement_type)) = 'P' then 0 else 1 end,
        case when position = 'Radio Operator' then 0 else 1 end,
        id
    ) as duplicate_rank
  from public.cert_matrix
)
delete from public.cert_matrix matrix_row
using ranked
where matrix_row.id = ranked.id
  and ranked.duplicate_rank > 1;

-- Keep one canonical spelling after normalized duplicates have been removed.
update public.cert_matrix
set position = 'Radio Operator'
where regexp_replace(lower(position), '[^a-z0-9]', '', 'g') = 'radiooperator'
  and position <> 'Radio Operator';

create unique index if not exists cert_matrix_position_cert_normalized_uidx
on public.cert_matrix (
  regexp_replace(lower(position), '[^a-z0-9]', '', 'g'),
  regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g')
);

commit;
