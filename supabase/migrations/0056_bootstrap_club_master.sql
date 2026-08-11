-- ============================================================
-- 0056: 플랫폼 마스터 bootstrap (CENTER COURT 신규/기존 클럽에 레오를
--       master로 등록)
--
-- 배경: 기존 CENTER COURT Operators(app/api/platform/clubs/[id]/operators/
--   route.ts PATCH)는 "이미 auth_user_id가 있는 기존 members 행의 role만
--   변경"할 수 있을 뿐, 새 클럽에 첫 master 행을 만드는 경로가 어디에도
--   없었다(2A-6B-1 이후 "전 클럽 레오 master 등록" 사전 조사에서 확인된
--   구조적 누락). 신규 인증 체계·신규 운영진 화면은 만들지 않고, 기존
--   members.permission_role='master' 모델과 (club_id, auth_user_id) 복합
--   unique 제약을 그대로 재사용한다.
--
-- 원자성: POST /api/platform/clubs가 "clubs INSERT" 후 별도로 RPC를
--   호출하면 같은 HTTP 요청이어도 서로 다른 트랜잭션이라 중간 실패 시
--   master 없는 클럽만 남을 수 있다. 그래서 클럽 생성+기본 설정(컬럼
--   default로 이미 처리됨)+최초 master 행 생성을 create_club_with_master
--   RPC 하나(=단일 Postgres 함수 호출=단일 트랜잭션) 안에서 전부 수행한다.
--   audit 기록(recordPlatformAuditLog)은 원래도 실패해도 요청을 실패시키지
--   않는 best-effort 부수 효과라 RPC에 포함하지 않고 route에서 그대로
--   유지한다(가장 작은 변경).
--
-- 재사용을 위해 "member 행 확보 + master 승격" 로직을 private helper
-- _bootstrap_club_master로 뽑아 두 공개 RPC가 공유한다:
--   - bootstrap_club_master(club_id, auth_user_id) — 이미 존재하는 클럽
--     (예: E2E QA 클럽) 백필용.
--   - create_club_with_master(name, slug, description, auth_user_id) —
--     신규 클럽 생성 + 즉시 master 등록(원자적).
--
-- member 생성 규칙(요청 사항 그대로):
--   - (club_id, auth_user_id) 조회 결과가 있으면 그 행을 그대로 쓴다.
--     이미 master면 no-op, 아니면 master로 승격만 한다(새 행을 만들지 않음).
--   - 그 행이 비활성/탈퇴 상태면 임의로 되살리지 않고 명시적으로 실패시킨다.
--   - 없으면 새로 만든다 — 이름/닉네임/전화번호로 다른 행을 추정 연결하지
--     않고, 오직 auth_user_id로만 "이 사람의 기존 정상(활성·미탈퇴) 행"을
--     찾아 name/nickname/grade/member_type/player_background만 복제한다.
--     여러 클럽에 걸쳐 값이 다를 수 있어 created_at이 가장 이른 행을
--     canonical 원본으로 확정한다(전화번호·주소·나이·지역점수 등 개인정보/
--     지역 데이터는 복제하지 않고 컬럼 default(null/0)를 그대로 둔다 —
--     기존 나마스테 master 행이 이미 이 패턴이었음을 실측으로 확인).
--   - auth.users에 실제로 존재하는 auth_user_id인지 항상 먼저 확인한다.
--
-- 동시성: (club_id, auth_user_id) 신규 INSERT 경합은 members_club_id_
--   auth_user_id_key unique_violation으로 막히므로, 그 예외를 잡아 방금
--   경합에서 이긴 행을 다시 읽어 동일한 멱등 로직(승격/no-op)을 한 번 더
--   적용한다 — 그래도 실패하면 원래 예외를 그대로 올린다.
--
-- 권한: PUBLIC/anon/authenticated 전부 revoke, service_role만 EXECUTE.
--   private helper는 service_role에도 EXECUTE를 주지 않는다(0045/0051/
--   0052/0054와 동일한 private helper 관례).
-- ============================================================

begin;

