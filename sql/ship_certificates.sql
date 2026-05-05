create table if not exists public.ship_cert_master (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  category text not null,
  code text,
  cert_name text not null,
  default_issue_by text,
  has_expiry boolean default true,
  has_survey boolean default false,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ship_certificates (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references public.ship_cert_master(id) on delete set null,
  vessel_name text not null default 'Kamala Thanee',
  category text not null,
  code text,
  cert_name text not null,
  issue_by text,
  issued_date date,
  expiry_date date,
  last_survey_date date,
  next_survey_date date,
  remark text,
  file_url text,
  has_expiry boolean default true,
  has_survey boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vessel_name, category, code, cert_name)
);

create table if not exists public.ship_cert_surveys (
  id uuid primary key default gen_random_uuid(),
  ship_certificate_id uuid references public.ship_certificates(id) on delete cascade,
  survey_type text,
  survey_date date,
  next_survey_date date,
  endorsement_page integer,
  surveyor text,
  place text,
  file_url text,
  extracted_by text,
  confirmed_by text,
  created_at timestamptz default now()
);

create table if not exists public.ship_cert_ai_page_maps (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references public.ship_cert_master(id) on delete cascade,
  field_name text not null,
  preferred_pages integer[] default '{}',
  fallback_pages integer[] default '{}',
  extraction_hint text,
  confidence numeric,
  confirmed_by text,
  confirmed_at timestamptz,
  updated_at timestamptz default now(),
  unique (master_id, field_name)
);

create table if not exists public.ship_cert_history (
  id uuid primary key default gen_random_uuid(),
  ship_certificate_id uuid references public.ship_certificates(id) on delete cascade,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  actor_name text,
  created_at timestamptz default now()
);

alter table public.ship_cert_master enable row level security;
alter table public.ship_certificates enable row level security;
alter table public.ship_cert_surveys enable row level security;
alter table public.ship_cert_ai_page_maps enable row level security;
alter table public.ship_cert_history enable row level security;

drop policy if exists "Allow anon ship cert master read" on public.ship_cert_master;
drop policy if exists "Allow anon ship certificates read" on public.ship_certificates;
drop policy if exists "Allow anon ship certificates insert" on public.ship_certificates;
drop policy if exists "Allow anon ship certificates update" on public.ship_certificates;
drop policy if exists "Allow anon ship cert surveys read" on public.ship_cert_surveys;
drop policy if exists "Allow anon ship cert surveys insert" on public.ship_cert_surveys;
drop policy if exists "Allow anon ship cert page maps read" on public.ship_cert_ai_page_maps;
drop policy if exists "Allow anon ship cert history read" on public.ship_cert_history;
drop policy if exists "Allow anon ship cert history insert" on public.ship_cert_history;

create policy "Allow anon ship cert master read" on public.ship_cert_master for select using (true);
create policy "Allow anon ship certificates read" on public.ship_certificates for select using (true);
create policy "Allow anon ship certificates insert" on public.ship_certificates for insert with check (true);
create policy "Allow anon ship certificates update" on public.ship_certificates for update using (true) with check (true);
create policy "Allow anon ship cert surveys read" on public.ship_cert_surveys for select using (true);
create policy "Allow anon ship cert surveys insert" on public.ship_cert_surveys for insert with check (true);
create policy "Allow anon ship cert page maps read" on public.ship_cert_ai_page_maps for select using (true);
create policy "Allow anon ship cert history read" on public.ship_cert_history for select using (true);
create policy "Allow anon ship cert history insert" on public.ship_cert_history for insert with check (true);

