-- ============================================================
-- 0065: Event 복식 Game의 5:5 무승부 결과 (Phase 2A-8D-2)
--
-- ⚠️ 선행 조건 — 0064가 "먼저 커밋된 뒤에만" 이 파일을 실행할 수 있다.
--    이 파일은 CHECK constraint와 함수 본문에서 winner_team_type의 'D'를
--    직접 사용한다. Postgres는 ALTER TYPE ... ADD VALUE로 추가한 enum 값을
--    같은 트랜잭션 안에서 쓰지 못하므로, 0064(enum 추가 전용, BEGIN/COMMIT
--    없음)를 먼저 적용해 커밋해야 한다. 순서를 지키지 않으면
--      unsafe use of new value "D" of enum type winner_team_type
--    로 실패하고 이 파일 전체가 롤백된다.
--
-- ------------------------------------------------------------
-- 확정 정책 (2A-8D)
-- ------------------------------------------------------------
-- · 정확히 5:5인 Event 복식 Game만 무승부다. winner_team = 'D'.
-- · 회원 선수 4명 각각 league_point +5. wins/losses는 변하지 않는다.
-- · 게스트는 승/패도 포인트도 변하지 않는다(무승부는 게스트에게 무영향).
-- · members/guests에 draws 컬럼을 추가하지 않는다 — 통산 무승부 수가 필요해지면
--   matches(winner_team='D')에서 파생한다. wins+losses를 경기 수로 쓰는 기존
--   17개 소비자의 의미를 흔들지 않기 위한 선택이다.
-- · Game status는 completed, completed_at도 기존과 같은 규칙으로 설정된다.
--   따라서 Event 완료 조건(0062)에서 무승부 Game도 completed로 인정된다.
-- · 5:5에는 타이브레이크를 쓸 수 없다.
-- · legacy Match 경로(create/update/delete_match_with_effects)는 건드리지
--   않는다 — 그 입력 UI는 승자 선택이 필수라 'D'를 만들 수 없다.
--
-- ------------------------------------------------------------
-- 이 파일이 바꾸는 것
-- ------------------------------------------------------------
--   [스키마] matches에 CHECK 2개 추가 (컬럼·인덱스 변경 없음)
--            · chk_match_outcome_consistent — NOT VALID (2A-8D-3A)
--            · chk_draw_no_tiebreak         — VALID (위반 행 없음)
--   [함수]   _event_game_result_score   0059 기준 재정의
--            _match_apply_draw_effects  신규 private helper
--            _match_undo_draw_effects   신규 private helper
--            save_event_game_result     0062 기준 재정의  ★ 0059가 아님
--            clear_event_game_result    0062 기준 재정의  ★ 0059가 아님
--
--   건드리지 않는 것: _match_apply_effects / _match_undo_effects /
--   _match_validate_and_lock_participants (0045),
--   _event_game_result_effect_arrays (0059),
--   create_match_with_effects (0046), update/delete_match_with_effects (0059),
--   reorder_event_games (0060), ensure_event_game_count (0061),
--   update_event / update_event_slot_mode (0063).
--
-- save/clear 본문은 손으로 재작성하지 않았다. 0062 정의를 프로그램으로 추출해
-- draw 분기만 기계적으로 삽입하고, 원본과 줄 단위 multiset으로 대조해
-- "삭제·변형된 코드 줄 0건"을 검증했다. 그래서 0062의 completed lifecycle
-- 계약(최초 저장 차단 / 정정 허용 / 초기화 차단 / cancelled 차단)이 그대로다.
--
-- backfill 없음. 기존 위반 행 1건의 정합화와
-- chk_match_outcome_consistent의 VALIDATE는 0066이 담당한다.
-- chk_draw_no_tiebreak은 위반 행이 없으므로 여기서 VALID로 걸린다.
-- 그 외 기존 Match 행은 이 파일을 막지 않는다(단일 트랜잭션).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- [1] 결과 outcome CHECK
-- ------------------------------------------------------------
-- "5:5 ⇔ D" 만으로는 4:4 + winner='A' 같은 조합이 통과한다. 그래서 허용 조합을
-- 양쪽에서 전부 열거한다:
--   · 5:5 이고 winner_team = 'D'
--   · 점수가 다르고 winner_team in ('A','B')
-- 이로써 아래가 전부 DB에서 거부된다:
--   0:0·1:1·2:2·3:3·4:4·6:6·7:7 (모든 비-5:5 동점)
--   5:5 + winner A/B
--   비동점 + winner D
--
-- ★ A/B "방향"(높은 점수 팀이 실제 winner인지)까지는 강제하지 않는다.
--   기존 Match 9건의 방향 정합성을 Production에서 아직 검증하지 않았고,
--   여기서 새로 강제하면 기존 데이터가 이 migration을 막을 수 있다.
--   승자 계산은 기존대로 _event_game_result_score가 담당한다.
--
-- ★★ 2A-8D-3A: NOT VALID로 건다.
--   Production 조사에서 기존 legacy Match 1건
--   (81f3bc20-a104-4864-89dd-b642d1d3f36d, cheongwoo, score 5:5, winner_team='B')
--   이 이 CHECK를 위반하는 것이 확인되었다. legacy 경로(API·RPC 양쪽)에 동점
--   거부 검증이 전혀 없어 만들어진 행이다. VALID로 걸면 기존 행 검증 때문에
--   이 migration 전체가 실패한다.
--   NOT VALID는 "기존 행 검증만" 생략하고 이후 INSERT/UPDATE에는 즉시 적용되므로,
--   신규 데이터에 대한 방어력은 VALID와 동일하다.
--   0066이 그 1건을 무승부로 정합화한 뒤 같은 트랜잭션에서
--   VALIDATE CONSTRAINT로 승격한다.
alter table public.matches
  add constraint chk_match_outcome_consistent check (
    (score_a = 5 and score_b = 5 and winner_team = 'D')
    or
    (score_a <> score_b and winner_team in ('A', 'B'))
  ) not valid;