-- ============================================================
-- 1) private helper — member 행 확보 + master 승격(신규 생성 아니면 재사용)
-- ============================================================
create function public._bootstrap_club_master(
  p_club_id uuid,
  p_auth_user_id uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_auth_exists boolean;
  v_member public.members%rowtype;
  v_source public.members%rowtype;
  v_new_id uuid;
begin
  select exists(select 1 from auth.users where id = p_auth_user_id) into v_auth_exists;
  if not v_auth_exists then
    raise exception 'PLATFORM_MASTER_AUTH_USER_NOT_FOUND';
  end if;

  select * into v_member
  from public.members
  where club_id = p_club_id and auth_user_id = p_auth_user_id
  for update;

  if found then
    if v_member.deleted_at is not null or not v_member.is_active then
      raise exception 'PLATFORM_MASTER_MEMBER_INACTIVE';
    end if;

    if v_member.permission_role = 'master' then
      return jsonb_build_object(
        'member_id', v_member.id, 'action', 'noop',
        'name', v_member.name, 'nickname', v_member.nickname
      );
    end if;

    update public.members
    set permission_role = 'master'
    where id = v_member.id;

    return jsonb_build_object(
      'member_id', v_member.id, 'action', 'promoted',
      'name', v_member.name, 'nickname', v_member.nickname
    );
  end if;

  -- 신규 행: auth_user_id로만 "이 사람의 기존 정상 행"을 찾는다(이름·
  -- nickname·전화번호 추정 연결 금지). 여러 클럽에 걸친 행 중 created_at이
  -- 가장 이른 것을 canonical 원본으로 확정.
  select * into v_source
  from public.members
  where auth_user_id = p_auth_user_id
    and is_active
    and deleted_at is null
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'PLATFORM_MASTER_NO_SOURCE_PROFILE';
  end if;

  begin
    insert into public.members (
      club_id, auth_user_id, name, nickname, grade, member_type,
      player_background, permission_role, is_active
    ) values (
      p_club_id, p_auth_user_id, v_source.name, v_source.nickname,
      v_source.grade, v_source.member_type, v_source.player_background,
      'master', true
    )
    returning id into v_new_id;

    return jsonb_build_object(
      'member_id', v_new_id, 'action', 'created',
      'name', v_source.name, 'nickname', v_source.nickname
    );
  exception
    when unique_violation then
      -- 동시 요청이 먼저 (club_id, auth_user_id) 행을 커밋한 경우 — 그
      -- 행을 다시 읽어 동일한 멱등 로직(승격/no-op)을 한 번 더 적용한다.
      select * into v_member
      from public.members
      where club_id = p_club_id and auth_user_id = p_auth_user_id
      for update;

      if not found then
        raise;
      end if;

      if v_member.deleted_at is not null or not v_member.is_active then
        raise exception 'PLATFORM_MASTER_MEMBER_INACTIVE';
      end if;

      if v_member.permission_role = 'master' then
        return jsonb_build_object(
          'member_id', v_member.id, 'action', 'noop',
          'name', v_member.name, 'nickname', v_member.nickname
        );
      end if;

      update public.members
      set permission_role = 'master'
      where id = v_member.id;

      return jsonb_build_object(
        'member_id', v_member.id, 'action', 'promoted',
        'name', v_member.name, 'nickname', v_member.nickname
      );
  end;
end;
$$;

revoke all on function public._bootstrap_club_master(uuid, uuid)
from public, anon, authenticated, service_role;

-- ============================================================
-- 2) bootstrap_club_master — 이미 존재하는 클럽에 대한 백필용 공개 RPC
-- ============================================================
create function public.bootstrap_club_master(
  p_club_id uuid,
  p_master_auth_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_exists boolean;
begin
  select exists(select 1 from public.clubs where id = p_club_id) into v_club_exists;
  if not v_club_exists then
    raise exception 'PLATFORM_CLUB_NOT_FOUND';
  end if;

  return public._bootstrap_club_master(p_club_id, p_master_auth_user_id);
end;
$$;

revoke all on function public.bootstrap_club_master(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_club_master(uuid, uuid) to service_role;

-- ============================================================
-- 3) create_club_with_master — 신규 클럽 생성 + 최초 master 등록(원자적)
--
--    name/slug 정규화·형식 검증은 route.ts에서도 먼저 하지만(빠른 실패,
--    DB 왕복 없음), 이 RPC도 이벤트 엔진 RPC들과 동일한 관례로 자기
--    입력을 다시 검증한다(호출부를 신뢰하지 않음). reserved slug 목록은
--    제품 정책이라 route.ts에만 두고 여기서 중복하지 않는다. slug 중복은
--    clubs_slug_key unique_violation을 잡아 매핑한다(clubs에는 unique
--    제약이 slug 하나뿐이라 constraint 이름 재확인 없이도 모호하지 않음).
-- ============================================================
create function public.create_club_with_master(
  p_name text,
  p_slug text,
  p_description text,
  p_master_auth_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_slug text;
  v_club_id uuid;
  v_master_result jsonb;
begin
  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'PLATFORM_CLUB_INVALID_NAME';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]+([-_][a-z0-9]+)*$' then
    raise exception 'PLATFORM_CLUB_INVALID_SLUG';
  end if;

  begin
    insert into public.clubs (name, slug, description, status)
    values (v_name, v_slug, p_description, 'active')
    returning id into v_club_id;
  exception
    when unique_violation then
      raise exception 'PLATFORM_CLUB_SLUG_TAKEN';
  end;

  -- 클럽 INSERT와 최초 master 등록을 같은 함수(=같은 트랜잭션) 안에서
  -- 이어서 실행 — 여기서 예외가 나면 위 clubs INSERT까지 전부 롤백된다.
  v_master_result := public._bootstrap_club_master(v_club_id, p_master_auth_user_id);

  return jsonb_build_object(
    'club_id', v_club_id,
    'name', v_name,
    'slug', v_slug,
    'master', v_master_result
  );
end;
$$;

revoke all on function public.create_club_with_master(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_club_with_master(text, text, text, uuid) to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop function if exists public.create_club_with_master(text, text, text, uuid);
-- drop function if exists public.bootstrap_club_master(uuid, uuid);
-- drop function if exists public._bootstrap_club_master(uuid, uuid);
--
-- commit;
