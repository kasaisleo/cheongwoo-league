-- Club Admin Audit Log — /admin(club master) 권한 변경 감사 로그.
-- platform_audit_logs(CENTER COURT 전용)와 완전히 분리된 테이블.
-- ⚠ 민감정보(이메일/카카오 provider metadata/전체 전화번호 등)는 저장하지 않는다.

create table if not exists public.club_admin_audit_logs (
  id                    uuid        primary key default gen_random_uuid(),
  club_id               uuid        not null references public.clubs(id) on delete cascade,
  -- actor snapshot (member row가 이후 삭제돼도 기록 유지)
  actor_member_id       uuid        references public.members(id) on delete set null,
  actor_auth_user_id    uuid        not null,
  actor_name_snapshot   text        not null,
  -- target snapshot
  target_member_id      uuid        references public.members(id) on delete set null,
  target_name_snapshot  text        not null,
  old_role              permission_role,
  new_role              permission_role,
  action                text        not null,   -- 'role_assign' | 'role_change' | 'role_revoke' | 'kakao_unlink'
  metadata              jsonb       not null default '{}',
  created_at            timestamptz not null default now()
);

create index if not exists idx_caal_club    on public.club_admin_audit_logs(club_id);
create index if not exists idx_caal_target  on public.club_admin_audit_logs(target_member_id);
create index if not exists idx_caal_created on public.club_admin_audit_logs(created_at desc);

alter table public.club_admin_audit_logs enable row level security;
-- No public/anon/authenticated policy. service_role (RLS bypass) 전용 read/write.

comment on table public.club_admin_audit_logs is
  'Immutable audit trail for club-admin (master) permission mutations in /admin. Separate from platform_audit_logs (CENTER COURT).';

