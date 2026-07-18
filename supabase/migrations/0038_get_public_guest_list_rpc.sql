-- ============================================================
-- 0038: get_public_guest_list RPC (guests P0 Phase 2)
--
-- guests_select_all 정책, guests/guest_stats 테이블/뷰 권한은 이 migration에서
-- 건드리지 않는다 — Phase 4(ACL 차단)에서 별도 처리.
--
-- Public 게스트 목록(/c/[slug]/guest)이 필요로 하는 최소 컬럼만 반환한다.
-- phone/notes/referred_by/age/years_playing/skill_grade/manner_score/
-- reinvite/created_at/club_id와 converted_to_member_id(uuid 자체),
-- 소개자·전환회원 닉네임은 절대 반환하지 않는다.
--
-- 기존 Public GuestList(components/guest/GuestList.tsx, mode="public")가
-- is_active = true 조건으로만 필터링하던 동작을 그대로 보존한다.
-- win_rate 계산식은 guest_stats 뷰(0003_match_guests_tiebreak.sql) 정의를
-- 그대로 복제한다.
-- ============================================================

create or replace function public.get_public_guest_list(
  p_club_id uuid
)
returns table (
  id uuid,
  name text,
  visit_date date,
  wins integer,
  losses integer,
  win_rate numeric,
  is_active boolean,
  is_converted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    g.visit_date,
    g.wins,
    g.losses,
    case when (g.wins + g.losses) = 0 then 0
         else round((g.wins::numeric / (g.wins + g.losses)) * 100, 1)
    end as win_rate,
    g.is_active,
    (g.converted_to_member_id is not null) as is_converted
  from public.guests g
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  where g.club_id = p_club_id
    and g.is_active = true;
$$;

revoke all on function public.get_public_guest_list(uuid) from public;
grant execute on function public.get_public_guest_list(uuid) to anon, authenticated;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- drop function if exists public.get_public_guest_list(uuid);
