-- Recalculate old certificate rows that were saved as "No Expiry" (2099-12-31)
-- even though cert_master.refresh_years says they should refresh.
--
-- Safe scope:
-- - Only rows with crew_certs.expiry_date = 2099-12-31
-- - Only rows with a valid issue_date
-- - Only cert_master rows with refresh_years > 0

with matched_policy as (
  select
    cc.id as crew_cert_id,
    cm.refresh_years::int as refresh_years
  from public.crew_certs cc
  join public.cert_master cm
    on regexp_replace(lower(cm.cert_name), '[^a-z0-9]', '', 'g')
       = regexp_replace(lower(cc.cert_name), '[^a-z0-9]', '', 'g')
  where cc.expiry_date = date '2099-12-31'
    and cc.issue_date is not null
    and cm.refresh_years is not null
    and cm.refresh_years::int > 0
)
update public.crew_certs cc
set
  expiry_date = (cc.issue_date + make_interval(years => mp.refresh_years))::date,
  updated_at = now()
from matched_policy mp
where cc.id = mp.crew_cert_id;
