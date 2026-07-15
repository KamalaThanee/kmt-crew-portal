-- Add the four STCW Basic Safety subject certificates as real master records.
-- Run this once in Supabase SQL Editor. It is safe to rerun.
--
-- Design:
-- - cert_matrix should keep only "Basic Safety Training ( 4 Basic )" as the
--   mandatory requirement, so readiness does not double-count the four subjects.
-- - cert_rules stores the relationship so the app can show the four subjects
--   under the Basic Safety parent and still allow individual uploads.

with subject_master(cert_name, cv_order) as (
  values
    ('Personal Survival Techniques', 111),
    ('Fire Prevention and Fire Fighting', 112),
    ('Elementary First Aid', 113),
    ('Personal Safety and Social Responsibilities', 114)
)
insert into public.cert_master (
  cert_name,
  refresh_years,
  cert_family,
  cv_section,
  stcw_group_key,
  requires_proficiency,
  required_proficiency_key,
  cv_order
)
select
  cert_name,
  5,
  'STCW',
  'Certificate of Training',
  'basic_safety',
  false,
  null,
  cv_order
from subject_master
on conflict (cert_name) do update
set
  refresh_years = excluded.refresh_years,
  cert_family = excluded.cert_family,
  cv_section = excluded.cv_section,
  stcw_group_key = excluded.stcw_group_key,
  requires_proficiency = excluded.requires_proficiency,
  required_proficiency_key = excluded.required_proficiency_key,
  cv_order = excluded.cv_order;

-- Keep the parent and refresher/COP metadata aligned too.
update public.cert_master
set
  refresh_years = 5,
  cert_family = 'STCW',
  cv_section = 'Certificate of Training',
  stcw_group_key = 'basic_safety',
  requires_proficiency = true,
  required_proficiency_key = 'basic_safety',
  cv_order = 100
where regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g') =
  regexp_replace(lower('Basic Safety Training ( 4 Basic )'), '[^a-z0-9]', '', 'g');

update public.cert_master
set
  refresh_years = 5,
  cert_family = 'STCW',
  cv_section = 'Certificate of Proficiency',
  stcw_group_key = 'basic_safety',
  requires_proficiency = false,
  required_proficiency_key = null,
  cv_order = 101
where regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g') =
  regexp_replace(lower('Basic Safety Training ( 4 Basic COP )'), '[^a-z0-9]', '', 'g');

with basic_safety_rules(trigger_cert, required_cert) as (
  values
    ('Basic Safety Training ( 4 Basic )', 'Basic Safety Training ( 4 Basic COP )'),
    ('Basic Safety Training ( 4 Basic )', 'Personal Survival Techniques'),
    ('Basic Safety Training ( 4 Basic )', 'Fire Prevention and Fire Fighting'),
    ('Basic Safety Training ( 4 Basic )', 'Elementary First Aid'),
    ('Basic Safety Training ( 4 Basic )', 'Personal Safety and Social Responsibilities')
)
insert into public.cert_rules (trigger_cert, required_cert)
select trigger_cert, required_cert
from basic_safety_rules rule
where not exists (
  select 1
  from public.cert_rules existing
  where regexp_replace(lower(existing.trigger_cert), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(rule.trigger_cert), '[^a-z0-9]', '', 'g')
    and regexp_replace(lower(existing.required_cert), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(rule.required_cert), '[^a-z0-9]', '', 'g')
);

-- Optional sanity check result.
select cert_name, refresh_years, cert_family, cv_section, stcw_group_key, cv_order
from public.cert_master
where stcw_group_key = 'basic_safety'
order by cv_order nulls last, cert_name;
