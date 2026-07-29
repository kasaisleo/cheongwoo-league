-- ============================================================
-- 0045: 경기 생성/수정/삭제 원자적 RPC (Match Engine P1 Phase 2B)
--
-- 배경 (Phase 1/2A 조사 결과):
--   - lib/match-engine.ts의 applyMatch/rollbackMatch는 여러 개의 독립된
--     PostgREST 요청(각각 별도 트랜잭션)을 TypeScript 루프로 순차 실행한다.
--     중간에 실패해도 error를 확인하지 않아 침묵 부분 실패가 발생할 수 있고,
--     PUT의 rollback→update→apply, DELETE의 rollback→delete도 원자적이지 않다.
--   - 동시에 같은 회원이 포함된 두 매치를 처리하면 read-then-write 패턴이라
--     lost update가 발생할 수 있다(코드로 확인됨, 이론 아님).
--   - Phase 2A 라이브 정합성 실측 결과 A1~A4 전부 0 rows — 현재 데이터는
--     정상이며 이번 migration은 repair가 아니라 향후 원자성 확보가 목적이다.
--
-- 이번 migration 범위:
--   1) 비공개 helper 함수 3개 (_match_validate_and_lock_participants,
--      _match_apply_effects, _match_undo_effects) — SECURITY DEFINER 아님,
--      EXECUTE는 public/anon/authenticated/service_role 전부 revoke.
--      외부 노출 함수의 소유자(postgres)가 내부에서만 호출한다 — 함수 소유자는
--      자신이 만든 함수에 대해 GRANT/REVOKE와 무관하게 항상 EXECUTE 권한을
--      가지므로, 외부 함수가 SECURITY DEFINER로 owner 권한을 얻은 상태에서
--      helper를 호출하면 revoke와 무관하게 정상 동작한다.
--   2) 외부 노출 함수 3개 (create_match_with_effects, update_match_with_effects,
--      delete_match_with_effects) — SECURITY DEFINER, SET search_path = '',
--      EXECUTE는 service_role에게만 grant.
--
-- 이번 migration이 절대 하지 않는 것:
--   - matches/members/guests/point_history/attendance_sessions/clubs
--     테이블의 기존 GRANT/RLS 정책 변경 (전부 무변경).
--   - lib/match-engine.ts, app/api/matches/*.ts 코드 수정 (전부 무변경 —
--     이번 migration이 Studio에 적용돼도 기존 코드는 여전히 구 TS 경로를 쓴다.
--     함수 존재 자체는 코드 동작에 아무 영향을 주지 않는다).
--   - 실제 데이터 변경 (이 파일에는 DML이 전혀 없다).
--
-- 확정된 설계 결정 (Phase 2B 사용자 승인 완료):
--   [결정 1] create_match_with_effects에만 club.status='active' 검증을 추가했다
--     (update/delete는 matches.id+club_id 소속 검증만 유지 — 비활성 클럽의
--     기존 경기 정정/삭제까지 막지 않는다). 현재 app/api/matches/route.ts
--     POST에는 이 검증이 없다 — 이번 migration이 새로 추가하는 방어 로직이다.
--   [결정 2] undo 시 참가자 행이 사라진 경우 PARTICIPANT_NOT_FOUND로 전체
--     트랜잭션을 실패시킨다 — 기존 TS rollbackMatch의 `if (!member) continue`
--     (조용히 건너뜀)보다 엄격하다.
--   [결정 3] update_match_with_effects는 "old 전체 undo → new 전체 apply"를
--     순차 호출하는 것으로 구현한다(공통 참가자에 대한 net 1회 update 최적화를
--     하지 않음) — 기존 TS의 rollback→apply 순서를 그대로 재현하는 이 방식이
--     정확성 증명이 가장 단순하고, 쓰기 횟수 차이는 단일 트랜잭션 내에서
--     성능상 의미가 없다.
--   [결정 4] 7-6 스코어 타이브레이크 필수 입력 규칙을 app/api/matches/route.ts
--     POST와 app/api/matches/[id]/route.ts PUT에서 그대로(두 라우트가 완전히
--     동일한 로직이었음을 확인 후) 재현했다 — INVALID_TIEBREAK 예외 + 타이브레이크
--     아닌 세트의 tiebreak 값을 null로 clamp(route.ts의
--     `isTiebreakSet ? scoreATiebreak : null`과 동일).
--
-- apply/undo 쓰기 안전성(2B 정적 검수 요청 반영):
--   _match_apply_effects/_match_undo_effects는 "SELECT 현재값 → 계산 → UPDATE"가
--   아니라 `update ... set league_point = league_point + delta ... returning
--   league_point into v_point_after` 형태의 단일 원자적 UPDATE문을 쓴다.
--   point_before는 v_point_after에서 delta를 역산해 구하므로, 별도 SELECT
--   시점과 UPDATE 시점 사이에 값이 바뀔 여지 자체가 없다(오래된 snapshot을
--   덮어쓸 수 있는 코드 경로가 없다). _match_validate_and_lock_participants의
--   FOR UPDATE 잠금은 여전히 필요하다 — 이유는 (a) 존재/club 소속 재검증이고
--   (b) 여러 참가자 행을 여러 UPDATE 문에 걸쳐 건드리는 단일 트랜잭션이 다른
--   동시 트랜잭션과 정해진 순서로 충돌하게 만들어 교착을 막기 위함이며,
--   "이 함수 자신의 SELECT-then-UPDATE 경쟁"을 막기 위한 것이 더 이상 아니다.
--
-- 반환값 최소화(2B 정적 검수 요청 반영):
--   app/api/matches/route.ts POST는 `{ ok: true, matchId: match.id }`만,
--   app/api/matches/[id]/route.ts PUT은 `{ ok: true, matchId: updatedMatch.id }`만
--   반환한다 — 둘 다 club_id/winner_team/8슬롯을 응답에 전혀 쓰지 않는다(grep
--   확인 완료). 효과 적용이 이제 함수 내부로 옮겨졌으므로 route.ts가 매치
--   객체 전체를 돌려받아야 할 이유도 사라졌다. 따라서 create_match_with_effects는
--   `returns uuid`(신규 id)로, update_match_with_effects/delete_match_with_effects는
--   `returns void`(p_match_id를 호출자가 이미 알고 있음)로 최소화했다 — 이전 초안의
--   `returns table(...)` 11개 컬럼 반환은 불필요한 과다 반환이었다.
-- ============================================================

begin;

-- ============================================================
-- 1) 비공개 helper 함수 (SECURITY DEFINER 아님, EXECUTE 전부 revoke)
-- ============================================================

-- 1-1) 참가자 club 재검증 + UUID 오름차순 FOR UPDATE 잠금.
--      member를 먼저, guest를 나중에 잠근다 — 이 순서를 세 외부 함수가
--      항상 동일하게 지켜야 교착(deadlock)을 방지할 수 있다.
create function public._match_validate_and_lock_participants(
  p_club_id uuid,
  p_member_ids uuid[],
  p_guest_ids uuid[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_member_ids uuid[];
  v_guest_ids uuid[];
  v_locked_count integer;
  v_expected_count integer;
begin
  select coalesce(array_agg(distinct x order by x), array[]::uuid[]) into v_member_ids
  from unnest(p_member_ids) as x
  where x is not null;

  select coalesce(array_agg(distinct x order by x), array[]::uuid[]) into v_guest_ids
  from unnest(p_guest_ids) as x
  where x is not null;

  v_expected_count := coalesce(array_length(v_member_ids, 1), 0);
  if v_expected_count > 0 then
    with locked as (
      select members.id
      from public.members
      where members.id = any(v_member_ids)
        and members.club_id = p_club_id
      order by members.id
      for update
    )
    select count(*) into v_locked_count from locked;

    if v_locked_count <> v_expected_count then
      raise exception 'PARTICIPANT_CLUB_MISMATCH: % of % member participants not found in club',
        (v_expected_count - v_locked_count), v_expected_count;
    end if;
  end if;

  v_expected_count := coalesce(array_length(v_guest_ids, 1), 0);
  if v_expected_count > 0 then
    with locked as (
      select guests.id
      from public.guests
      where guests.id = any(v_guest_ids)
        and guests.club_id = p_club_id
      order by guests.id
      for update
    )
    select count(*) into v_locked_count from locked;

    if v_locked_count <> v_expected_count then
      raise exception 'PARTICIPANT_CLUB_MISMATCH: % of % guest participants not found in club',
        (v_expected_count - v_locked_count), v_expected_count;
    end if;
  end if;
end;
$$;

revoke all on function public._match_validate_and_lock_participants(uuid, uuid[], uuid[])
from public, anon, authenticated, service_role;

-- 1-2) 회원/게스트 슬롯에 승리/패배 효과를 적용. member 슬롯만 point_history를
--      남긴다(게스트는 전혀 남기지 않음 — 기존 applyMatch와 동일).
--      호출 전 _match_validate_and_lock_participants로 대상 행이 이미
--      잠겨 있어야 한다 — 여기서는 잠그지 않고 현재 값을 그대로 읽는다.
create function public._match_apply_effects(
  p_club_id uuid,
  p_match_id uuid,
  p_member_ids uuid[],
  p_member_won boolean[],
  p_guest_ids uuid[],
  p_guest_won boolean[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_league_point_win constant integer := 10; -- lib/match-engine.ts LEAGUE_POINT_WIN과 동기화 필수(수동 관리)
  i integer;
  v_member_id uuid;
  v_guest_id uuid;
  v_won boolean;
  v_point_before integer;
  v_point_after integer;
  v_point_change integer;
  v_rows integer;
begin
  if p_member_ids is not null then
    for i in 1 .. coalesce(array_length(p_member_ids, 1), 0) loop
      v_member_id := p_member_ids[i];
      v_won := p_member_won[i];
      v_point_change := case when v_won then v_league_point_win else 0 end;

      -- 원자적 증감: 별도 SELECT 없이 단일 UPDATE의 SET 표현식이 그 UPDATE
      -- 시점의 행 값을 직접 참조하므로, "오래된 snapshot으로 덮어쓰기"가
      -- 구조적으로 불가능하다. point_before는 반환된 point_after에서 delta를
      -- 역산해 구한다(추가 조회 없이 정확).
      update public.members
      set league_point = members.league_point + v_point_change,
          wins = members.wins + (case when v_won then 1 else 0 end),
          losses = members.losses + (case when v_won then 0 else 1 end)
      where members.id = v_member_id and members.club_id = p_club_id
      returning members.league_point into v_point_after;

      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'PARTICIPANT_NOT_FOUND: member participant missing during apply';
      elsif v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: member stats update affected % rows', v_rows;
      end if;

      v_point_before := v_point_after - v_point_change;

      insert into public.point_history (
        match_id, member_id, club_id, point_before, point_after, point_change, reason
      ) values (
        p_match_id, v_member_id, p_club_id, v_point_before, v_point_after, v_point_change,
        case when v_won then 'regular_match_win' else 'regular_match_loss' end
      );

      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: point_history insert affected % rows', v_rows;
      end if;
    end loop;
  end if;

  if p_guest_ids is not null then
    for i in 1 .. coalesce(array_length(p_guest_ids, 1), 0) loop
      v_guest_id := p_guest_ids[i];
      v_won := p_guest_won[i];

      update public.guests
      set wins = guests.wins + (case when v_won then 1 else 0 end),
          losses = guests.losses + (case when v_won then 0 else 1 end)
      where guests.id = v_guest_id and guests.club_id = p_club_id;

      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: guest stats update affected % rows', v_rows;
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public._match_apply_effects(uuid, uuid, uuid[], boolean[], uuid[], boolean[])
from public, anon, authenticated, service_role;

-- 1-3) 회원/게스트 슬롯의 효과를 되돌린다. wins/losses는 0 미만으로 내려가지
--      않는다(Math.max(0, ...)와 동일). point_history rollback 행은 되돌릴
--      point_change가 0이 아닐 때만(과거에 승리였을 때만) 남긴다 — 기존
--      rollbackMatch의 `if (pointChangeToUndo !== 0)`와 동일.
create function public._match_undo_effects(
  p_club_id uuid,
  p_match_id uuid,
  p_member_ids uuid[],
  p_member_won boolean[],
  p_guest_ids uuid[],
  p_guest_won boolean[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_league_point_win constant integer := 10; -- lib/match-engine.ts LEAGUE_POINT_WIN과 동기화 필수(수동 관리)
  i integer;
  v_member_id uuid;
  v_guest_id uuid;
  v_won boolean;
  v_point_before integer;
  v_point_after integer;
  v_point_change integer;
  v_rows integer;
begin
  if p_member_ids is not null then
    for i in 1 .. coalesce(array_length(p_member_ids, 1), 0) loop
      v_member_id := p_member_ids[i];
      v_won := p_member_won[i];
      v_point_change := case when v_won then v_league_point_win else 0 end;

      -- apply와 동일한 이유로 원자적 증감(단일 UPDATE)만 사용한다 — 별도
      -- SELECT가 없으므로 오래된 snapshot을 덮어쓸 코드 경로가 없다.
      update public.members
      set league_point = members.league_point - v_point_change,
          wins = greatest(0, members.wins - (case when v_won then 1 else 0 end)),
          losses = greatest(0, members.losses - (case when v_won then 0 else 1 end))
      where members.id = v_member_id and members.club_id = p_club_id
      returning members.league_point into v_point_after;

      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'PARTICIPANT_NOT_FOUND: member participant missing during undo';
      elsif v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: member stats undo affected % rows', v_rows;
      end if;

      v_point_before := v_point_after + v_point_change;

      if v_point_change <> 0 then
        insert into public.point_history (
          match_id, member_id, club_id, point_before, point_after, point_change, reason
        ) values (
          p_match_id, v_member_id, p_club_id, v_point_before, v_point_after, -v_point_change,
          'regular_match_rollback'
        );

        get diagnostics v_rows = row_count;
        if v_rows <> 1 then
          raise exception 'EFFECT_UPDATE_FAILED: point_history rollback insert affected % rows', v_rows;
        end if;
      end if;
    end loop;
  end if;

  if p_guest_ids is not null then
    for i in 1 .. coalesce(array_length(p_guest_ids, 1), 0) loop
      v_guest_id := p_guest_ids[i];
      v_won := p_guest_won[i];

      update public.guests
      set wins = greatest(0, guests.wins - (case when v_won then 1 else 0 end)),
          losses = greatest(0, guests.losses - (case when v_won then 0 else 1 end))
      where guests.id = v_guest_id and guests.club_id = p_club_id;

      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: guest stats undo affected % rows', v_rows;
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public._match_undo_effects(uuid, uuid, uuid[], boolean[], uuid[], boolean[])
from public, anon, authenticated, service_role;

-- ============================================================
-- 2) 외부 노출 함수 3개 (SECURITY DEFINER, service_role 전용)
-- ============================================================

-- 2-1) 경기 생성 + 효과 적용 (기존 POST의 insert+applyMatch를 대체)
create function public.create_match_with_effects(
  p_club_id uuid,
  p_session_id uuid,
  p_played_at date,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer,
  p_score_b_tiebreak integer,
  p_winner_team text,
  p_team_a_player1_member uuid, p_team_a_player1_guest uuid,
  p_team_a_player2_member uuid, p_team_a_player2_guest uuid,
  p_team_b_player1_member uuid, p_team_b_player1_guest uuid,
  p_team_b_player2_member uuid, p_team_b_player2_guest uuid,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_status text;
  v_member_ids uuid[] := array[]::uuid[];
  v_member_won boolean[] := array[]::boolean[];
  v_guest_ids uuid[] := array[]::uuid[];
  v_guest_won boolean[] := array[]::boolean[];
  v_keys text[];
  v_match_id uuid;
  v_rows integer;
  v_team_a_won boolean;
  v_team_b_won boolean;
  v_is_tiebreak_set boolean;
  v_final_score_a_tiebreak integer;
  v_final_score_b_tiebreak integer;
begin
  -- [결정 1] club 존재 + active 검증 — 현재 TS POST에는 없는 신규 방어 로직.
  perform 1 from public.clubs where clubs.id = p_club_id;
  if not found then
    raise exception 'CLUB_NOT_FOUND: club % does not exist', p_club_id;
  end if;

  perform 1 from public.clubs where clubs.id = p_club_id and clubs.status = 'active';
  if not found then
    raise exception 'CLUB_INACTIVE: club % is not active', p_club_id;
  end if;

  select attendance_sessions.status into v_session_status
  from public.attendance_sessions
  where attendance_sessions.id = p_session_id
    and attendance_sessions.club_id = p_club_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND: session % not found in club', p_session_id;
  end if;
  if v_session_status = 'archived' then
    raise exception 'SESSION_ARCHIVED: session % is archived', p_session_id;
  end if;

  if p_winner_team not in ('A', 'B') then
    raise exception 'INVALID_WINNER_TEAM: % is not A or B', p_winner_team;
  end if;

  if p_score_a is null or p_score_a < 0 or p_score_a > 7
     or p_score_b is null or p_score_b < 0 or p_score_b > 7 then
    raise exception 'INVALID_SCORE: score_a=%, score_b=% out of range', p_score_a, p_score_b;
  end if;

  -- 타이브레이크: app/api/matches/route.ts POST와 정확히 동일한 규칙
  -- (isTiebreakSet = 7-6 또는 6-7), 타이브레이크가 아닌 세트는 tiebreak 값을
  -- 무조건 null로 clamp한다(`isTiebreakSet ? scoreATiebreak : null`과 동일).
  v_is_tiebreak_set := (p_score_a = 7 and p_score_b = 6) or (p_score_a = 6 and p_score_b = 7);
  if v_is_tiebreak_set then
    if p_score_a_tiebreak is null or p_score_a_tiebreak < 0
       or p_score_b_tiebreak is null or p_score_b_tiebreak < 0 then
      raise exception 'INVALID_TIEBREAK: 7-6 score requires non-negative tiebreak scores for both teams';
    end if;
    v_final_score_a_tiebreak := p_score_a_tiebreak;
    v_final_score_b_tiebreak := p_score_b_tiebreak;
  else
    v_final_score_a_tiebreak := null;
    v_final_score_b_tiebreak := null;
  end if;

  if (p_team_a_player1_member is not null) = (p_team_a_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player1 must be exactly one of member/guest';
  end if;
  if (p_team_a_player2_member is not null) = (p_team_a_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player2 must be exactly one of member/guest';
  end if;
  if (p_team_b_player1_member is not null) = (p_team_b_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player1 must be exactly one of member/guest';
  end if;
  if (p_team_b_player2_member is not null) = (p_team_b_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player2 must be exactly one of member/guest';
  end if;

  -- 4명 중복 금지 — matches.chk_no_duplicate_players가 0003에서 삭제된 뒤
  -- (member_id/guest_id 분리 구조로 바뀌며) 재생성되지 않아, 현재 이 함수가
  -- DB 레벨에서 이 규칙을 강제하는 유일한 지점이다.
  v_keys := array[
    coalesce('m:' || p_team_a_player1_member::text, 'g:' || p_team_a_player1_guest::text),
    coalesce('m:' || p_team_a_player2_member::text, 'g:' || p_team_a_player2_guest::text),
    coalesce('m:' || p_team_b_player1_member::text, 'g:' || p_team_b_player1_guest::text),
    coalesce('m:' || p_team_b_player2_member::text, 'g:' || p_team_b_player2_guest::text)
  ];
  if (select count(distinct k) from unnest(v_keys) as k) <> 4 then
    raise exception 'DUPLICATE_PARTICIPANT: 4 slots must be 4 distinct participants';
  end if;

  v_team_a_won := (p_winner_team = 'A');
  v_team_b_won := (p_winner_team = 'B');

  if p_team_a_player1_member is not null then
    v_member_ids := v_member_ids || p_team_a_player1_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || p_team_a_player1_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if p_team_a_player2_member is not null then
    v_member_ids := v_member_ids || p_team_a_player2_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || p_team_a_player2_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if p_team_b_player1_member is not null then
    v_member_ids := v_member_ids || p_team_b_player1_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || p_team_b_player1_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  if p_team_b_player2_member is not null then
    v_member_ids := v_member_ids || p_team_b_player2_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || p_team_b_player2_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  insert into public.matches (
    session_id, club_id, played_at,
    team_a_player1_member, team_a_player1_guest,
    team_a_player2_member, team_a_player2_guest,
    team_b_player1_member, team_b_player1_guest,
    team_b_player2_member, team_b_player2_guest,
    score_a, score_b, score_a_tiebreak, score_b_tiebreak,
    winner_team, created_by
  ) values (
    p_session_id, p_club_id, p_played_at,
    p_team_a_player1_member, p_team_a_player1_guest,
    p_team_a_player2_member, p_team_a_player2_guest,
    p_team_b_player1_member, p_team_b_player1_guest,
    p_team_b_player2_member, p_team_b_player2_guest,
    p_score_a, p_score_b, v_final_score_a_tiebreak, v_final_score_b_tiebreak,
    p_winner_team::public.winner_team_type, p_created_by
  )
  returning matches.id into v_match_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches insert affected % rows', v_rows;
  end if;

  perform public._match_apply_effects(
    p_club_id, v_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );

  return v_match_id;
end;
$$;

revoke all on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

-- 2-2) 경기 수정 + 효과 재계산 (기존 PUT의 rollback→update→apply 3단계를
--      단일 트랜잭션으로 대체)
create function public.update_match_with_effects(
  p_match_id uuid,
  p_club_id uuid,
  p_session_id uuid, -- null이면 기존 session_id 유지 — 현재 PUT의 `sessionId ?? existingMatch.session_id`와 동일 의미
  p_played_at date,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer,
  p_score_b_tiebreak integer,
  p_winner_team text,
  p_team_a_player1_member uuid, p_team_a_player1_guest uuid,
  p_team_a_player2_member uuid, p_team_a_player2_guest uuid,
  p_team_b_player1_member uuid, p_team_b_player1_guest uuid,
  p_team_b_player2_member uuid, p_team_b_player2_guest uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.matches%rowtype;
  v_session_status text;
  v_final_session_id uuid;
  v_keys text[];
  v_rows integer;
  v_is_tiebreak_set boolean;
  v_final_score_a_tiebreak integer;
  v_final_score_b_tiebreak integer;
  v_old_team_a_won boolean;
  v_old_team_b_won boolean;
  v_new_team_a_won boolean;
  v_new_team_b_won boolean;
  v_old_member_ids uuid[] := array[]::uuid[];
  v_old_member_won boolean[] := array[]::boolean[];
  v_old_guest_ids uuid[] := array[]::uuid[];
  v_old_guest_won boolean[] := array[]::boolean[];
  v_new_member_ids uuid[] := array[]::uuid[];
  v_new_member_won boolean[] := array[]::boolean[];
  v_new_guest_ids uuid[] := array[]::uuid[];
  v_new_guest_won boolean[] := array[]::boolean[];
  v_lock_member_ids uuid[];
  v_lock_guest_ids uuid[];
begin
  select * into v_old
  from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND: match % not found in club', p_match_id;
  end if;

  v_final_session_id := coalesce(p_session_id, v_old.session_id);

  if p_session_id is not null then
    select attendance_sessions.status into v_session_status
    from public.attendance_sessions
    where attendance_sessions.id = p_session_id
      and attendance_sessions.club_id = p_club_id
    for update;

    if not found then
      raise exception 'SESSION_NOT_FOUND: session % not found in club', p_session_id;
    end if;
    if v_session_status = 'archived' then
      raise exception 'SESSION_ARCHIVED: session % is archived', p_session_id;
    end if;
  end if;

  if p_winner_team not in ('A', 'B') then
    raise exception 'INVALID_WINNER_TEAM: % is not A or B', p_winner_team;
  end if;

  if p_score_a is null or p_score_a < 0 or p_score_a > 7
     or p_score_b is null or p_score_b < 0 or p_score_b > 7 then
    raise exception 'INVALID_SCORE: score_a=%, score_b=% out of range', p_score_a, p_score_b;
  end if;

  -- 타이브레이크: app/api/matches/[id]/route.ts PUT과 정확히 동일한 규칙
  -- (POST와 완전히 동일한 로직임을 확인 후 재현). 타이브레이크가 아닌 세트는
  -- tiebreak 값을 무조건 null로 clamp한다.
  v_is_tiebreak_set := (p_score_a = 7 and p_score_b = 6) or (p_score_a = 6 and p_score_b = 7);
  if v_is_tiebreak_set then
    if p_score_a_tiebreak is null or p_score_a_tiebreak < 0
       or p_score_b_tiebreak is null or p_score_b_tiebreak < 0 then
      raise exception 'INVALID_TIEBREAK: 7-6 score requires non-negative tiebreak scores for both teams';
    end if;
    v_final_score_a_tiebreak := p_score_a_tiebreak;
    v_final_score_b_tiebreak := p_score_b_tiebreak;
  else
    v_final_score_a_tiebreak := null;
    v_final_score_b_tiebreak := null;
  end if;

  if (p_team_a_player1_member is not null) = (p_team_a_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player1 must be exactly one of member/guest';
  end if;
  if (p_team_a_player2_member is not null) = (p_team_a_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player2 must be exactly one of member/guest';
  end if;
  if (p_team_b_player1_member is not null) = (p_team_b_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player1 must be exactly one of member/guest';
  end if;
  if (p_team_b_player2_member is not null) = (p_team_b_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player2 must be exactly one of member/guest';
  end if;

  v_keys := array[
    coalesce('m:' || p_team_a_player1_member::text, 'g:' || p_team_a_player1_guest::text),
    coalesce('m:' || p_team_a_player2_member::text, 'g:' || p_team_a_player2_guest::text),
    coalesce('m:' || p_team_b_player1_member::text, 'g:' || p_team_b_player1_guest::text),
    coalesce('m:' || p_team_b_player2_member::text, 'g:' || p_team_b_player2_guest::text)
  ];
  if (select count(distinct k) from unnest(v_keys) as k) <> 4 then
    raise exception 'DUPLICATE_PARTICIPANT: 4 slots must be 4 distinct participants';
  end if;

  -- old 참가자 추출 (잠금 전 v_old 스냅샷 기준)
  v_old_team_a_won := (v_old.winner_team::text = 'A');
  v_old_team_b_won := (v_old.winner_team::text = 'B');

  if v_old.team_a_player1_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_a_player1_member;
    v_old_member_won := v_old_member_won || v_old_team_a_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_a_player1_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_a_won;
  end if;

  if v_old.team_a_player2_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_a_player2_member;
    v_old_member_won := v_old_member_won || v_old_team_a_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_a_player2_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_a_won;
  end if;

  if v_old.team_b_player1_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_b_player1_member;
    v_old_member_won := v_old_member_won || v_old_team_b_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_b_player1_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_b_won;
  end if;

  if v_old.team_b_player2_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_b_player2_member;
    v_old_member_won := v_old_member_won || v_old_team_b_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_b_player2_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_b_won;
  end if;

  -- new 참가자 추출 (파라미터 기준)
  v_new_team_a_won := (p_winner_team = 'A');
  v_new_team_b_won := (p_winner_team = 'B');

  if p_team_a_player1_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_a_player1_member;
    v_new_member_won := v_new_member_won || v_new_team_a_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_a_player1_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_a_won;
  end if;

  if p_team_a_player2_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_a_player2_member;
    v_new_member_won := v_new_member_won || v_new_team_a_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_a_player2_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_a_won;
  end if;

  if p_team_b_player1_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_b_player1_member;
    v_new_member_won := v_new_member_won || v_new_team_b_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_b_player1_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_b_won;
  end if;

  if p_team_b_player2_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_b_player2_member;
    v_new_member_won := v_new_member_won || v_new_team_b_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_b_player2_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_b_won;
  end if;

  -- old ∪ new 전체를 한 번에 잠금 (helper 내부에서 중복 제거 + 정렬)
  v_lock_member_ids := v_old_member_ids || v_new_member_ids;
  v_lock_guest_ids := v_old_guest_ids || v_new_guest_ids;
  perform public._match_validate_and_lock_participants(p_club_id, v_lock_member_ids, v_lock_guest_ids);

  update public.matches set
    session_id = v_final_session_id,
    played_at = p_played_at,
    team_a_player1_member = p_team_a_player1_member, team_a_player1_guest = p_team_a_player1_guest,
    team_a_player2_member = p_team_a_player2_member, team_a_player2_guest = p_team_a_player2_guest,
    team_b_player1_member = p_team_b_player1_member, team_b_player1_guest = p_team_b_player1_guest,
    team_b_player2_member = p_team_b_player2_member, team_b_player2_guest = p_team_b_player2_guest,
    score_a = p_score_a, score_b = p_score_b,
    score_a_tiebreak = v_final_score_a_tiebreak, score_b_tiebreak = v_final_score_b_tiebreak,
    winner_team = p_winner_team::public.winner_team_type
  where matches.id = p_match_id and matches.club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches update affected % rows', v_rows;
  end if;

  -- old 전체 undo → new 전체 apply 순서로 호출 (기존 PUT의 rollback→apply 순서 재현).
  -- 공통 참가자는 undo 1회 + apply 1회가 순차 실행되어 point_history에 기존과
  -- 동일하게 rollback행 + apply행 2건이 남고, members/guests는 undo 결과 위에
  -- apply가 누적되어 최종 net 값이 정확히 맞는다(설계 검수 표 참고).
  perform public._match_undo_effects(
    p_club_id, p_match_id, v_old_member_ids, v_old_member_won, v_old_guest_ids, v_old_guest_won
  );
  perform public._match_apply_effects(
    p_club_id, p_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
  );
end;
$$;

revoke all on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

-- 2-3) 경기 삭제 + 효과 되돌리기 (기존 DELETE의 rollback→delete를 단일
--      트랜잭션으로 대체). matches.match_id는 on delete set null이므로,
--      아래에서 남기는 rollback point_history 행도(방금 삽입한 행 포함)
--      matches delete 시점에 함께 match_id가 null로 바뀐다 — 이는 기존
--      (비원자적) TS 구현에서도 이미 동일하게 일어나던 부수효과이며, 이번
--      migration이 새로 만드는 동작이 아니다.
create function public.delete_match_with_effects(
  p_match_id uuid,
  p_club_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.matches%rowtype;
  v_rows integer;
  v_team_a_won boolean;
  v_team_b_won boolean;
  v_member_ids uuid[] := array[]::uuid[];
  v_member_won boolean[] := array[]::boolean[];
  v_guest_ids uuid[] := array[]::uuid[];
  v_guest_won boolean[] := array[]::boolean[];
begin
  select * into v_old
  from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND: match % not found in club', p_match_id;
  end if;

  v_team_a_won := (v_old.winner_team::text = 'A');
  v_team_b_won := (v_old.winner_team::text = 'B');

  if v_old.team_a_player1_member is not null then
    v_member_ids := v_member_ids || v_old.team_a_player1_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_a_player1_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if v_old.team_a_player2_member is not null then
    v_member_ids := v_member_ids || v_old.team_a_player2_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_a_player2_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if v_old.team_b_player1_member is not null then
    v_member_ids := v_member_ids || v_old.team_b_player1_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_b_player1_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  if v_old.team_b_player2_member is not null then
    v_member_ids := v_member_ids || v_old.team_b_player2_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_b_player2_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  perform public._match_undo_effects(
    p_club_id, p_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );

  delete from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches delete affected % rows', v_rows;
  end if;
end;
$$;

revoke all on function public.delete_match_with_effects(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.delete_match_with_effects(uuid, uuid)
to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행 — 코드가 아직 이 함수들을 호출하지
-- 않는 한 완전히 안전하다)
-- ============================================================
-- drop function if exists public.create_match_with_effects(
--   uuid, uuid, date, integer, integer, integer, integer, text,
--   uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
-- );
-- drop function if exists public.update_match_with_effects(
--   uuid, uuid, uuid, date, integer, integer, integer, integer, text,
--   uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
-- );
-- drop function if exists public.delete_match_with_effects(uuid, uuid);
-- drop function if exists public._match_undo_effects(uuid, uuid, uuid[], boolean[], uuid[], boolean[]);
-- drop function if exists public._match_apply_effects(uuid, uuid, uuid[], boolean[], uuid[], boolean[]);
-- drop function if exists public._match_validate_and_lock_participants(uuid, uuid[], uuid[]);