-- ------------------------------------------------------------
-- [2] 무승부 타이브레이크 금지 CHECK
-- ------------------------------------------------------------
-- 승패 결과의 타이브레이크 계약(7-6/6-7에서만 사용)은 그대로 두고,
-- 무승부에만 "양쪽 모두 null" 을 강제한다.
alter table public.matches
  add constraint chk_draw_no_tiebreak check (
    winner_team <> 'D'
    or (score_a_tiebreak is null and score_b_tiebreak is null)
  );


-- ============================================================
-- _match_apply_draw_effects — 무승부 효과 적용 (신규 private helper)
-- ============================================================
-- 0045의 _match_apply_effects는 p_member_won boolean[] 2값 모델이라 "승도 패도
-- 아님"을 표현할 수 없다. 그 함수를 3값으로 바꾸면 legacy Match 경로 3개가
-- 함께 흔들리므로, Event 결과 경로 전용 helper를 따로 둔다.
--
-- 계약
--   · 회원 각각 league_point += 5, wins/losses는 건드리지 않는다.
--   · point_history 1행 (point_change = +5, reason 'regular_match_draw').
--   · 게스트는 아무 것도 하지 않는다 — guests에는 league_point가 없고
--     무승부는 승/패를 늘리지 않으므로 남길 persistent effect가 없다.
--   · 같은 member id가 중복으로 들어와도 1회만 반영한다(distinct).
--   · club scope를 강제하고, 대상이 그 club 회원이 아니면 예외로 중단한다.
--   · 잠금은 호출자(save/clear)가 _match_validate_and_lock_participants로
--     이미 잡아 두었다 — 여기서 다시 잠그지 않는다(잠금 순서 재사용).
create function public._match_apply_draw_effects(
  p_club_id uuid,
  p_match_id uuid,
  p_member_ids uuid[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  -- 무승부 포인트. 승리 10점(_match_apply_effects의 v_league_point_win)과 같은
  -- 방식으로 DB에 상수로 둔다. JS 쪽 계산에는 쓰이지 않으므로 중복 상수를
  -- 만들지 않는다.
  v_league_point_draw constant integer := 5;
  v_ids uuid[];
  v_rows integer;
begin
  v_ids := array(select distinct x from unnest(coalesce(p_member_ids, array[]::uuid[])) as x where x is not null);

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  -- club 경계 검증 — 다른 club 회원이 섞이면 중단한다.
  if (select count(*) from public.members m
      where m.id = any(v_ids) and m.club_id = p_club_id) <> array_length(v_ids, 1) then
    raise exception 'PARTICIPANT_CLUB_MISMATCH: member not in club';
  end if;

  -- set-based UPDATE 1회 + point_history INSERT 1회.
  with upd as (
    update public.members m
    set league_point = m.league_point + v_league_point_draw
    where m.id = any(v_ids) and m.club_id = p_club_id
    returning m.id, m.league_point as point_after
  )
  insert into public.point_history (
    match_id, member_id, club_id, point_before, point_after, point_change, reason
  )
  select p_match_id, upd.id, p_club_id,
         upd.point_after - v_league_point_draw, upd.point_after, v_league_point_draw,
         'regular_match_draw'
  from upd;

  get diagnostics v_rows = row_count;
  if v_rows <> array_length(v_ids, 1) then
    raise exception 'EFFECT_UPDATE_FAILED: draw apply affected % rows (expected %)',
      v_rows, array_length(v_ids, 1);
  end if;
end;
$$;

revoke all on function public._match_apply_draw_effects(uuid, uuid, uuid[])
from public, anon, authenticated, service_role;


-- ============================================================
-- _match_undo_draw_effects — 무승부 효과 되돌리기 (신규 private helper)
-- ============================================================
-- apply의 정확한 역연산이다. league_point -= 5, wins/losses는 그대로.
-- point_history는 append-only이므로 지우지 않고 -5 rollback 행을 남긴다
-- (0045 _match_undo_effects와 같은 reason 'regular_match_rollback' 재사용).
create function public._match_undo_draw_effects(
  p_club_id uuid,
  p_match_id uuid,
  p_member_ids uuid[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_league_point_draw constant integer := 5;
  v_ids uuid[];
  v_rows integer;
begin
  v_ids := array(select distinct x from unnest(coalesce(p_member_ids, array[]::uuid[])) as x where x is not null);

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  if (select count(*) from public.members m
      where m.id = any(v_ids) and m.club_id = p_club_id) <> array_length(v_ids, 1) then
    raise exception 'PARTICIPANT_CLUB_MISMATCH: member not in club';
  end if;

  with upd as (
    update public.members m
    set league_point = m.league_point - v_league_point_draw
    where m.id = any(v_ids) and m.club_id = p_club_id
    returning m.id, m.league_point as point_after
  )
  insert into public.point_history (
    match_id, member_id, club_id, point_before, point_after, point_change, reason
  )
  select p_match_id, upd.id, p_club_id,
         upd.point_after + v_league_point_draw, upd.point_after, -v_league_point_draw,
         'regular_match_rollback'
  from upd;

  get diagnostics v_rows = row_count;
  if v_rows <> array_length(v_ids, 1) then
    raise exception 'EFFECT_UPDATE_FAILED: draw undo affected % rows (expected %)',
      v_rows, array_length(v_ids, 1);
  end if;
end;
$$;

revoke all on function public._match_undo_draw_effects(uuid, uuid, uuid[])
from public, anon, authenticated, service_role;


-- ============================================================
-- _event_game_result_score  (원본: 0059)
-- ============================================================
create or replace function public._event_game_result_score(
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer,
  p_score_b_tiebreak integer
) returns table(
  score_a_tiebreak integer,
  score_b_tiebreak integer,
  winner_team text
)
language plpgsql
set search_path = ''
as $$
declare
  v_is_tiebreak_set boolean;
begin
  if p_score_a is null or p_score_a < 0 or p_score_a > 7
     or p_score_b is null or p_score_b < 0 or p_score_b > 7 then
    raise exception 'INVALID_SCORE: score_a=%, score_b=% out of range', p_score_a, p_score_b;
  end if;

  -- ★ 2A-8D: 동점 중 정확히 5:5만 무승부로 허용한다.
  -- 0:0·1:1·2:2·3:3·4:4·6:6·7:7 등 그 밖의 동점은 기존대로 거부한다.
  if p_score_a = 5 and p_score_b = 5 then
    -- 무승부에는 타이브레이크가 없다. 조용히 버리지 않고 명시적으로 거부해
    -- 입력이 무시됐다는 오해가 생기지 않게 한다(DB CHECK가 최종 방어선).
    if p_score_a_tiebreak is not null or p_score_b_tiebreak is not null then
      raise exception 'EVENT_GAME_RESULT_DRAW_TIEBREAK_NOT_ALLOWED';
    end if;
    score_a_tiebreak := null;
    score_b_tiebreak := null;
    winner_team := 'D';
    return next;
    return;
  end if;

  if p_score_a = p_score_b then
    raise exception 'EVENT_GAME_RESULT_TIE_NOT_ALLOWED';
  end if;

  v_is_tiebreak_set := (p_score_a = 7 and p_score_b = 6) or (p_score_a = 6 and p_score_b = 7);

  if v_is_tiebreak_set then
    if p_score_a_tiebreak is null or p_score_a_tiebreak < 0
       or p_score_b_tiebreak is null or p_score_b_tiebreak < 0 then
      raise exception 'INVALID_TIEBREAK: 7-6 score requires non-negative tiebreak scores for both teams';
    end if;
    score_a_tiebreak := p_score_a_tiebreak;
    score_b_tiebreak := p_score_b_tiebreak;
  else
    score_a_tiebreak := null;
    score_b_tiebreak := null;
  end if;

  winner_team := case when p_score_a > p_score_b then 'A' else 'B' end;
  return next;
end;
$$;

revoke all on function public._event_game_result_score(integer, integer, integer, integer)
from public, anon, authenticated, service_role;


-- ============================================================
-- save_event_game_result  (원본: 0062)
-- ============================================================
create or replace function public.save_event_game_result(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_team_a_slot1_participant_id uuid,
  p_team_a_slot2_participant_id uuid,
  p_team_b_slot1_participant_id uuid,
  p_team_b_slot2_participant_id uuid,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer default null,
  p_score_b_tiebreak integer default null,
  p_actor_member_id uuid default null
) returns table(
  event_game_id uuid,
  match_id uuid,
  result_action text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_event_date date;
  v_game public.event_games%rowtype;
  v_match public.matches%rowtype;
  v_has_match boolean := false;

  v_req_participants uuid[];
  v_req_teams text[] := array['A', 'A', 'B', 'B'];
  v_req_slots integer[] := array[1, 2, 1, 2];

  v_member uuid[] := array[null, null, null, null]::uuid[];
  v_guest uuid[] := array[null, null, null, null]::uuid[];

  v_existing_participants uuid[];
  v_participant public.event_participants%rowtype;
  i integer;

  v_tb_a integer;
  v_tb_b integer;
  v_winner text;

  v_old_member_ids uuid[] := array[]::uuid[];
  v_old_member_won boolean[] := array[]::boolean[];
  v_old_guest_ids uuid[] := array[]::uuid[];
  v_old_guest_won boolean[] := array[]::boolean[];
  v_new_member_ids uuid[];
  v_new_member_won boolean[];
  v_new_guest_ids uuid[];
  v_new_guest_won boolean[];

  v_match_same boolean := false;
  v_game_same boolean := false;
  v_rows integer;
  v_action text;
  v_match_id uuid;
begin
  -- ----------------------------------------------------------
  -- [1] 잠금 순서 1단계 — Event row.
  --     같은 Event에 대한 상태 전환(update_event)과 결과 저장이 여기서
  --     먼저 직렬화된다.
  -- ----------------------------------------------------------
  select status, event_date into v_event_status, v_event_date
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  -- completed Event는 잠그지 않는다(2A-7B-2B) — cancelled만 terminal.
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  -- ----------------------------------------------------------
  -- [2] 잠금 순서 2단계 — Event Game row.
  --     같은 Game에 대한 두 저장 요청은 이 잠금에서 직렬화된다.
  -- ----------------------------------------------------------
  select * into v_game
  from public.event_games
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_GAME_NOT_FOUND';
  end if;
  if v_game.status = 'cancelled' then
    raise exception 'EVENT_GAME_CANCELLED_NO_RESULT';
  end if;
  if v_game.format <> 'doubles' then
    raise exception 'EVENT_GAME_RESULT_FORMAT_UNSUPPORTED: only doubles results can be saved';
  end if;

  -- ----------------------------------------------------------
  -- [3] 요청 선수 기본 검증 — 4명 필수 + 중복 금지.
  -- ----------------------------------------------------------
  v_req_participants := array[
    p_team_a_slot1_participant_id,
    p_team_a_slot2_participant_id,
    p_team_b_slot1_participant_id,
    p_team_b_slot2_participant_id
  ];

  if exists (select 1 from unnest(v_req_participants) as x where x is null) then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: 4 participants are required';
  end if;
  if (select count(distinct x) from unnest(v_req_participants) as x) <> 4 then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: duplicate participant';
  end if;

  -- ----------------------------------------------------------
  -- [4] 잠금 순서 3단계 — linked Match row.
  -- ----------------------------------------------------------
  select * into v_match
  from public.matches
  where matches.event_game_id = p_game_id and matches.club_id = p_club_id
  for update;
  v_has_match := found;

  -- ★ 2A-8B-3B: completed Event에서는 "기존 결과 정정"만 허용한다.
  -- 최초 결과 입력은 구조 변경과 같은 취급으로 차단한다. 정정으로 인정하는
  -- 조건은 두 가지 모두 충족일 때뿐이다:
  --   · 대상 Game status = 'completed'
  --   · 연결된 matches row가 정확히 1건 (0057 matches_event_game_uniq가
  --     event_game_id 유일성을 보장하므로 v_has_match=true는 곧 1건이다)
  -- 이 시점은 어떤 DML보다도 앞이므로 차단 시 데이터가 바뀌지 않는다.
  -- draft/active Event의 최초 저장·수정 동작은 그대로다.
  if v_event_status = 'completed' then
    if v_game.status <> 'completed' or not v_has_match then
      raise exception 'EVENT_RESULT_FIRST_SAVE_LOCKED: event is completed';
    end if;
  end if;

  -- ----------------------------------------------------------
  -- [5] 잠금 순서 4단계 — 기존 Game player rows + 요청 participant rows.
  --     participant id 오름차순으로 잠근다(deterministic lock order).
  -- ----------------------------------------------------------
  select coalesce(array_agg(event_participant_id order by event_participant_id), array[]::uuid[])
    into v_existing_participants
  from public.event_game_players
  where event_game_players.event_game_id = p_game_id
    and event_game_players.event_id = p_event_id
    and event_game_players.club_id = p_club_id;

  perform 1
  from public.event_participants
  where id = any(v_existing_participants || v_req_participants)
    and event_id = p_event_id
    and club_id = p_club_id
  order by id
  for update;

  -- ----------------------------------------------------------
  -- [6] 요청 participant → member/guest identity 변환.
  --     is_active는 "새로 들어오는" participant에만 요구한다.
  -- ----------------------------------------------------------
  for i in 1 .. 4 loop
    select * into v_participant
    from public.event_participants
    where id = v_req_participants[i] and event_id = p_event_id and club_id = p_club_id;

    if not found then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: participant not in this event';
    end if;

    if not (v_req_participants[i] = any(v_existing_participants)) and not v_participant.is_active then
      raise exception 'EVENT_GAME_PARTICIPANT_UNAVAILABLE: participant not active/in-club';
    end if;

    -- event_participants_member_xor_guest_check(0052)가 정확히 한쪽만 채워짐을
    -- 이미 보장하므로 그대로 옮긴다 — 가짜 member나 임의 이름을 만들지 않는다.
    v_member[i] := v_participant.member_id;
    v_guest[i] := v_participant.guest_id;
  end loop;

  -- ----------------------------------------------------------
  -- [7] 점수 검증 + 승자 계산 (기존 Match 엔진 계약 재사용).
  -- ----------------------------------------------------------
  select s.score_a_tiebreak, s.score_b_tiebreak, s.winner_team
    into v_tb_a, v_tb_b, v_winner
  from public._event_game_result_score(p_score_a, p_score_b, p_score_a_tiebreak, p_score_b_tiebreak) as s;

  -- ----------------------------------------------------------
  -- [8] canonical 비교 — Match 결과가 같은지 / Game 상태까지 같은지.
  -- ----------------------------------------------------------
  if v_has_match then
    v_match_same :=
      v_match.team_a_player1_member is not distinct from v_member[1]
      and v_match.team_a_player1_guest is not distinct from v_guest[1]
      and v_match.team_a_player2_member is not distinct from v_member[2]
      and v_match.team_a_player2_guest is not distinct from v_guest[2]
      and v_match.team_b_player1_member is not distinct from v_member[3]
      and v_match.team_b_player1_guest is not distinct from v_guest[3]
      and v_match.team_b_player2_member is not distinct from v_member[4]
      and v_match.team_b_player2_guest is not distinct from v_guest[4]
      and v_match.score_a is not distinct from p_score_a
      and v_match.score_b is not distinct from p_score_b
      and v_match.score_a_tiebreak is not distinct from v_tb_a
      and v_match.score_b_tiebreak is not distinct from v_tb_b
      and v_match.winner_team::text is not distinct from v_winner;

    v_game_same :=
      v_game.status = 'completed'
      and v_game.completed_at is not null
      and not exists (
        select 1
        from unnest(v_req_participants, v_req_teams, v_req_slots) as r(pid, team, slot)
        full join (
          select event_participant_id as pid, team, slot
          from public.event_game_players
          where event_game_players.event_game_id = p_game_id
        ) as cur on cur.pid = r.pid and cur.team = r.team and cur.slot = r.slot
        where r.pid is null or cur.pid is null
      );

    if v_match_same and v_game_same then
      -- 완전 동일한 재요청 — 효과를 다시 적용하지 않는다.
      event_game_id := p_game_id;
      match_id := v_match.id;
      result_action := 'unchanged';
      return next;
      return;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- [9] 효과 대상 배열 계산 (기존/신규).
  -- ----------------------------------------------------------
  -- ★ 2A-8D: 무승부는 승/패 구분이 없으므로 _event_game_result_effect_arrays를
  -- 호출하지 않는다(그 함수는 'D'를 받으면 전원을 패배로 분류한다). 대신 잠금과
  -- +5 적용 대상이 될 id만 슬롯에서 직접 모은다. member_won/guest_won은 draw
  -- helper가 쓰지 않으므로 채우지 않는다.
  if v_winner = 'D' then
    v_new_member_ids := array(select x from unnest(v_member) as x where x is not null);
    v_new_guest_ids := array(select x from unnest(v_guest) as x where x is not null);
  else
  select e.member_ids, e.member_won, e.guest_ids, e.guest_won
    into v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
  from public._event_game_result_effect_arrays(
    v_winner,
    v_member[1], v_guest[1], v_member[2], v_guest[2],
    v_member[3], v_guest[3], v_member[4], v_guest[4]
  ) as e;
  end if;

  if v_has_match and not v_match_same then
    -- ★ 2A-8D: 기존 결과가 무승부였다면 undo 대상도 승/패가 아니다.
    if v_match.winner_team::text = 'D' then
      v_old_member_ids := array(select x from unnest(array[
        v_match.team_a_player1_member, v_match.team_a_player2_member,
        v_match.team_b_player1_member, v_match.team_b_player2_member
      ]) as x where x is not null);
      v_old_guest_ids := array(select x from unnest(array[
        v_match.team_a_player1_guest, v_match.team_a_player2_guest,
        v_match.team_b_player1_guest, v_match.team_b_player2_guest
      ]) as x where x is not null);
    else
    select e.member_ids, e.member_won, e.guest_ids, e.guest_won
      into v_old_member_ids, v_old_member_won, v_old_guest_ids, v_old_guest_won
    from public._event_game_result_effect_arrays(
      v_match.winner_team::text,
      v_match.team_a_player1_member, v_match.team_a_player1_guest,
      v_match.team_a_player2_member, v_match.team_a_player2_guest,
      v_match.team_b_player1_member, v_match.team_b_player1_guest,
      v_match.team_b_player2_member, v_match.team_b_player2_guest
    ) as e;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- [10] 잠금 순서 5단계 — 효과 대상 members/guests.
  --      기존 + 신규를 한 번에 잠근다. 두 번 나눠 호출하면 서로 다른
  --      트랜잭션이 반대 순서로 잠글 수 있어 교착이 생긴다.
  --      _match_validate_and_lock_participants가 내부에서 id 오름차순으로
  --      정렬해 잠그므로 여기서 순서를 다시 맞출 필요는 없다.
  -- ----------------------------------------------------------
  perform public._match_validate_and_lock_participants(
    p_club_id,
    v_old_member_ids || v_new_member_ids,
    v_old_guest_ids || v_new_guest_ids
  );

  -- ----------------------------------------------------------
  -- [11] Match 생성 또는 수정 + 효과 교체.
  -- ----------------------------------------------------------
  if not v_has_match then
    insert into public.matches (
      club_id, session_id, played_at,
      score_a, score_b, score_a_tiebreak, score_b_tiebreak, winner_team,
      team_a_player1_member, team_a_player1_guest,
      team_a_player2_member, team_a_player2_guest,
      team_b_player1_member, team_b_player1_guest,
      team_b_player2_member, team_b_player2_guest,
      created_by, event_game_id
    ) values (
      p_club_id, null, v_event_date,
      p_score_a, p_score_b, v_tb_a, v_tb_b, v_winner::public.winner_team_type,
      v_member[1], v_guest[1], v_member[2], v_guest[2],
      v_member[3], v_guest[3], v_member[4], v_guest[4],
      p_actor_member_id, p_game_id
    )
    returning id into v_match_id;

    -- session_id는 null이다 — Event 유래 경기는 출석 세션에 속하지 않고
    -- 출처는 event_game_id가 대신한다(matches.session_id는 nullable).
    -- idempotency_key도 null이다 — 이 경로의 재시도 방어는 Game row 잠금과
    -- canonical 비교, 그리고 0057 matches_event_game_uniq가 담당한다.

    -- ★ 2A-8D: 무승부는 전용 helper로 +5만 적용한다(승/패 증감 없음).
    if v_winner = 'D' then
      perform public._match_apply_draw_effects(p_club_id, v_match_id, v_new_member_ids);
    else
    perform public._match_apply_effects(
      p_club_id, v_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
    );
    end if;

    v_action := 'created';
  else
    v_match_id := v_match.id;

    if not v_match_same then
      -- ★ 2A-8D: 기존 결과가 무승부면 -5로 되돌린다.
      if v_match.winner_team::text = 'D' then
        perform public._match_undo_draw_effects(p_club_id, v_match_id, v_old_member_ids);
      else
      perform public._match_undo_effects(
        p_club_id, v_match_id, v_old_member_ids, v_old_member_won, v_old_guest_ids, v_old_guest_won
      );
      end if;

      update public.matches set
        played_at = v_event_date,
        score_a = p_score_a,
        score_b = p_score_b,
        score_a_tiebreak = v_tb_a,
        score_b_tiebreak = v_tb_b,
        winner_team = v_winner::public.winner_team_type,
        team_a_player1_member = v_member[1], team_a_player1_guest = v_guest[1],
        team_a_player2_member = v_member[2], team_a_player2_guest = v_guest[2],
        team_b_player1_member = v_member[3], team_b_player1_guest = v_guest[3],
        team_b_player2_member = v_member[4], team_b_player2_guest = v_guest[4]
      where id = v_match_id and club_id = p_club_id;

      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'EFFECT_UPDATE_FAILED: matches update affected % rows', v_rows;
      end if;

      -- ★ 2A-8D: 신규 결과가 무승부면 +5만 적용한다.
      if v_winner = 'D' then
        perform public._match_apply_draw_effects(p_club_id, v_match_id, v_new_member_ids);
      else
      perform public._match_apply_effects(
        p_club_id, v_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
      );
      end if;
    end if;

    -- Match 결과가 같고 Game 상태만 어긋난 경우에는 여기까지 오되 효과는
    -- 건드리지 않는다 — 아래 [12]에서 Game만 동기화하고 'updated'로 반환한다.
    v_action := 'updated';
  end if;

  -- ----------------------------------------------------------
  -- [12] Game 선수 구성 동기화 + status/completed_at.
  --      court / session / position / Event 상태 / 다른 Game /
  --      확정 타임스탬프는 건드리지 않는다.
  -- ----------------------------------------------------------
  delete from public.event_game_players
  where event_game_players.event_game_id = p_game_id
    and event_game_players.event_id = p_event_id
    and event_game_players.club_id = p_club_id;

  insert into public.event_game_players (event_game_id, event_id, club_id, event_participant_id, team, slot)
  select p_game_id, p_event_id, p_club_id, r.pid, r.team, r.slot
  from unnest(v_req_participants, v_req_teams, v_req_slots) as r(pid, team, slot);

  update public.event_games set
    status = 'completed',
    -- 최초 완료에만 now()를 찍는다. 단순 점수 정정 때마다 완료 시각을 덮어쓰지
    -- 않는다. 기존 데이터가 completed인데 completed_at만 null인 불일치는 이때
    -- 채워진다(coalesce).
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: event_games update affected % rows', v_rows;
  end if;

  event_game_id := p_game_id;
  match_id := v_match_id;
  result_action := v_action;
  return next;
end;
$$;

revoke all on function public.save_event_game_result(uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid)
from public, anon, authenticated;
grant execute on function public.save_event_game_result(uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid)
to service_role;


-- ============================================================
-- clear_event_game_result  (원본: 0062)
-- ============================================================
create or replace function public.clear_event_game_result(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid
) returns table(
  event_game_id uuid,
  cleared_match_id uuid,
  result_action text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_game public.event_games%rowtype;
  v_match public.matches%rowtype;
  v_member_ids uuid[];
  v_member_won boolean[];
  v_guest_ids uuid[];
  v_guest_won boolean[];
  v_rows integer;
  v_match_id uuid;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  -- cancelled Event는 기존대로 차단.
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  -- ★ 2A-8B-3B: completed Event는 linked Match 존재 여부와 무관하게
  -- 초기화를 차단한다(Game·Match를 조회하기도 전에 막는다). 되돌리려면
  -- Event를 active로 재활성화해야 한다. active/draft 계약은 그대로다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_RESULT_CLEAR_LOCKED: event is completed';
  end if;

  select * into v_game
  from public.event_games
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_GAME_NOT_FOUND';
  end if;
  if v_game.status = 'cancelled' then
    raise exception 'EVENT_GAME_CANCELLED_NO_RESULT';
  end if;

  select * into v_match
  from public.matches
  where matches.event_game_id = p_game_id and matches.club_id = p_club_id
  for update;

  if not found then
    -- linked Match가 없는데 Game에 결과 흔적이 남아 있으면 조용히 지우지
    -- 않는다 — 이미 반영된 포인트의 출처를 확인할 수 없는 상태이므로,
    -- 정상 결과처럼 초기화하면 포인트가 되돌려지지 않은 채 흔적만 사라진다.
    if v_game.status <> 'draft' or v_game.completed_at is not null then
      raise exception 'EVENT_GAME_RESULT_INCONSISTENT';
    end if;

    event_game_id := p_game_id;
    cleared_match_id := null;
    result_action := 'unchanged';
    return next;
    return;
  end if;

  v_match_id := v_match.id;

  -- ★ 2A-8D: 무승부 Match는 승/패 배열이 없다 — 되돌릴 id만 모은다.
  if v_match.winner_team::text = 'D' then
    v_member_ids := array(select x from unnest(array[
      v_match.team_a_player1_member, v_match.team_a_player2_member,
      v_match.team_b_player1_member, v_match.team_b_player2_member
    ]) as x where x is not null);
    v_guest_ids := array(select x from unnest(array[
      v_match.team_a_player1_guest, v_match.team_a_player2_guest,
      v_match.team_b_player1_guest, v_match.team_b_player2_guest
    ]) as x where x is not null);
  else
  select e.member_ids, e.member_won, e.guest_ids, e.guest_won
    into v_member_ids, v_member_won, v_guest_ids, v_guest_won
  from public._event_game_result_effect_arrays(
    v_match.winner_team::text,
    v_match.team_a_player1_member, v_match.team_a_player1_guest,
    v_match.team_a_player2_member, v_match.team_a_player2_guest,
    v_match.team_b_player1_member, v_match.team_b_player1_guest,
    v_match.team_b_player2_member, v_match.team_b_player2_guest
  ) as e;
  end if;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  -- ★ 2A-8D: 무승부는 -5로 되돌린다(승/패는 원래 건드리지 않았다).
  if v_match.winner_team::text = 'D' then
    perform public._match_undo_draw_effects(p_club_id, v_match_id, v_member_ids);
  else
  perform public._match_undo_effects(
    p_club_id, v_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );
  end if;

  delete from public.matches where id = v_match_id and club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches delete affected % rows', v_rows;
  end if;

  update public.event_games set
    status = 'draft',
    completed_at = null,
    updated_at = now()
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: event_games update affected % rows', v_rows;
  end if;

  event_game_id := p_game_id;
  cleared_match_id := v_match_id;
  result_action := 'cleared';
  return next;
end;
$$;

revoke all on function public.clear_event_game_result(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.clear_event_game_result(uuid, uuid, uuid)
to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
-- 1) winner_team = 'D' 인 matches 행이 0건인지 먼저 확인한다.
--    남아 있으면 아래 CHECK 제거만으로는 데이터가 계약과 어긋난 채 남는다.
-- 2) alter table public.matches drop constraint chk_match_outcome_consistent;
--    alter table public.matches drop constraint chk_draw_no_tiebreak;
-- 3) 0059의 _event_game_result_score, 0062의 save_event_game_result /
--    clear_event_game_result를 그대로 다시 실행한다
--    (0062는 이미 create or replace 형태, 0059는 create function이므로
--     create or replace로 바꿔 실행해야 한다).
-- 4) drop function public._match_apply_draw_effects(uuid, uuid, uuid[]);
--    drop function public._match_undo_draw_effects(uuid, uuid, uuid[]);
--
-- 0064의 enum 값 'D'는 Postgres가 삭제를 지원하지 않아 남는다. 위 4단계를
-- 마치면 'D'를 만드는 경로가 사라지므로 값이 남아 있어도 계약은 깨지지 않는다.
