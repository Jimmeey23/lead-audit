-- Physique 57 Outreach Audit Supabase Backend Setup
-- Run this in the Supabase SQL Editor for your project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email));

create or replace function public.is_active_admin(user_email text default auth.email())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(user_email, auth.email())) = 'jimmeey@physique57india.com';
$$;

create table if not exists public.lead_responses (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  lead_name text not null,
  lead_email text,
  lead_phone text,
  center text not null,
  associate text,
  stage_name text,
  class_type text,
  source_name text,
  response_notes text,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_by_email text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_responses_status_check check (status in ('draft', 'submitted', 'reviewed')),
  constraint lead_responses_unique_submitter unique (lead_id, submitted_by)
);

alter table public.lead_responses
add column if not exists lead_email text;

alter table public.lead_responses
add column if not exists lead_phone text;

alter table public.lead_responses
add column if not exists center text;

alter table public.lead_responses
add column if not exists associate text;

alter table public.lead_responses
add column if not exists stage_name text;

alter table public.lead_responses
add column if not exists class_type text;

alter table public.lead_responses
add column if not exists source_name text;

alter table public.lead_responses
add column if not exists response_notes text;

alter table public.lead_responses
alter column status set default 'submitted';

do $$
begin
  alter table public.lead_responses
    drop constraint if exists lead_responses_status_check;

  alter table public.lead_responses
    add constraint lead_responses_status_check
    check (status in ('draft', 'submitted', 'reviewed'));
end $$;

create unique index if not exists lead_responses_unique_submitter_idx
  on public.lead_responses (lead_id, submitted_by);

create table if not exists public.lead_response_touchpoints (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.lead_responses(id) on delete cascade,
  touchpoint_key text not null,
  touchpoint_order integer not null,
  label text not null,
  occurred_at timestamptz,
  medium text,
  comment text,
  evidence_unavailable boolean not null default false,
  evidence_unavailable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_response_touchpoints_unique_key unique (response_id, touchpoint_key)
);

alter table public.lead_response_touchpoints
add column if not exists evidence_unavailable boolean not null default false;

alter table public.lead_response_touchpoints
add column if not exists evidence_unavailable_reason text;

alter table public.lead_response_touchpoints
add column if not exists medium text;

alter table public.lead_response_touchpoints
add column if not exists comment text;

