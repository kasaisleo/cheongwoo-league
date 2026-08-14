-- ============================================================
-- 0067: 무승부를 포함한 통계 정의 통일 (Phase 2A-8D-4)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 0064~0066으로 5:5 무승부(winner_team='D')가 Production에 존재하게 됐지만,
-- 통계 정의는 여전히 승패만 센다. 그 결과 1승 1패 1무인 회원이 "경기수 2 /
-- 승률 50%"로 표시되고, 무승부만 치른 회원은 집계에서 사라진다.
--
-- win_rate는 TypeScript가 아니라 DB RPC에 하드코딩돼 있고
-- (lib/ranking-query.ts가 DB에서 win_rate로 정렬한다), 화면마다 다시
-- 계산하면 정의가 갈라진다. 그래서 DB 정의를 단일 진실로 통일한다.
--
-- ------------------------------------------------------------
-- 확정 정책
-- ------------------------------------------------------------
--   draws         = winner_team='D'인 참여 Match 수
--   total_matches = wins + losses + draws
--   win_rate      = wins / total_matches * 100   (total_matches = 0 이면 0)
--
-- · 참여 판정은 회원 4슬롯(team_*_player*_member) / 게스트 4슬롯을 본다.
-- · 한 Match에 같은 참가자가 여러 슬롯에 있는 비정상 데이터가 있어도
--   count(distinct match id)로 Match당 최대 1무만 센다.
-- · legacy Match와 Event-linked Match를 모두 포함한다(event_game_id 무관).
-- · 모든 집계는 club_id로 scope한다.
--
-- ------------------------------------------------------------
-- 이 파일이 바꾸는 것 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] get_public_member_list       0036 기준 재정의 + drop/create + re-grant
--   [2] get_public_member_detail     0036 기준 재정의 + drop/create + re-grant
--   [3] get_public_guest_list        0038 기준 재정의 + drop/create + re-grant
--
-- ★ member_stats 뷰는 건드리지 않는다 (2A-8D-4B).
--   Production 뷰는 27컬럼이고 저장소에 없는 score_diff 집계를 포함한다.
--   저장소 migration을 재생한 DB는 22컬럼이라 컬럼 이름·순서가 다르다.
--   CREATE OR REPLACE VIEW는 "기존 컬럼 이름·순서·타입 동일 + 끝에만 추가"만
--   허용하므로, 두 환경에서 동시에 성립하는 정의를 만들 수 없다.
--   member_stats는 0037로 anon/authenticated 접근이 회수돼 있고 코드의 실제
--   조회(.from("member_stats"))가 0건이므로, 공개 RPC 3개만 draw-aware로
--   바꿔도 사용자 화면 정합은 100% 달성된다.
--   스키마 드리프트 정리는 별도 Phase로 분리한다.
--
-- RPC 3개는 returns table에 컬럼을 추가하므로 반환 타입이 바뀐다.
-- create or replace로는 반환 타입을 바꿀 수 없어 drop 후 create하고,
-- 0036/0038의 revoke/grant를 그대로 다시 발급한다.
--
-- 세 함수 본문은 손으로 재작성하지 않았다. 최신 정의를 프로그램으로 추출해
-- win_rate 분모 교체와 draws/total_matches 추가만 기계적으로 적용했다.
--
-- 건드리지 않는 것:
--   member_stats 뷰 (OID·정의·컬럼·owner·ACL 전부 불변)
--   members.wins / members.losses / guests.wins / guests.losses 값
--   matches 데이터 (조회만 한다 — DML 0건)
--   draws 컬럼 추가 없음 (matches에서 파생한다)
--   guest_stats 뷰 (0039에서 drop되어 존재하지 않음)
--   LP 계산·point_history·CHECK constraint·draw helper·legacy write 계약
--   migration 0064 / 0065 / 0066
-- ============================================================

begin;