insert into storage.buckets (id, name, public)
values ('ship-certificates', 'ship-certificates', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read ship certificate files" on storage.objects;
drop policy if exists "Anon upload ship certificate files" on storage.objects;
drop policy if exists "Anon update ship certificate files" on storage.objects;

create policy "Public read ship certificate files"
on storage.objects for select
using (bucket_id = 'ship-certificates');

create policy "Anon upload ship certificate files"
on storage.objects for insert
with check (bucket_id = 'ship-certificates');

create policy "Anon update ship certificate files"
on storage.objects for update
using (bucket_id = 'ship-certificates')
with check (bucket_id = 'ship-certificates');

drop table if exists pg_temp.ship_cert_seed;

create temporary table ship_cert_seed (
  source_key text,
  category text,
  code text,
  cert_name text,
  issue_by text,
  has_expiry boolean,
  has_survey boolean,
  sort_order integer,
  issued_date date,
  expiry_date date,
  last_survey_date date,
  next_survey_date date,
  remark text
) on commit drop;

insert into ship_cert_seed(source_key, category, code, cert_name, issue_by, has_expiry, has_survey, sort_order, issued_date, expiry_date, last_survey_date, next_survey_date, remark)
  values
  ('class_f1_ship_s_registration', 'Flag', 'F1', 'Ship''s Registration', 'Marine Department', false, false, 1, '2023-11-29'::date, null::date, null::date, null::date, '149124'),
  ('class_f2_ship_s_license', 'Flag', 'F2', 'Ship''s license', 'Marine Department', true, false, 2, '2025-11-04'::date, '2026-11-03'::date, null::date, null::date, '680-0002125'),
  ('class_f3_tonnage_certificate', 'Flag', 'F3', 'Tonnage Certificate', 'Marine Department', false, false, 3, '2023-12-22'::date, null::date, null::date, null::date, 'TN-66-038'),
  ('class_f4_ship_sanitation_control_certificate', 'Flag', 'F4', 'Ship Sanitation Control Certificate', 'Thai Government', true, false, 4, '2025-12-23'::date, '2026-06-23'::date, null::date, null::date, '010082'),
  ('class_f5_document_of_compliance_for_the_carriage_dangerous_goods', 'Flag', 'F5', 'Document of Compliance for The Carriage Dangerous Goods', 'Marine Department', true, false, 5, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'DG-66-066'),
  ('class_f6_statement_of_fact_for_vessel_not_apply_for_ballast_water', 'Flag', 'F6', 'Statement of fact For Vessel Not Apply For Ballast Water', 'Marine Department', true, false, 6, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'BW-66-507'),
  ('class_f7_exemption_certificate_modu_code_4_11_7_of_chapter_i', 'Flag', 'F7', 'Exemption Certificate (MODU Code 4.11.7 of Chapter I)', 'Marine Department', true, false, 7, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-118'),
  ('class_f8_exemption_certificate_life_boat', 'Flag', 'F8', 'Exemption Certificate (Life Boat)', 'Marine Department', true, false, 8, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-119'),
  ('class_f9_exemption_certificate_immersion_suit_tpa', 'Flag', 'F9', 'Exemption Certificate (Immersion suit & TPA)', 'Marine Department', true, false, 9, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-120'),
  ('class_f10_exemption_certificate_helicopter_facility_marking', 'Flag', 'F10', 'Exemption Certificate (Helicopter Facility Marking)', 'Marine Department', true, false, 10, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-121'),
  ('class_f11_exemption_certificate_minimum_bow_height', 'Flag', 'F11', 'Exemption Certificate (Minimum Bow Height)', 'Marine Department', true, false, 11, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-122'),
  ('class_f12_exemption_certificate_modu_code_1_4_of_chapter_i', 'Flag', 'F12', 'Exemption Certificate (MODU Code 1.4 of Chapter I)', 'Marine Department', true, false, 12, '2023-12-22'::date, '2028-12-21'::date, null::date, null::date, 'EX-66-123'),
  ('class_c1_document_of_compliance', 'Class', 'C1', 'Document of Compliance', 'BV', true, true, 13, '2024-05-02'::date, '2027-05-05'::date, '2025-06-11'::date, '2026-08-05'::date, 'BGK0/TDM/20240417053351'),
  ('class_c2_safety_management_certificate', 'Class', 'C2', 'Safety Management Certificate', 'BV', true, true, 14, '2024-09-23'::date, '2029-09-12'::date, '2024-09-13'::date, '2027-09-12'::date, 'SGP0/JEC/20240921162007'),
  ('class_c3_class_certificate', 'Class', 'C3', 'Class Certificate', 'ABS', true, true, 15, '2024-01-05'::date, '2029-01-04'::date, '2026-04-01'::date, '2027-03-31'::date, '14194247-6131719-019'),
  ('class_c4_moblie_offshore_unit_safety_certificate', 'Class', 'C4', 'Moblie Offshore Unit Safety Certificate', 'ABS', true, true, 16, '2024-01-05'::date, '2029-01-04'::date, '2026-04-01'::date, '2027-03-31'::date, '14194247-6825833-119'),
  ('class_c5_international_load_line_certificate', 'Class', 'C5', 'International Load Line Certificate', 'ABS', true, true, 17, '2024-01-05'::date, '2029-01-04'::date, '2026-04-01'::date, '2027-03-31'::date, '14194247-6131719-045'),
  ('class_c6_register_of_lifting_appliances', 'Class', 'C6', 'Register of Lifting Appliances', 'ABS', true, true, 18, '2024-01-05'::date, '2029-01-04'::date, '2026-02-25'::date, '2027-02-24'::date, '14194247-6131719-101'),
  ('class_c7_international_oil_polution_prevention_certificate', 'Class', 'C7', 'International Oil Polution Prevention Certificate', 'ABS', true, true, 19, '2024-01-05'::date, '2029-01-04'::date, '2026-02-25'::date, '2027-02-24'::date, '14194247-6131719-052'),
  ('class_c8_statement_of_compliance_for_air_pollution_prevention', 'Class', 'C8', 'Statement of Compliance For Air Pollution Prevention', 'ABS', true, true, 20, '2024-01-05'::date, '2029-01-04'::date, '2026-02-25'::date, '2027-02-24'::date, '14194247-6131719-073'),
  ('class_c9_statement_of_compliance_for_sewage_pollution_prevention', 'Class', 'C9', 'Statement of Compliance For Sewage Pollution Prevention', 'ABS', true, true, 21, '2024-01-05'::date, '2029-01-04'::date, null::date, null::date, '14194247-6131719-072'),
  ('class_c10_statement_of_fact_marpol_annex_v_garbage', 'Class', 'C10', 'Statement of Fact - MARPOL ANNEX V (GARBAGE)', 'ABS', false, true, 22, '2024-01-05'::date, null::date, null::date, null::date, '14194247-6131719-577'),
  ('class_c11_statement_of_compliance_for_anti_fouling_system', 'Class', 'C11', 'Statement of Compliance for Anti-Fouling System', 'ABS', false, true, 23, '2024-01-05'::date, null::date, null::date, null::date, '14194247-6131719-248'),
  ('class_c12_abs_record_of_approved_gmsdd_radio_installation', 'Class', 'C12', 'ABS Record of Approved GMSDD RADIO INSTALLATION', 'ABS', false, true, 24, '2024-01-05'::date, null::date, null::date, null::date, '14194247-6131719-255'),
  ('class_c13_statement_of_fact_ilo_convention_92_and_133_crew_accomodations', 'Class', 'C13', 'Statement of Fact - (ILO Convention 92 and 133 Crew Accomodations)', 'ABS', false, true, 25, '2024-01-05'::date, null::date, null::date, null::date, '14194247-6131719-576'),
  ('class_c14_cap_437_offshore_helicopter_landing_area', 'Class', 'C14', 'CAP 437 - Offshore Helicopter Landing Area', 'ABS', false, true, 26, '2024-01-05'::date, null::date, null::date, null::date, '14194247-6131719-526'),
  ('class_c15_vessel_status_report', 'Class', 'C15', 'Vessel Status Report', 'ABS', false, true, 27, '2026-01-13'::date, null::date, null::date, null::date, '14194247'),
  ('class_i1_h_m_insurance', 'Insurance', 'I1', 'H & M Insurance', 'Marsh', true, false, 28, '2025-09-11'::date, '2026-09-10'::date, null::date, null::date, 'MHU/202509/013/003'),
  ('class_i2_p_i_certificate', 'Insurance', 'I2', 'P & I Certificate', 'Shipowners', true, false, 29, '2026-02-06'::date, '2027-02-05'::date, null::date, null::date, '27625/1224788/727699/P&I-Market/01'),
  ('class_i3_certificate_of_insurance_for_bunker_oil_pollution_damage', 'Insurance', 'I3', 'Certificate of insurance for bunker oil pollution damage', 'Shipowners', true, false, 30, '2026-02-06'::date, '2027-02-05'::date, null::date, null::date, '27625/727699/1224788/2026/1'),
  ('class_i4_certificate_of_insurance_for_the_removal_of_wrecks', 'Insurance', 'I4', 'Certificate of Insurance for the removal of wrecks', 'Shipowners', true, false, 31, '2026-02-06'::date, '2027-02-05'::date, null::date, null::date, '27625/727699/1224788/2026/1'),
  ('class_p1_vessel_entry_permit', 'Permit', 'P1', 'Vessel Entry Permit', 'PTTEP', true, false, 32, '2026-04-05'::date, '2026-04-30'::date, null::date, null::date, '2026-EP-193'),
  ('gmdss_1_radio_communication_station_licence', 'GMDSS', 'G1', 'Radio communication Station Licence', 'NBTC', false, false, 33, '2023-12-13'::date, null::date, null::date, null::date, '40366003709'),
  ('gmdss_2_shore_based_maintenance', 'GMDSS', 'G2', 'Shore Based Maintenance', 'A. & Marine', true, false, 34, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, null),
  ('gmdss_3_radio_technicians_survey', 'GMDSS', 'G3', 'Radio Technicians Survey', 'A. & Marine', true, false, 35, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, null),
  ('gmdss_4_annual_testing_of_406_mhz_epirbs', 'GMDSS', 'G4', 'Annual Testing of 406 MHz EPIRBs', 'A. & Marine', true, false, 36, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'Maker: CETC/Model: VEP8A'),
  ('gmdss_5_expiry_date_of_hru', 'GMDSS', 'G5', '- Expiry Date of HRU', null, true, false, 37, null::date, '2028-02-28'::date, null::date, null::date, null),
  ('gmdss_6_expiry_date_of_battery', 'GMDSS', 'G6', '- Expiry Date of Battery', null, true, false, 38, null::date, '2031-02-28'::date, null::date, null::date, null),
  ('gmdss_7_annual_testing_of_sart', 'GMDSS', 'G7', 'Annual Testing of SART', 'A. & Marine', true, false, 39, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'Maker: CHIYANG/Model: CY-SART'),
  ('gmdss_8_expiry_date_of_battery', 'GMDSS', 'G8', '- Expiry Date of Battery', null, true, false, 40, null::date, '2030-03-31'::date, null::date, null::date, null),
  ('gmdss_9_annual_testing_of_portable_survival_craft_vhf', 'GMDSS', 'G9', 'Annual Testing of Portable Survival craft  VHF', 'A. & Marine', true, false, 41, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'Maker: NSR/Model: NTW-1000'),
  ('gmdss_10_expiry_date_of_battery', 'GMDSS', 'G10', '- Expiry Date of Battery', null, true, false, 42, null::date, '2027-12-31'::date, null::date, null::date, null),
  ('gmdss_11_annual_testing_of_ais', 'GMDSS', 'G11', 'Annual Testing of AIS', 'A. & Marine', true, false, 43, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'Maker: FURUNO/Model: FA-150'),
  ('gmdss_12_annual_testing_of_ssas', 'GMDSS', 'G12', 'Annual Testing of SSAS', 'A. & Marine', true, false, 44, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'Maker: FURUNO/Model: FELCOM-18'),
  ('ffe_1_certificate_of_fire_exthinguisher_inspection', 'FFE', 'FE1', 'Certificate of fire exthinguisher inspection', 'APT', true, false, 45, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-203/2026'),
  ('ffe_2_fire_exthinguisher_hydro_test_certificate', 'FFE', 'FE2', 'Fire exthinguisher Hydro Test certificate', 'SGMC', true, false, 46, '2023-12-20'::date, '2028-12-19'::date, null::date, null::date, 'SGMSC 00249/23'),
  ('ffe_3_firefighting_foam_replacement_report_pfos_free', 'FFE', 'FE3', 'Firefighting Foam Replacement Report ( PFOS-Free )', 'SGMC', false, false, 47, '2023-12-20'::date, null::date, null::date, null::date, null),
  ('ffe_4_certificate_of_portable_foam_applicator', 'FFE', 'FE4', 'Certificate of Portable foam applicator', null, false, false, 48, null::date, null::date, null::date, null::date, null),
  ('ffe_5_certificate_of_fix_co2_fire_extinguisher_system_original', 'FFE', 'FE5', 'Certificate of Fix CO2 fire extinguisher system(Original)', 'APT', true, false, 49, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-209/2026'),
  ('ffe_6_certificate_of_fix_co2_fire_extinguisher_system_galley', 'FFE', 'FE6', 'Certificate of Fix CO2 fire extinguisher system(Galley)', 'APT', true, false, 50, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-210/2026'),
  ('ffe_7_fixed_co2_hydro_test_certificate', 'FFE', 'FE7', 'Fixed CO2 Hydro Test certificate', 'SGMC', true, false, 51, '2023-12-20'::date, '2028-12-19'::date, null::date, null::date, 'SGMSC 00249/23'),
  ('ffe_8_certificate_of_fire_detection_general_alarm_system', 'FFE', 'FE8', 'Certificate of Fire detection & general alarm system', 'APT', true, false, 52, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-207/2026'),
  ('ffe_9_certificate_of_automatic_sprinker_system', 'FFE', 'FE9', 'Certificate of Automatic sprinker system', 'APT', true, false, 53, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-208/2026'),
  ('ffe_10_certificate_of_fixed_foam_test_system_heli_deck', 'FFE', 'FE10', 'Certificate of fixed foam test system ( Heli deck )', 'APT', true, false, 54, '2026-04-11'::date, '2027-04-10'::date, null::date, null::date, 'FFE-355/2026'),
  ('ffe_11_heli_deck_foam_recharged', 'FFE', 'FE11', 'Heli deck foam Recharged', 'HARIN', true, false, 55, '2023-12-13'::date, '2026-12-12'::date, null::date, null::date, '078/2023'),
  ('ffe_12_certificate_of_breating_air_cylinders_of_eebd', 'FFE', 'FE12', 'Certificate of Breating Air Cylinders of EEBD', 'APT', true, false, 56, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-205/2026'),
  ('ffe_13_eebd_hydrostatic_test_certificate', 'FFE', 'FE13', 'EEBD Hydrostatic test certificate', 'SGMC', true, false, 57, '2023-12-20'::date, '2028-12-19'::date, null::date, null::date, 'SGMSC 00249/23'),
  ('ffe_14_certificate_of_breating_air_cylinders_of_scba', 'FFE', 'FE14', 'Certificate of Breating Air Cylinders of SCBA', 'APT', true, false, 58, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-204/2026'),
  ('ffe_15_scba_hydrostatic_test_certificate', 'FFE', 'FE15', 'SCBA Hydrostatic test certificate', 'SGMC', true, false, 59, '2023-12-20'::date, '2028-12-19'::date, null::date, null::date, 'SGMSC 00249/23'),
  ('ffe_16_certificate_of_medical_oxygen', 'FFE', 'FE16', 'Certificate of Medical oxygen', 'APT', true, false, 60, '2026-02-25'::date, '2027-02-24'::date, null::date, null::date, 'FFE-206/2026'),
  ('ffe_17_medical_oxygen_hydrostatic_test_certificate', 'FFE', 'FE17', 'Medical oxygen Hydrostatic test Certificate', 'SGMC', true, false, 61, '2023-12-20'::date, '2028-12-19'::date, null::date, null::date, 'SGMSC 00249/23'),
  ('lsa_1_statement_rescue_boat_arrangements_5_yearly', 'LSA', 'L1', 'Statement Rescue boat Arrangements ( 5 Yearly )', 'APT', true, false, 62, '2023-12-26'::date, '2028-12-25'::date, null::date, null::date, 'APT-LB-064/2023'),
  ('lsa_2_statement_rescue_boat_arrangements_annually', 'LSA', 'L2', 'Statement Rescue boat Arrangements ( Annually )', 'APT', true, false, 63, '2026-02-24'::date, '2027-02-23'::date, null::date, null::date, 'APT-LB-008/2026'),
  ('lsa_3_certificate_of_life_raft_inspection_15_set', 'LSA', 'L3', 'Certificate of life raft inspection (15 set)', 'MSC', true, false, 64, '2026-01-08'::date, '2027-01-07'::date, null::date, null::date, 'MSC-002/2026 to MSC-016/2026'),
  ('lsa_4_certificate_of_life_raft_inspection_14_set', 'LSA', 'L4', 'Certificate of life raft inspection (14 set)', 'MSC', true, false, 65, '2026-02-02'::date, '2027-02-01'::date, null::date, null::date, 'MSC-022/2026 to MSC-035/2026'),
  ('lsa_5_certificate_of_hydrostatic_release_unit_24_set', 'LSA', 'L5', 'Certificate of hydrostatic release unit ( 24 set)', null, true, false, 66, '2023-12-31'::date, '2026-12-31'::date, null::date, null::date, null),
  ('lsa_6_certificate_of_mob_light_and_smoke_signal_2_sets', 'LSA', 'L6', 'Certificate of MOB light and smoke signal (2 sets)', null, true, false, 67, '2021-04-06'::date, '2026-07-31'::date, null::date, null::date, null),
  ('lsa_7_certificate_of_self_igniting_light_for_life_buoy_9_sets', 'LSA', 'L7', 'Certificate of self-igniting light for life buoy(9 sets)', null, true, false, 68, '2021-07-31'::date, '2026-07-31'::date, null::date, null::date, null),
  ('lsa_8_certificate_of_self_igniting_light_for_life_buoy_7_sets', 'LSA', 'L8', 'Certificate of self-igniting light for life buoy(7 sets)', null, true, false, 69, '2021-08-01'::date, '2028-10-31'::date, null::date, null::date, null),
  ('lsa_9_certificate_of_product_life_jacket_light_75_sets', 'LSA', 'L9', 'Certificate of product Life jacket light (75 sets )', null, true, false, 70, '2023-08-28'::date, '2026-11-30'::date, null::date, null::date, null),
  ('lsa_10_certificate_of_product_life_jacket_light_626_sets', 'LSA', 'L10', 'Certificate of product Life jacket light (626 sets )', null, true, false, 71, '2023-08-28'::date, '2026-11-30'::date, null::date, null::date, null),
  ('lsa_11_line_throwing_appliance_4_sets', 'LSA', 'L11', 'Line Throwing appliance (4 sets)', null, true, false, 72, '2021-04-06'::date, '2026-07-31'::date, null::date, null::date, null),
  ('lsa_12_certificate_of_parachute_disstress_signal_9_pcs', 'LSA', 'L12', 'Certificate of parachute disstress signal (9 Pcs)', null, true, false, 73, '2023-05-31'::date, '2026-05-31'::date, null::date, null::date, null),
  ('lsa_13_certificate_of_parachute_disstress_signal_3_pcs', 'LSA', 'L13', 'Certificate of parachute disstress signal (3 Pcs)', null, true, false, 74, '2023-05-31'::date, '2026-05-31'::date, null::date, null::date, null),
  ('lsa_14_certificate_of_gas_detector_no_1', 'LSA', 'L14', 'Certificate of Gas detector No.1', null, true, false, 75, '2025-07-11'::date, '2026-07-11'::date, null::date, null::date, 'GDS-021/2025'),
  ('lsa_15_certificate_of_gas_detector_no_2', 'LSA', 'L15', 'Certificate of Gas detector No.2', null, true, false, 76, '2025-07-18'::date, '2026-07-18'::date, null::date, null::date, 'KA423-8067223'),
  ('lsa_16_first_aid_kit_for_rescue_boat', 'LSA', 'L16', 'First aid kit for rescue boat', null, true, false, 77, '2025-06-02'::date, '2027-06-01'::date, null::date, null::date, null);
insert into public.ship_cert_master (source_key, category, code, cert_name, default_issue_by, has_expiry, has_survey, sort_order)
select source_key, category, code, cert_name, issue_by, has_expiry, has_survey, sort_order from ship_cert_seed
on conflict (source_key) do update set
  category = excluded.category,
  code = excluded.code,
  cert_name = excluded.cert_name,
  default_issue_by = excluded.default_issue_by,
  has_expiry = excluded.has_expiry,
  has_survey = excluded.has_survey,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.ship_certificates (master_id, vessel_name, category, code, cert_name, issue_by, issued_date, expiry_date, last_survey_date, next_survey_date, remark, has_expiry, has_survey, sort_order)
select m.id, 'Kamala Thanee', m.category, m.code, m.cert_name, seed.issue_by, seed.issued_date, seed.expiry_date, seed.last_survey_date, seed.next_survey_date, seed.remark, m.has_expiry, m.has_survey, m.sort_order
from public.ship_cert_master m
join ship_cert_seed seed on seed.source_key = m.source_key
on conflict (vessel_name, category, code, cert_name) do update set
  issue_by = excluded.issue_by,
  issued_date = excluded.issued_date,
  expiry_date = excluded.expiry_date,
  last_survey_date = excluded.last_survey_date,
  next_survey_date = excluded.next_survey_date,
  remark = excluded.remark,
  has_expiry = excluded.has_expiry,
  has_survey = excluded.has_survey,
  sort_order = excluded.sort_order,
  updated_at = now();

delete from public.ship_certificates current_row
using public.ship_cert_master master_row
where current_row.cert_name = master_row.cert_name
  and current_row.vessel_name = 'Kamala Thanee'
  and (current_row.category <> master_row.category or coalesce(current_row.code, '') <> coalesce(master_row.code, ''));

insert into public.ship_cert_ai_page_maps (master_id, field_name, preferred_pages, fallback_pages, extraction_hint, confidence, confirmed_at)
select m.id, field_name, preferred_pages, fallback_pages, extraction_hint, 0.8, now()
from public.ship_cert_master m
cross join (values
  ('cert_name', array[1], array[2], 'certificate title near top of page'),
  ('issued_date', array[1], array[2], 'completion date or issued date on certificate face page'),
  ('expiry_date', array[1], array[2], 'valid until'),
  ('last_survey_date', array[2], array[3,4], 'annual/intermediate survey endorsement'),
  ('next_survey_date', array[2], array[3,4], 'next annual/intermediate survey window')
) as fields(field_name, preferred_pages, fallback_pages, extraction_hint)
where m.source_key = 'class_c8_statement_of_compliance_for_air_pollution_prevention'
on conflict (master_id, field_name) do update set
  preferred_pages = excluded.preferred_pages,
  fallback_pages = excluded.fallback_pages,
  extraction_hint = excluded.extraction_hint,
  confidence = excluded.confidence,
  updated_at = now();
