create table if not exists public.sms_documents (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null,
  title text not null,
  category text not null check (category in ('Procedure', 'Checklist')),
  current_revision text,
  effective_date date,
  active_version_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doc_no)
);

create table if not exists public.sms_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.sms_documents(id) on delete set null,
  doc_no text not null,
  title text not null,
  category text not null check (category in ('Procedure', 'Checklist')),
  revision text,
  effective_date date,
  status text not null default 'active' check (status in ('active', 'superseded')),
  file_name text,
  file_path text,
  file_url text,
  file_size bigint,
  mime_type text,
  change_summary text,
  header_source text,
  update_round text,
  update_date date,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_revision_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.sms_documents(id) on delete set null,
  version_id uuid references public.sms_document_versions(id) on delete set null,
  action text not null,
  doc_no text,
  title text,
  category text,
  old_revision text,
  new_revision text,
  file_name text,
  actor_id uuid,
  actor_name text,
  details jsonb,
  update_round text,
  update_date date,
  created_at timestamptz not null default now()
);

alter table public.sms_document_versions
add column if not exists document_id uuid references public.sms_documents(id) on delete set null;

alter table public.sms_document_versions
add column if not exists file_name text;

alter table public.sms_document_versions
add column if not exists file_path text;

alter table public.sms_document_versions
add column if not exists file_url text;

alter table public.sms_document_versions
add column if not exists file_size bigint;

alter table public.sms_document_versions
add column if not exists mime_type text;

alter table public.sms_document_versions
add column if not exists change_summary text;

alter table public.sms_document_versions
add column if not exists header_source text;

alter table public.sms_document_versions
add column if not exists update_round text;

alter table public.sms_document_versions
add column if not exists update_date date;

alter table public.sms_document_versions
add column if not exists uploaded_by uuid;

alter table public.sms_document_versions
add column if not exists uploaded_by_name text;

alter table public.sms_revision_logs
add column if not exists update_round text;

alter table public.sms_revision_logs
add column if not exists update_date date;

create index if not exists idx_sms_documents_category
on public.sms_documents (category, doc_no);

create index if not exists idx_sms_versions_document_created
on public.sms_document_versions (document_id, created_at desc);

create index if not exists idx_sms_versions_status_doc
on public.sms_document_versions (status, doc_no);

create index if not exists idx_sms_logs_created_at
on public.sms_revision_logs (created_at desc);

create index if not exists idx_sms_logs_update_round
on public.sms_revision_logs (update_round, created_at desc);

alter table public.sms_documents enable row level security;
alter table public.sms_document_versions enable row level security;
alter table public.sms_revision_logs enable row level security;

drop policy if exists "Allow sms documents read" on public.sms_documents;
drop policy if exists "Allow sms documents write" on public.sms_documents;
drop policy if exists "Allow sms versions read" on public.sms_document_versions;
drop policy if exists "Allow sms versions write" on public.sms_document_versions;
drop policy if exists "Allow sms logs read" on public.sms_revision_logs;
drop policy if exists "Allow sms logs write" on public.sms_revision_logs;

create policy "Allow sms documents read"
on public.sms_documents
for select
using (true);

create policy "Allow sms documents write"
on public.sms_documents
for all
using (true)
with check (true);

create policy "Allow sms versions read"
on public.sms_document_versions
for select
using (true);

create policy "Allow sms versions write"
on public.sms_document_versions
for all
using (true)
with check (true);

create policy "Allow sms logs read"
on public.sms_revision_logs
for select
using (true);

create policy "Allow sms logs write"
on public.sms_revision_logs
for all
using (true)
with check (true);

grant select, insert, update, delete on public.sms_documents to anon, authenticated;
grant select, insert, update, delete on public.sms_document_versions to anon, authenticated;
grant select, insert on public.sms_revision_logs to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('sms-documents', 'sms-documents', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Allow sms document files read" on storage.objects;
drop policy if exists "Allow sms document files upload" on storage.objects;
drop policy if exists "Allow sms document files update" on storage.objects;

create policy "Allow sms document files read"
on storage.objects
for select
using (bucket_id = 'sms-documents');

create policy "Allow sms document files upload"
on storage.objects
for insert
with check (bucket_id = 'sms-documents');

create policy "Allow sms document files update"
on storage.objects
for update
using (bucket_id = 'sms-documents')
with check (bucket_id = 'sms-documents');
