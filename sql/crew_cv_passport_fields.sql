-- Adds passport-derived CV fields to crew profiles.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.crews
  add column if not exists national_id_no text,
  add column if not exists nationality text,
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists passport_cv_updated_at timestamptz;
