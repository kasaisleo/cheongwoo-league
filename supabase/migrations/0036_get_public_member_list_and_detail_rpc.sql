-- ============================================================
-- 0036: get_public_member_list / get_public_member_detail RPC
-- (members P0 대응 Phase 1)
--
-- members_select_all 정책, member_stats 뷰 권한은 이 migration에서
-- 건드리지 않는다.
--
-- score_diff는 UNION ALL 방식으로 라이브 member_stats 정의를 그대로
-- 복제한다 — 한 회원이 한 경기의 여러 슬롯에 중복 등록된 비정상 데이터가
-- 있어도 라이브 뷰와 동일한 결과가 나오도록, CASE 단일 표현식이 아니라
-- 슬롯별 4개 쿼리를 UNION ALL한 뒤 member_id로 SUM한다.
-- 경기/세션 상태 필터는 원본에 없으므로 추가하지 않는다.
--
-- 두 함수는 서로를 호출하지 않고 각각 명시적으로 SQL을 갖는다 — 목록/상세
-- projection이 다르고, 목록 projection이 늘어나도 상세에 자동 전파되지
-- 않도록 하기 위함.
--
-- 휴면(is_dormant) 회원은 기존 /c/[slug]/members 화면이 목록에 항상
-- 포함시키고 클라이언트 필터로만 활동/휴면을 나누므로, 목록 RPC는
-- is_dormant를 필터링하지 않고 컬럼으로 반환한다. 상세 RPC는 휴면 회원을
-- 그대로 허용하되 is_dormant 컬럼 자체는 반환하지 않는다(목록/상세
-- projection 차이는 의도된 것).
-- ============================================================

create or replace function public.get_public_member_list(
  p_club_id uuid
)
returns table (
  id uuid,
  name text,
  nickname text,
  wins integer,
  losses integer,
  league_point integer,
  member_type public.member_type,
  role public.member_role,
  mapo_score integer,
  player_background text,
  is_dormant boolean,
  win_rate numeric,
  score_diff numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with score_diff_agg as (
    select member_id, p_club_id as club_id, sum(diff) as score_diff
    from (
      select team_a_player1_member as member_id, score_a - score_b as diff
        from public.matches
       where club_id = p_club_id and team_a_player1_member is not null
      union all
      select team_a_player2_member as member_id, score_a - score_b as diff
        from public.matches
       where club_id = p_club_id and team_a_player2_member is not null
      union all
      select team_b_player1_member as member_id, score_b - score_a as diff
        from public.matches
       where club_id = p_club_id and team_b_player1_member is not null
      union all
      select team_b_player2_member as member_id, score_b - score_a as diff
        from public.matches
       where club_id = p_club_id and team_b_player2_member is not null
    ) slots
    group by member_id
  )
  select
    m.id,
    m.name,
    m.nickname,
    m.wins,
    m.losses,
    m.league_point,
    m.member_type,
    m.role,
    m.mapo_score,
    m.player_background,
    m.is_dormant,
    case when (m.wins + m.losses) = 0 then 0
         else round((m.wins::numeric / (m.wins + m.losses)) * 100, 1)
    end as win_rate,
    coalesce(sd.score_diff, 0) as score_diff
  from public.members m
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  left join score_diff_agg sd
    on sd.member_id = m.id
   and sd.club_id = m.club_id
  where m.club_id = p_club_id
    and m.is_active = true
    and m.deleted_at is null;
$$;

create or replace function public.get_public_member_detail(
  p_club_id uuid,
  p_member_id uuid
)
returns table (
  id uuid,
  name text,
  nickname text,
  wins integer,
  losses integer,
  league_point integer,
  member_type public.member_type,
  role public.member_role,
  mapo_score integer,
  player_background text,
  win_rate numeric,
  score_diff numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with score_diff_agg as (
    select member_id, p_club_id as club_id, sum(diff) as score_diff
    from (
      select team_a_player1_member as member_id, score_a - score_b as diff
        from public.matches
       where club_id = p_club_id and team_a_player1_member is not null
      union all
      select team_a_player2_member as member_id, score_a - score_b as diff
        from public.matches
       where club_id = p_club_id and team_a_player2_member is not null
      union all
      select team_b_player1_member as member_id, score_b - score_a as diff
        from public.matches
       where club_id = p_club_id and team_b_player1_member is not null
      union all
      select team_b_player2_member as member_id, score_b - score_a as diff
        from public.matches
       where club_id = p_club_id and team_b_player2_member is not null
    ) slots
    group by member_id
  )
  select
    m.id,
    m.name,
    m.nickname,
    m.wins,
    m.losses,
    m.league_point,
    m.member_type,
    m.role,
    m.mapo_score,
    m.player_background,
    case when (m.wins + m.losses) = 0 then 0
         else round((m.wins::numeric / (m.wins + m.losses)) * 100, 1)
    end as win_rate,
    coalesce(sd.score_diff, 0) as score_diff
  from public.members m
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  left join score_diff_agg sd
    on sd.member_id = m.id
   and sd.club_id = m.club_id
  where m.id = p_member_id
    and m.club_id = p_club_id
    and m.is_active = true
    and m.deleted_at is null;
$$;

revoke all on function public.get_public_member_list(uuid) from public;
grant execute on function public.get_public_member_list(uuid) to anon, authenticated;

revoke all on function public.get_public_member_detail(uuid, uuid) from public;
grant execute on function public.get_public_member_detail(uuid, uuid) to anon, authenticated;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- drop function if exists public.get_public_member_detail(uuid, uuid);
-- drop function if exists public.get_public_member_list(uuid);
