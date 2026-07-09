-- Platform admins for CENTER COURT.
-- This table is separate from club-level members.permission_role.
-- Platform admins manage the SuperMatch platform, clubs, and analytics,
-- but do not act as club owners/admins inside a specific club.

create table if not exists public.platform_admins (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'admin'
               check (role in ('owner', 'admin', 'analyst')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint platform_admins_auth_user_id_key unique (auth_user_id)
);

comment on table public.platform_admins is
  'SuperMatch platform admins for CENTER COURT. Separate from club-level members.permission_role.';

comment on column public.platform_admins.role is
  'owner: platform owner with full access including platform settings,
   admin: club creation/management and analytics access,
   analyst: analytics and reporting read-only access';

alter table public.platform_admins enable row level security;

-- No public read/write policy is created.
-- Server-side service_role clients bypass RLS and are the only intended access path.
-- To bootstrap the first platform admin, insert directly via Supabase SQL Editor:
--   insert into public.platform_admins (auth_user_id, role)
--   values ('[auth.users id from dashboard]', 'owner');