-- ─────────────────────────────────────────────────────────────
-- RPC: assign_member_permission_role
--
-- members.permission_role 변경 + club_admin_audit_logs insert를
-- 단일 트랜잭션으로 처리한다 (Postgres 함수 호출 = 하나의 트랜잭션).
-- action은 DB가 old_role/new_role로부터 직접 판정한다 — 호출자가
-- action 문자열을 넘기지 않는다(위조 방지).
--
-- SECURITY INVOKER — 호출자는 항상 service_role(RLS bypass)이므로
-- DEFINER 승격이 불필요하다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.assign_member_permission_role(
  p_club_id            uuid,
  p_actor_auth_user_id uuid,
  p_target_member_id   uuid,
  p_new_role           permission_role
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor  record;
  v_target record;
  v_old_role permission_role;
  v_action   text;
  v_old_is_operator boolean;
  v_new_is_operator boolean;
begin
  if p_new_role not in ('member', 'manager', 'admin') then
    raise exception 'invalid_role';
  end if;

  -- actor 재검증: 같은 club의 active master인지 DB에서 직접 확인
  -- (API 레벨 getAdminAccessServer() 결과를 신뢰하지 않고 이중 검증)
  select id, name, permission_role, is_active, deleted_at
    into v_actor
    from public.members
   where auth_user_id = p_actor_auth_user_id
     and club_id = p_club_id
   limit 1;

  if not found
     or v_actor.permission_role <> 'master'
     or v_actor.is_active is not true
     or v_actor.deleted_at is not null then
    raise exception 'owner_required';
  end if;

  -- target row 잠금 후 모든 조건 재검증
  select id, name, permission_role, is_active, is_dormant, deleted_at, auth_user_id
    into v_target
    from public.members
   where id = p_target_member_id
     and club_id = p_club_id
   for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if v_target.auth_user_id is not null and v_target.auth_user_id = p_actor_auth_user_id then
    raise exception 'self_change_forbidden';
  end if;

  if v_target.permission_role = 'master' then
    raise exception 'master_locked';
  end if;

  if v_target.deleted_at is not null then
    raise exception 'member_withdrawn';
  end if;

  if v_target.is_active is not true then
    raise exception 'member_dormant';
  end if;

  if v_target.is_dormant then
    raise exception 'member_excluded';
  end if;

  if v_target.auth_user_id is null then
    raise exception 'member_unlinked';
  end if;

  v_old_role := v_target.permission_role;

  if v_old_role = p_new_role then
    raise exception 'role_unchanged';
  end if;

  v_old_is_operator := v_old_role in ('manager', 'admin');
  v_new_is_operator := p_new_role in ('manager', 'admin');

  if (not v_old_is_operator) and v_new_is_operator then
    v_action := 'role_assign';
  elsif v_old_is_operator and (not v_new_is_operator) then
    v_action := 'role_revoke';
  elsif v_old_is_operator and v_new_is_operator then
    v_action := 'role_change';
  else
    v_action := 'role_change';
  end if;

  update public.members
     set permission_role = p_new_role
   where id = p_target_member_id
     and club_id = p_club_id;

  insert into public.club_admin_audit_logs (
    club_id, actor_member_id, actor_auth_user_id, actor_name_snapshot,
    target_member_id, target_name_snapshot, old_role, new_role, action
  ) values (
    p_club_id, v_actor.id, p_actor_auth_user_id, v_actor.name,
    p_target_member_id, v_target.name, v_old_role, p_new_role, v_action
  );

  return jsonb_build_object(
    'name', v_target.name,
    'old_role', v_old_role,
    'new_role', p_new_role,
    'action', v_action
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: unlink_member_kakao
--
-- members.auth_user_id/is_kakao_linked 해제 + audit insert를
-- 단일 트랜잭션으로 처리한다.
-- ─────────────────────────────────────────────────────────────
create or replace function public.unlink_member_kakao(
  p_club_id            uuid,
  p_actor_auth_user_id uuid,
  p_target_member_id   uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor  record;
  v_target record;
begin
  select id, name, permission_role, is_active, deleted_at
    into v_actor
    from public.members
   where auth_user_id = p_actor_auth_user_id
     and club_id = p_club_id
   limit 1;

  if not found
     or v_actor.permission_role <> 'master'
     or v_actor.is_active is not true
     or v_actor.deleted_at is not null then
    raise exception 'owner_required';
  end if;

  select id, name, permission_role, auth_user_id
    into v_target
    from public.members
   where id = p_target_member_id
     and club_id = p_club_id
   for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if v_target.auth_user_id is not null and v_target.auth_user_id = p_actor_auth_user_id then
    raise exception 'self_change_forbidden';
  end if;

  if v_target.permission_role = 'master' then
    raise exception 'master_locked';
  end if;

  if v_target.auth_user_id is null then
    raise exception 'already_unlinked';
  end if;

  update public.members
     set auth_user_id = null,
         is_kakao_linked = false
   where id = p_target_member_id
     and club_id = p_club_id;

  insert into public.club_admin_audit_logs (
    club_id, actor_member_id, actor_auth_user_id, actor_name_snapshot,
    target_member_id, target_name_snapshot, old_role, new_role, action
  ) values (
    p_club_id, v_actor.id, p_actor_auth_user_id, v_actor.name,
    p_target_member_id, v_target.name, v_target.permission_role, v_target.permission_role, 'kakao_unlink'
  );

  return jsonb_build_object('name', v_target.name);
end;
$$;

-- execute 권한: service_role 전용. public/anon/authenticated는 절대 실행 불가.
revoke all on function public.assign_member_permission_role(uuid, uuid, uuid, permission_role) from public;
revoke all on function public.assign_member_permission_role(uuid, uuid, uuid, permission_role) from anon;
revoke all on function public.assign_member_permission_role(uuid, uuid, uuid, permission_role) from authenticated;
grant execute on function public.assign_member_permission_role(uuid, uuid, uuid, permission_role) to service_role;

revoke all on function public.unlink_member_kakao(uuid, uuid, uuid) from public;
revoke all on function public.unlink_member_kakao(uuid, uuid, uuid) from anon;
revoke all on function public.unlink_member_kakao(uuid, uuid, uuid) from authenticated;
grant execute on function public.unlink_member_kakao(uuid, uuid, uuid) to service_role;
