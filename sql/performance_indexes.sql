-- Performance indexes for frequently filtered KMT Crew Portal tables.
-- Safe to run more than once in Supabase SQL Editor.

create index if not exists idx_ppe_requests_created_at
on public.ppe_requests (created_at desc);

create index if not exists idx_ppe_requests_status_created_at
on public.ppe_requests (status, created_at desc);

create index if not exists idx_ppe_requests_crew_id_created_at
on public.ppe_requests (crew_id, created_at desc);

create index if not exists idx_crew_certs_crew_id
on public.crew_certs (crew_id);

create index if not exists idx_crew_certs_cert_name
on public.crew_certs (cert_name);

create index if not exists idx_crew_certs_expiry_date
on public.crew_certs (expiry_date);

create index if not exists idx_ppe_inventory_category
on public.ppe_inventory (category);

create index if not exists idx_ppe_inventory_item_name
on public.ppe_inventory (item_name);

create index if not exists idx_ppe_stock_transactions_created_at
on public.ppe_stock_transactions (created_at desc);

create index if not exists idx_ppe_stock_transactions_inventory_id_created_at
on public.ppe_stock_transactions (inventory_id, created_at desc);

create index if not exists idx_ship_certificates_expiry_date
on public.ship_certificates (expiry_date);

create index if not exists idx_ship_certificates_next_survey_date
on public.ship_certificates (next_survey_date);

create index if not exists idx_ship_cert_history_created_at
on public.ship_cert_history (created_at desc);

create index if not exists idx_crew_cert_history_created_at
on public.crew_cert_history (created_at desc);

create index if not exists idx_sms_documents_category_doc_no
on public.sms_documents (category, doc_no);

create index if not exists idx_sms_revision_logs_round_created_at
on public.sms_revision_logs (update_round, created_at desc);

create index if not exists idx_sms_document_versions_document_status
on public.sms_document_versions (document_id, status);

create index if not exists idx_monthly_report_master_pic_schedule
on public.monthly_report_master (pic, schedule);

create index if not exists idx_monthly_report_submissions_month_master
on public.monthly_report_submissions (report_month, master_id);

create index if not exists idx_monthly_report_exports_month_position
on public.monthly_report_exports (report_month, position);

create index if not exists idx_ppe_size_responses_window_crew
on public.ppe_size_responses (window_id, crew_id);

create index if not exists idx_cert_email_logs_created_at
on public.cert_email_logs (created_at desc);

create index if not exists idx_cert_email_logs_status_created_at
on public.cert_email_logs (status, created_at desc);