create table if not exists public.lead_response_files (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.lead_responses(id) on delete cascade,
  touchpoint_id uuid not null references public.lead_response_touchpoints(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  storage_bucket text not null default 'lead-evidence',
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint lead_response_files_storage_path_unique unique (storage_bucket, storage_path)
);

create index if not exists lead_responses_submitted_by_idx on public.lead_responses (submitted_by);
create index if not exists lead_responses_center_idx on public.lead_responses (center);
create index if not exists lead_responses_updated_at_idx on public.lead_responses (updated_at desc);
create index if not exists lead_response_touchpoints_response_id_idx on public.lead_response_touchpoints (response_id);
create index if not exists lead_response_files_response_id_idx on public.lead_response_files (response_id);
create index if not exists lead_response_files_touchpoint_id_idx on public.lead_response_files (touchpoint_id);
create index if not exists lead_response_files_uploaded_by_idx on public.lead_response_files (uploaded_by);

create or replace function public.submitted_lead_ids()
returns table (lead_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.lead_id
  from public.lead_responses r
  where r.status in ('submitted', 'reviewed');
$$;

grant execute on function public.submitted_lead_ids() to authenticated;

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_responses_updated_at on public.lead_responses;
create trigger set_lead_responses_updated_at
before update on public.lead_responses
for each row execute function public.set_updated_at();

drop trigger if exists set_lead_response_touchpoints_updated_at on public.lead_response_touchpoints;
create trigger set_lead_response_touchpoints_updated_at
before update on public.lead_response_touchpoints
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.lead_responses enable row level security;
alter table public.lead_response_touchpoints enable row level security;
alter table public.lead_response_files enable row level security;

drop policy if exists "Users can read their own admin row" on public.admin_users;
create policy "Users can read their own admin row"
on public.admin_users
for select
to authenticated
using (active = true and lower(email) = lower(auth.email()));

drop policy if exists "Admins can read admin list" on public.admin_users;
create policy "Admins can read admin list"
on public.admin_users
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "Users can read own lead responses" on public.lead_responses;
create policy "Users can read own lead responses"
on public.lead_responses
for select
to authenticated
using (submitted_by = auth.uid());

drop policy if exists "Admins can read all lead responses" on public.lead_responses;
create policy "Admins can read all lead responses"
on public.lead_responses
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "Users can insert own lead responses" on public.lead_responses;
create policy "Users can insert own lead responses"
on public.lead_responses
for insert
to authenticated
with check (submitted_by = auth.uid() and lower(submitted_by_email) = lower(auth.email()));

drop policy if exists "Users can update own lead responses" on public.lead_responses;
create policy "Users can update own lead responses"
on public.lead_responses
for update
to authenticated
using (submitted_by = auth.uid())
with check (submitted_by = auth.uid() and lower(submitted_by_email) = lower(auth.email()));

drop policy if exists "Admins can reset lead responses" on public.lead_responses;
create policy "Admins can reset lead responses"
on public.lead_responses
for update
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "Users can delete own lead responses" on public.lead_responses;
create policy "Users can delete own lead responses"
on public.lead_responses
for delete
to authenticated
using (submitted_by = auth.uid());

drop policy if exists "Admins can delete lead responses" on public.lead_responses;
create policy "Admins can delete lead responses"
on public.lead_responses
for delete
to authenticated
using (public.is_active_admin());

drop policy if exists "Users and admins can read touchpoints" on public.lead_response_touchpoints;
create policy "Users and admins can read touchpoints"
on public.lead_response_touchpoints
for select
to authenticated
using (
  public.is_active_admin()
  or exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users can insert own touchpoints" on public.lead_response_touchpoints;
create policy "Users can insert own touchpoints"
on public.lead_response_touchpoints
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users can update own touchpoints" on public.lead_response_touchpoints;
create policy "Users can update own touchpoints"
on public.lead_response_touchpoints
for update
to authenticated
using (
  exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users can delete own touchpoints" on public.lead_response_touchpoints;
create policy "Users can delete own touchpoints"
on public.lead_response_touchpoints
for delete
to authenticated
using (
  exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users and admins can read response files" on public.lead_response_files;
create policy "Users and admins can read response files"
on public.lead_response_files
for select
to authenticated
using (
  public.is_active_admin()
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users can insert own response files" on public.lead_response_files;
create policy "Users can insert own response files"
on public.lead_response_files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists "Users can delete own response files" on public.lead_response_files;
create policy "Users can delete own response files"
on public.lead_response_files
for delete
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1
    from public.lead_responses r
    where r.id = response_id
      and r.submitted_by = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-evidence',
  'lead-evidence',
  false,
  209715200,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/x-aac',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload lead evidence" on storage.objects;
create policy "Authenticated users can upload lead evidence"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'lead-evidence' and owner = auth.uid());

drop policy if exists "Owners and admins can read lead evidence" on storage.objects;
create policy "Owners and admins can read lead evidence"
on storage.objects
for select
to authenticated
using (bucket_id = 'lead-evidence' and (owner = auth.uid() or public.is_active_admin()));

drop policy if exists "Owners can update lead evidence" on storage.objects;
create policy "Owners can update lead evidence"
on storage.objects
for update
to authenticated
using (bucket_id = 'lead-evidence' and owner = auth.uid())
with check (bucket_id = 'lead-evidence' and owner = auth.uid());

drop policy if exists "Owners can delete lead evidence" on storage.objects;
create policy "Owners can delete lead evidence"
on storage.objects
for delete
to authenticated
using (bucket_id = 'lead-evidence' and (owner = auth.uid() or public.is_active_admin()));

-- The app and RLS only treat this address as admin.
-- info@physique57india.com is intentionally not an admin account.
--
-- insert into public.admin_users (email, role, active)
-- select 'jimmeey@physique57india.com', 'admin', true
-- where not exists (
--   select 1 from public.admin_users where lower(email) = lower('jimmeey@physique57india.com')
-- );
