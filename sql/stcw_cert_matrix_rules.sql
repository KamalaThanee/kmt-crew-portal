-- STCW certificate matrix and COP dependency rules.
-- Safe to run more than once in Supabase SQL Editor.

-- 1) Basic Safety Training (4 Basic) is mandatory (P) for every known crew position.
with all_positions as (
  select distinct nullif(trim(position), '') as position
  from public.cert_matrix
  where nullif(trim(position), '') is not null
  union
  select distinct nullif(trim(position), '') as position
  from public.crews
  where nullif(trim(position), '') is not null
)
insert into public.cert_matrix (position, cert_name, requirement_type, category)
select
  position,
  'Basic Safety Training ( 4 Basic )',
  'P',
  'STCW'
from all_positions
where not exists (
  select 1
  from public.cert_matrix existing
  where regexp_replace(lower(existing.position), '[^a-z0-9]', '', 'g') = regexp_replace(lower(all_positions.position), '[^a-z0-9]', '', 'g')
    and regexp_replace(lower(existing.cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Basic Safety Training ( 4 Basic )'), '[^a-z0-9]', '', 'g')
);

-- If a row already exists for Basic Safety, make it mandatory.
update public.cert_matrix
set requirement_type = 'P',
    category = coalesce(nullif(category, ''), 'STCW')
where regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Basic Safety Training ( 4 Basic )'), '[^a-z0-9]', '', 'g');

-- 2) Medical First Aid is optional (O) for selected operational positions.
with target_positions(position) as (
  values
    ('Barge Master'),
    ('Chief Officer'),
    ('Safety Officer'),
    ('Radio Operator'),
    ('Chief Engineer'),
    ('Second Engineer')
)
insert into public.cert_matrix (position, cert_name, requirement_type, category)
select
  position,
  'Medical First Aid',
  'O',
  'STCW'
from target_positions
where not exists (
  select 1
  from public.cert_matrix existing
  where regexp_replace(lower(existing.position), '[^a-z0-9]', '', 'g') = regexp_replace(lower(target_positions.position), '[^a-z0-9]', '', 'g')
    and regexp_replace(lower(existing.cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Medical First Aid'), '[^a-z0-9]', '', 'g')
);

update public.cert_matrix
set requirement_type = 'O',
    category = coalesce(nullif(category, ''), 'STCW')
where regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Medical First Aid'), '[^a-z0-9]', '', 'g')
  and regexp_replace(lower(position), '[^a-z0-9]', '', 'g') in (
    'bargemaster',
    'chiefofficer',
    'safetyofficer',
    'radiooperator',
    'chiefengineer',
    'secondengineer'
  );

-- 3) PSCRB is optional (O) for selected operational positions.
with target_positions(position) as (
  values
    ('Barge Master'),
    ('Chief Officer'),
    ('Safety Officer'),
    ('Radio Operator'),
    ('Chief Engineer'),
    ('Second Engineer')
)
insert into public.cert_matrix (position, cert_name, requirement_type, category)
select
  position,
  'Proficiency in Survival Craft and Rescue Boats other than Fast Rescue Boats',
  'O',
  'STCW'
from target_positions
where not exists (
  select 1
  from public.cert_matrix existing
  where regexp_replace(lower(existing.position), '[^a-z0-9]', '', 'g') = regexp_replace(lower(target_positions.position), '[^a-z0-9]', '', 'g')
    and regexp_replace(lower(existing.cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Proficiency in Survival Craft and Rescue Boats other than Fast Rescue Boats'), '[^a-z0-9]', '', 'g')
);

update public.cert_matrix
set requirement_type = 'O',
    category = coalesce(nullif(category, ''), 'STCW')
where regexp_replace(lower(cert_name), '[^a-z0-9]', '', 'g') = regexp_replace(lower('Proficiency in Survival Craft and Rescue Boats other than Fast Rescue Boats'), '[^a-z0-9]', '', 'g')
  and regexp_replace(lower(position), '[^a-z0-9]', '', 'g') in (
    'bargemaster',
    'chiefofficer',
    'safetyofficer',
    'radiooperator',
    'chiefengineer',
    'secondengineer'
  );

-- 4) Training certificate dependencies: if training exists, require the matching COP.
insert into public.cert_rules (trigger_cert, required_cert)
select trigger_cert, required_cert
from (
  values
    ('Basic Safety Training ( 4 Basic )', 'Basic Safety Training ( 4 Basic COP )'),
    ('Medical First Aid', 'Medical First Aid ( COP )'),
    ('Proficiency in Survival Craft and Rescue Boats other than Fast Rescue Boats', 'Proficiency in Survival Craft and Rescue Boats other than Fast Rescue Boats ( COP )')
) as rule(trigger_cert, required_cert)
where not exists (
  select 1
  from public.cert_rules existing
  where regexp_replace(lower(existing.trigger_cert), '[^a-z0-9]', '', 'g') = regexp_replace(lower(rule.trigger_cert), '[^a-z0-9]', '', 'g')
    and regexp_replace(lower(existing.required_cert), '[^a-z0-9]', '', 'g') = regexp_replace(lower(rule.required_cert), '[^a-z0-9]', '', 'g')
);
