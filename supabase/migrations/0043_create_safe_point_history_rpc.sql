-- ============================================================
-- 0043: get_public_point_history_v2 — raw UUID를 반환하지 않는 안전한 RPC
-- (point_history P0 Phase 2)
--
-- 배경: 기존 get_public_point_history(0034)는 club/member 스코프는 안전하게
-- 강제하지만, 응답 컬럼에 id/match_id/member_id를 raw UUID로 그대로 포함한다.
-- 현재 UI 코드는 이를 화면에 렌더링하지 않지만, RPC를 직접 호출하는 외부
-- 클라이언트라면 응답 JSON에서 그대로 확인할 수 있어 Public payload 노출로
-- 판단한다.
--
-- 이번 migration 범위:
--   1) get_public_point_history_v2 신규 생성 — id/match_id/member_id/club_id
--      raw UUID를 전혀 반환하지 않는다. 같은 경기 그룹화가 필요한 회원 상세
--      화면을 위해 club_id+match_id 해시 기반 비가역 토큰(match_group_token)만
--      제공한다.
--   2) 기존 get_public_point_history(v1)는 그대로 유지한다 — EXECUTE revoke나
--      함수 삭제는 이번 migration에 포함하지 않는다(별도 최종 잠금 단계).
--   3) point_history 테이블 자체의 GRANT/정책도 이번 migration에서 건드리지
--      않는다(soft lock 상태 그대로 유지, 별도 후속 migration에서 revoke).
--
-- pgcrypto 의존성:
--   match_group_token은 pgcrypto의 digest()로 SHA-256 해시를 생성한다.
--   Supabase 프로젝트는 통상 pgcrypto를 `extensions` 스키마에 설치하므로
--   아래에서는 extensions.digest(...)로 스키마 한정 호출한다. 만약 이 프로젝트의
--   pgcrypto가 다른 스키마(예: public)에 설치되어 있다면, 아래 "digest 호출부"
--   주석을 참고해 스키마 한정자를 수정한 뒤 실행할 것.
--
--   실행 전 반드시 아래로 먼저 확인:
--     select extname, extnamespace::regnamespace as schema, extversion
--     from pg_extension where extname = 'pgcrypto';
--
--   pgcrypto가 설치돼 있지 않다면 이 migration은 아래 do 블록에서 즉시
--   실패한다(빈 함수나 임시 대체 해시 로직을 임의로 만들지 않음) — 그 경우
--   먼저 pgcrypto 활성화 여부를 별도로 검토해야 한다.
-- ============================================================

begin;

-- 0) pgcrypto 사전 확인 — 없으면 여기서 즉시 실패시켜, 깨진 함수가
--    만들어지지 않도록 한다.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'pgcrypto extension is not installed — enable it before running this migration, or report an alternative hashing approach';
  end if;
end $$;

-- 1) get_public_point_history_v2
create or replace function public.get_public_point_history_v2(
  p_club_id uuid,
  p_member_id uuid default null,
  p_include_inactive_member boolean default false
)
returns table (
  member_name text,
  point_before integer,
  point_after integer,
  point_change integer,
  reason text,
  created_at timestamptz,
  match_played_at date,
  session_day text,
  session_title text,
  match_group_token text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.name,
    ph.point_before,
    ph.point_after,
    ph.point_change,
    ph.reason,
    ph.created_at,
    mt.played_at,
    s.session_day::text,
    s.title,
    -- digest 호출부: pgcrypto가 public 스키마에 설치돼 있다면
    -- extensions.digest를 public.digest로 바꿀 것.
    -- club_id를 해시 입력에 포함해 서로 다른 club의 동일 match_id가
    -- 같은 토큰을 만들지 않도록 한다. match_id가 null이면 토큰도 null.
    case
      when ph.match_id is null then null
      else substr(
        encode(
          extensions.digest(p_club_id::text || ':' || ph.match_id::text, 'sha256'),
          'hex'
        ),
        1, 32
      )
    end as match_group_token
  from public.point_history ph
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  join public.members m
    on m.id = ph.member_id
   and m.club_id = p_club_id
   and (
     m.is_active = true
     or (
       p_include_inactive_member = true
       and p_member_id is not null
       and m.id = p_member_id
     )
   )
  left join public.matches mt
    on mt.id = ph.match_id
   and mt.club_id = p_club_id
  left join public.attendance_sessions s
    on s.id = mt.session_id
   and s.club_id = p_club_id
  where ph.club_id = p_club_id
    and (p_member_id is null or ph.member_id = p_member_id)
  order by ph.created_at desc
  limit 200;
$$;

revoke all
on function public.get_public_point_history_v2(uuid, uuid, boolean)
from public;

grant execute
on function public.get_public_point_history_v2(uuid, uuid, boolean)
to anon, authenticated;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- drop function if exists public.get_public_point_history_v2(uuid, uuid, boolean);
