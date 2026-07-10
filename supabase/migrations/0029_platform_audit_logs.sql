-- Platform Audit Log — CENTER COURT 민감 작업 기록
-- ⚠ 절대 password/token/session/cookie/secret 값을 저장하지 않는다.
--   서버측 helper(lib/platform-audit-log.ts)에서 이미 redaction 처리됨.

create table if not exists public.platform_audit_logs (
  id                uuid         primary key default gen_random_uuid(),
  -- actor snapshot (admin이 이후 삭제돼도 기록 유지)
  platform_admin_id uuid         references public.platform_admins(id) on delete set null,
  platform_admin_username text         not null,
  platform_admin_role     text         not null,
  -- action / target
  action            text         not null,   -- e.g. 'club.create', 'club.operator_role_change'
  target_type       text         not null,   -- 'club' | 'platform_admin' | 'club_member'
  target_id         text,                    -- uuid as text
  target_label      text,                    -- human-readable snapshot
  -- extra context
  club_id           uuid         references public.clubs(id) on delete set null,
  metadata          jsonb        not null default '{}',
  created_at        timestamptz  not null default now()
);

create index idx_pal_admin    on public.platform_audit_logs(platform_admin_id);
create index idx_pal_action   on public.platform_audit_logs(action);
create index idx_pal_target   on public.platform_audit_logs(target_type, target_id);
create index idx_pal_club     on public.platform_audit_logs(club_id);
create index idx_pal_created  on public.platform_audit_logs(created_at desc);

alter table public.platform_audit_logs enable row level security;
-- No public policy. service_role only via CENTER COURT APIs.

comment on table public.platform_audit_logs is
  'Immutable audit trail for CENTER COURT platform admin actions. No passwords/tokens stored.';