-- ============================================================
-- [1] get_public_member_list — 0036 기준 재정의
-- ============================================================
-- 반환 타입이 바뀌므로 drop 후 create한다. ACL은 아래에서 다시 발급한다.
drop function if exists public.get_public_member_list(uuid);

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
  score_diff numeric,
  draws integer,
  total_matches integer
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
  ),
  draw_agg as (
    -- 2A-8D-4: winner_team='D'인 참여 Match 수.
    -- 한 Match에 같은 회원이 여러 슬롯에 들어간 비정상 데이터가 있어도
    -- count(distinct mt.id)로 Match당 최대 1무만 센다.
    -- club scope는 mt.club_id = p_club_id로 강제한다.
    select u.member_id, count(distinct mt.id) as draws
    from public.matches mt
    cross join unnest(array[
      mt.team_a_player1_member, mt.team_a_player2_member,
      mt.team_b_player1_member, mt.team_b_player2_member
    ]) as u(member_id)
    where mt.club_id = p_club_id
      and mt.winner_team = 'D'
      and u.member_id is not null
    group by u.member_id
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
    -- 2A-8D-4: 분모에 무승부를 포함한다. total_matches = wins + losses + draws.
    case when (m.wins + m.losses + coalesce(dr.draws, 0)) = 0 then 0
         else round((m.wins::numeric / (m.wins + m.losses + coalesce(dr.draws, 0))) * 100, 1)
    end as win_rate,
    coalesce(sd.score_diff, 0) as score_diff,
    coalesce(dr.draws, 0)::integer as draws,
    (m.wins + m.losses + coalesce(dr.draws, 0))::integer as total_matches
  from public.members m
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  left join score_diff_agg sd
    on sd.member_id = m.id
   and sd.club_id = m.club_id
  left join draw_agg dr
    on dr.member_id = m.id
  where m.club_id = p_club_id
    and m.is_active = true
    and m.deleted_at is null;
$$;


-- ============================================================
-- [2] get_public_member_detail — 0036 기준 재정의
-- ============================================================
drop function if exists public.get_public_member_detail(uuid, uuid);

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
  score_diff numeric,
  draws integer,
  total_matches integer
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
  ),
  draw_agg as (
    -- 2A-8D-4: winner_team='D'인 참여 Match 수.
    -- 한 Match에 같은 회원이 여러 슬롯에 들어간 비정상 데이터가 있어도
    -- count(distinct mt.id)로 Match당 최대 1무만 센다.
    -- club scope는 mt.club_id = p_club_id로 강제한다.
    select u.member_id, count(distinct mt.id) as draws
    from public.matches mt
    cross join unnest(array[
      mt.team_a_player1_member, mt.team_a_player2_member,
      mt.team_b_player1_member, mt.team_b_player2_member
    ]) as u(member_id)
    where mt.club_id = p_club_id
      and mt.winner_team = 'D'
      and u.member_id is not null
    group by u.member_id
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
    -- 2A-8D-4: 분모에 무승부를 포함한다. total_matches = wins + losses + draws.
    case when (m.wins + m.losses + coalesce(dr.draws, 0)) = 0 then 0
         else round((m.wins::numeric / (m.wins + m.losses + coalesce(dr.draws, 0))) * 100, 1)
    end as win_rate,
    coalesce(sd.score_diff, 0) as score_diff,
    coalesce(dr.draws, 0)::integer as draws,
    (m.wins + m.losses + coalesce(dr.draws, 0))::integer as total_matches
  from public.members m
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  left join score_diff_agg sd
    on sd.member_id = m.id
   and sd.club_id = m.club_id
  left join draw_agg dr
    on dr.member_id = m.id
  where m.id = p_member_id
    and m.club_id = p_club_id
    and m.is_active = true
    and m.deleted_at is null;
$$;


-- ============================================================
-- [3] get_public_guest_list — 0038 기준 재정의
-- ============================================================
drop function if exists public.get_public_guest_list(uuid);

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
  is_converted boolean,
  draws integer,
  total_matches integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with draw_agg as (
    -- 2A-8D-4: 게스트의 winner_team='D' 참여 Match 수. 회원과 동일한 계약이며
    -- 게스트 슬롯 4개를 본다. count(distinct)로 Match당 최대 1무.
    select u.guest_id, count(distinct mt.id) as draws
    from public.matches mt
    cross join unnest(array[
      mt.team_a_player1_guest, mt.team_a_player2_guest,
      mt.team_b_player1_guest, mt.team_b_player2_guest
    ]) as u(guest_id)
    where mt.club_id = p_club_id
      and mt.winner_team = 'D'
      and u.guest_id is not null
    group by u.guest_id
  )
  select
    g.id,
    g.name,
    g.visit_date,
    g.wins,
    g.losses,
    -- 2A-8D-4: 분모에 무승부를 포함한다.
    case when (g.wins + g.losses + coalesce(dr.draws, 0)) = 0 then 0
         else round((g.wins::numeric / (g.wins + g.losses + coalesce(dr.draws, 0))) * 100, 1)
    end as win_rate,
    g.is_active,
    (g.converted_to_member_id is not null) as is_converted,
    coalesce(dr.draws, 0)::integer as draws,
    (g.wins + g.losses + coalesce(dr.draws, 0))::integer as total_matches
  from public.guests g
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  left join draw_agg dr
    on dr.guest_id = g.id
  where g.club_id = p_club_id
    and g.is_active = true;
$$;


-- ============================================================
-- [4] ACL 재발급 — 0036 / 0038과 동일하게 유지한다.
-- ============================================================
revoke all on function public.get_public_member_list(uuid) from public;
grant execute on function public.get_public_member_list(uuid) to anon, authenticated;

revoke all on function public.get_public_member_detail(uuid, uuid) from public;
grant execute on function public.get_public_member_detail(uuid, uuid) to anon, authenticated;

revoke all on function public.get_public_guest_list(uuid) from public;
grant execute on function public.get_public_guest_list(uuid) to anon, authenticated;


-- ============================================================
-- [5] 검증 — 정의가 실제로 바뀌었는지 catalog로 확인한다.
-- ============================================================
do $verify$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_public_member_list','get_public_member_detail','get_public_guest_list')
    and p.prosrc like '%coalesce(dr.draws, 0)%';
  if v_count <> 3 then
    raise exception 'STATS_REDEFINE_FAILED: % of 3 RPCs have the draw-aware definition', v_count;
  end if;

  -- anon/authenticated EXECUTE가 되살아났는지 (drop이 ACL을 지웠으므로 필수)
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_public_member_list','get_public_member_detail','get_public_guest_list')
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_count <> 3 then
    raise exception 'STATS_REDEFINE_FAILED: % of 3 RPCs granted to anon/authenticated', v_count;
  end if;
end
$verify$;

-- PostgREST 스키마 캐시 갱신 — RPC 반환 시그니처가 바뀌었으므로 필수.
notify pgrst, 'reload schema';

commit;
