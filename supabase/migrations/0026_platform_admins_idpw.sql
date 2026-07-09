-- CENTER COURT platform admin accounts.
-- Converts platform admin auth from Supabase auth_user_id based access
-- to independent username/password based access.

drop table if exists public.platform_admin_sessions;
drop table if exists public.platform_admins;

create table public.platform_admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  display_name  text,
  role          text not null default 'admin'
                check (role in ('owner', 'admin', 'analyst')),
  status        text not null default 'active'
                check (status in ('active', 'inactive')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.platform_admins is
  'CENTER COURT platform admin accounts. Independent from Supabase auth.users, Kakao login, and club-level admin sessions.';

comment on column public.platform_admins.username is
  'Unique CENTER COURT admin login id.';

comment on column public.platform_admins.password_hash is
  'scrypt password hash. Plain-text passwords must never be stored.';

comment on column public.platform_admins.role is
  'owner: platform owner, admin: platform operator, analyst: analytics read access';

comment on column public.platform_admins.status is
  'active: can sign in, inactive: blocked from CENTER COURT access';

create table public.platform_admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.platform_admins(id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.platform_admin_sessions is
  'CENTER COURT platform admin sessions. Only token_hash is stored; raw session tokens exist only in httpOnly cookies.';

comment on column public.platform_admin_sessions.token_hash is
  'SHA-256 hash of the raw session token.';

alter table public.platform_admins         enable row level security;
alter table public.platform_admin_sessions enable row level security;

-- No public policies are created.
-- Server-side service_role clients are the only intended access path.
--
-- Bootstrap instructions (run in Supabase SQL Editor after applying this migration):
--   1. Generate a password hash:
--      node -e "
--        const c=require('crypto'),{promisify:p}=require('util');
--        const scrypt=p(c.scrypt);
--        const s=c.randomBytes(16).toString('hex');
--        scrypt('YOUR_PASSWORD',s,64).then(h=>console.log(s+':'+h.toString('hex')));
--      "
--   2. Insert the owner account:
--      insert into public.platform_admins (username, password_hash, display_name, role)
--      values ('your_username', '[hash from step 1]', '관리자', 'owner');
