-- ============================================================
-- 0034: get_public_point_history RPC (Phase 2 step 2)
--
-- 목적: Public(canonical point-history 목록, 회원 상세 LP 이력)이 raw
-- point_history 테이블 SELECT 대신 이 RPC로 조회하도록 전환하기 위한
-- 준비 단계. point_history_select_all 정책은 이 migration에서 삭제하지
-- 않는다 — RPC와 raw 쿼리가 당분간 공존하며 diff 검증에 쓰인다.
--
-- 공개 범위 보존:
--   - canonical 목록(p_include_inactive_member=false, 기본값): 기존
--     "/c/[slug]/point-history" 쿼리와 동일하게 club_id 일치 + is_active
--     = true인 회원의 이력만 노출한다.
--   - 회원 상세 위젯(p_include_inactive_member=true, 특정 member_id 지정
--     시에만 유효): 기존 lib/member-activity.ts의 verifyMemberInClub과
--     동일하게 활동 상태와 무관하게 그 회원의 이력을 노출한다.
--   - p_member_id가 null이면 p_include_inactive_member 값과 무관하게
--     항상 활동 회원만 노출된다(조건절에 p_member_id is not null 요구).
--
-- match/session 조인에도 club_id를 함께 검증해, point_history.match_id나
-- matches.session_id가 잘못된 club을 가리켜도 다른 club의 경기 날짜·세션
-- 제목이 결과에 붙지 않도록 방어한다.
-- ============================================================

create or replace function public.get_public_point_history(
  p_club_id uuid,
  p_member_id uuid default null,
  p_include_inactive_member boolean default false
)
returns table (
  id uuid,
  match_id uuid,
  member_id uuid,
  member_name text,
  point_before integer,
  point_after integer,
  point_change integer,
  reason text,
  created_at timestamptz,
  match_played_at date,
  session_day text,
  session_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ph.id,
    ph.match_id,
    ph.member_id,
    m.name,
    ph.point_before,
    ph.point_after,
    ph.point_change,
    ph.reason,
    ph.created_at,
    mt.played_at,
    s.session_day::text,
    s.title
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
on function public.get_public_point_history(uuid, uuid, boolean)
from public;

grant execute
on function public.get_public_point_history(uuid, uuid, boolean)
to anon, authenticated;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- drop function if exists public.get_public_point_history(uuid, uuid, boolean);
