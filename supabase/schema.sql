-- Supabase Schema for MSREG Gala Camera & Gallery Reveal System

-- 1. Create app_settings table
create table if not exists public.app_settings (
  id text primary key default 'settings',
  revealed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed single row if not present
insert into public.app_settings (id, revealed)
values ('settings', false)
on conflict (id) do nothing;

-- 2. Create guests table
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  session_token text not null unique,
  shots_remaining integer not null default 8 check (shots_remaining >= 0 and shots_remaining <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guests_email on public.guests(lower(email));
create index if not exists idx_guests_session_token on public.guests(session_token);

-- 3. Create photos table
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  storage_path text not null,       -- Path in private bucket 'gala-originals'
  preview_path text not null,       -- Path in public bucket 'gala-previews'
  preview_url text not null,        -- Heavily blurred low-res image URL
  caption text,
  exposure_number integer not null check (exposure_number >= 1 and exposure_number <= 8),
  created_at timestamptz not null default now()
);

create index if not exists idx_photos_guest_id on public.photos(guest_id);
create index if not exists idx_photos_created_at on public.photos(created_at desc);

-- 4. Storage Buckets:
-- 'gala-originals': strictly PRIVATE (never accessible directly by public URL before reveal)
insert into storage.buckets (id, name, public)
values ('gala-originals', 'gala-originals', false)
on conflict (id) do update set public = false;

-- 'gala-previews': PUBLIC (contains blurred, low-res images only)
insert into storage.buckets (id, name, public)
values ('gala-previews', 'gala-previews', true)
on conflict (id) do update set public = true;

-- 5. Policies
-- Previews can be read by anyone
create policy "Public Previews Read"
on storage.objects for select
using (bucket_id = 'gala-previews');

-- Insert allowed via service role or anon
create policy "Allow Previews Insert"
on storage.objects for insert
with check (bucket_id = 'gala-previews');

create policy "Allow Originals Insert"
on storage.objects for insert
with check (bucket_id = 'gala-originals');
