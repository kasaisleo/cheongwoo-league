-- ============================================================
-- 0059: Event Game 결과 저장·수정·초기화 (Match System 2.0 — Phase 2A-7B-2C)
--
-- 확정된 아키텍처(2A-7A/7B-1/7B-2B)
--   event_games           = Event 대진·배치·진행 상태의 source of truth
--   matches               = 확정된 점수·승패·기록 반영의 source of truth
--   matches.event_game_id = 두 도메인의 1:1 연결 (0057)
--
-- 이 migration이 만드는 공개 RPC 2개
--   save_event_game_result   최초 결과 저장 + 기존 결과 수정 + 선수 구성 수정
--   clear_event_game_result  Match 효과 undo + linked Match 삭제 + 결과 초기화
--
-- 두 RPC 모두 다음 네 가지를 단일 트랜잭션 안에서 일관되게 유지한다.
--   Event Game  <->  Event Game Players  <->  linked Match  <->  Match 포인트·전적 효과
--
-- ------------------------------------------------------------
-- 운영 정책 (2A-7B-2B에서 확정된 Game 중심 구조를 그대로 따른다)
-- ------------------------------------------------------------
-- · 다른 Game의 상태와 무관하게 개별 Game 결과를 저장할 수 있다.
-- · participants_confirmed_at / scheduling_confirmed_at을 읽지도 검사하지도
--   않는다. Event 전체 스케줄 확정도 필요 없다.
-- · completed Event에서도 저장·수정·초기화가 가능하다. cancelled Event는 불가.
-- · cancelled Game에는 결과를 저장할 수 없다.
-- · 최초 저장과 재저장을 같은 RPC가 처리한다.
-- · 결과가 바뀌면 기존 Match 효과를 정확히 undo한 뒤 새 효과를 apply한다.
-- · 같은 canonical 요청의 재시도는 포인트·전적을 중복 반영하지 않는다.
-- · Game 하나당 linked Match는 최대 1개(0057 matches_event_game_uniq).
-- · 결과 초기화 후 Game은 draft로 돌아가 일반 Game 구조 RPC로 다시 수정된다.
--
-- ------------------------------------------------------------
-- 구현 전 확인한 실제 계약과 그로부터 나온 설계 결정
-- ------------------------------------------------------------
-- (a) Match가 Event participant를 표현할 수 있는가 — 가능하다.
--     event_participants는 member_id / guest_id를 XOR로 보장하고
--     (event_participants_member_xor_guest_check, 0052), matches는 슬롯마다
--     member/guest 쌍을 갖는다(0003). participant의 member_id/guest_id를 그대로
--     대응 슬롯에 옮기면 되므로 가짜 member나 임의 이름, nullable 우회가
--     필요 없다. 게스트 전적도 _match_apply_effects가 guests.wins/losses로
--     정상 반영한다(포인트는 회원만).
--
-- (b) event_games에는 점수·승자 컬럼이 없다(0054 정의 + 0057 이후 컬럼 실측).
--     확정된 아키텍처가 "결과를 양쪽에 중복 저장하지 않는다"이므로 이번
--     migration도 event_games에 점수 컬럼을 추가하지 않는다. 따라서
--     "Game 점수 저장/초기화"는 linked Match의 생성·수정·삭제로 달성되고,
--     Game 쪽에서 동기화하는 것은 status와 completed_at 두 개뿐이다.
--     같은 이유로 결과 초기화의 no-op 판정도 "linked Match 없음 +
--     status='draft' + completed_at is null"로 표현한다.
--
-- (c) 점수 인자에 타이브레이크를 포함했다. 기존 Match 엔진의 점수 계약을
--     재사용하라는 요구를 그대로 따르면 7-6/6-7 스코어는 양쪽 타이브레이크가
--     필수인데(0045/0046 INVALID_TIEBREAK), 타이브레이크 인자가 없으면 7-6
--     경기를 아예 저장할 수 없기 때문이다. 두 인자는 default null이며 7-6이
--     아닌 스코어에서는 legacy와 동일하게 null로 정규화된다.
--
-- (d) 승자는 점수에서 계산한다(2A-7B-2B 확정 정책 8). legacy는 winner_team을
--     호출자가 넘기고 점수와의 정합성을 검사하지 않지만, 계산 방식을 쓰는
--     이상 동점은 승자를 정할 수 없으므로 Event 경로에서만 동점을 거부한다.
--     legacy 함수의 점수 규칙 자체는 회귀 위험 때문에 수정하지 않는다.
--
-- (e) legacy update_match_with_effects / delete_match_with_effects에는
--     event_game_id 방어가 전혀 없었다(0045/0046에 해당 문자열 0건 — 0057보다
--     먼저 작성된 함수들이다). 그대로 두면 Event Game 결과를 legacy 경로로
--     수정·삭제해 Game과 Match가 어긋난다. 아래에서 두 함수를 재정의해
--     EVENT_GAME_MATCH_MANAGED_SEPARATELY로 차단한다. 정적 확인 결과
--     애플리케이션에는 matches를 직접 update/delete하는 경로가 없고
--     (from("matches") 21곳 전부 select), 쓰기는 전부 이 RPC들을 경유한다.
--     event_game_id가 null인 일반 legacy 경기의 동작은 바뀌지 않는다.
--
-- (f) singles는 결과를 저장할 수 없다. matches의 XOR CHECK 4종(0003)이 player2
--     슬롯을 비울 수 없게 만들기 때문이다. 명시적으로 거부한다.
--
-- ------------------------------------------------------------
-- 잠금 순서 (2A-7B-2B에서 확정한 순서를 그대로 따른다)
-- ------------------------------------------------------------
--   1. events                (id, club_id)            FOR UPDATE
--   2. event_games           (id, event_id, club_id)  FOR UPDATE
--   3. matches               (event_game_id, club_id) FOR UPDATE
--   4. event_participants    기존 배정 + 요청 선수, id 오름차순 FOR UPDATE
--   5. members / guests      _match_validate_and_lock_participants가 id
--                            오름차순으로 잠근다 — 기존 효과 대상과 신규 효과
--                            대상을 한 번에 넘겨 두 번 나눠 잠그지 않는다.
--
--   같은 Game에 대한 두 저장 요청은 2단계에서 직렬화된다. 서로 다른 Game이
--   같은 선수를 포함해도 5단계의 정렬 잠금이 같은 순서를 보장한다.
--   DB 행 잠금은 저장 순간의 동시성 방어일 뿐 사용자에게 노출하는 운영
--   잠금이 아니다.
--
-- ------------------------------------------------------------
-- 신규 오류 코드 (prefix 안정성을 위해 접두어를 고정한다)
-- ------------------------------------------------------------
--   EVENT_GAME_CANCELLED_NO_RESULT          취소된 Game에는 결과를 둘 수 없음
--   EVENT_GAME_RESULT_FORMAT_UNSUPPORTED    복식이 아닌 Game (singles 등)
--   EVENT_GAME_RESULT_TIE_NOT_ALLOWED       동점 — 승자를 계산할 수 없음
--   EVENT_GAME_RESULT_INCONSISTENT          linked Match 없이 결과 흔적만 남음
--   EVENT_GAME_MATCH_MANAGED_SEPARATELY     Event-linked Match의 legacy 우회 변경
--
-- 재사용하는 기존 오류 코드
--   EVENT_NOT_FOUND / EVENT_STRUCTURE_LOCKED / EVENT_GAME_NOT_FOUND /
--   EVENT_GAME_INVALID_PLAYERS / EVENT_GAME_PARTICIPANT_UNAVAILABLE /
--   INVALID_SCORE / INVALID_TIEBREAK / PARTICIPANT_CLUB_MISMATCH /
--   EFFECT_UPDATE_FAILED / MATCH_NOT_FOUND
--
-- ------------------------------------------------------------
-- 적용 순서 의존성
-- ------------------------------------------------------------
-- 0057 -> 0058 -> 0059 순서로만 적용할 수 있다.
--   0057: matches.event_game_id, event_games.completed_at, Game<->Match unique/FK
--   0058: is_active 배정 정책, completed Event 잠금 제거
--
-- 이번 migration은 스키마를 바꾸지 않는다 — 함수만 추가·재정의한다.
-- API / UI / lib/event-engine.ts는 이번 단계에서 수정하지 않는다.
-- ============================================================

begin;

-- ============================================================
-- 1) private helper — 점수 검증 + 승자 계산
-- ============================================================
-- 기존 Match 엔진(0045/0046 create_match_with_effects)의 점수 계약을 그대로
-- 따른다: score는 0..7, 7-6/6-7일 때만 타이브레이크를 쓰고 그 경우 양쪽
-- 타이브레이크가 필수이며, 그 외 스코어의 타이브레이크 입력은 null로 정규화한다.
-- Event Game 전용 규칙은 딱 하나만 추가한다 — 동점 금지. legacy는 winner_team을
-- 호출자가 직접 넘겨 점수와의 정합성을 검사하지 않지만, Event 경로는 승자를
-- 점수에서 계산하므로 동점이면 승자를 정할 수 없다(2A-7B-2B 확정 정책 8).
create function public._event_game_result_score(
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
-- 2) private helper — Match 슬롯 → 효과 적용 대상 배열
-- ============================================================
-- _match_apply_effects / _match_undo_effects(0045)가 요구하는 4개 배열을
-- 만든다. 슬롯 8개(member/guest 쌍 4세트)와 승리 팀만 있으면 계산되므로,
-- 신규 결과(요청값)와 기존 결과(저장된 Match row) 양쪽에 같은 함수를 쓴다.
create function public._event_game_result_effect_arrays(
  p_winner_team text,
  p_a1_member uuid, p_a1_guest uuid,
  p_a2_member uuid, p_a2_guest uuid,
  p_b1_member uuid, p_b1_guest uuid,
  p_b2_member uuid, p_b2_guest uuid
) returns table(
  member_ids uuid[],
  member_won boolean[],
  guest_ids uuid[],
  guest_won boolean[]
)
language plpgsql
set search_path = ''
as $$
declare
  v_a_won boolean := (p_winner_team = 'A');
  v_slot_member uuid[] := array[p_a1_member, p_a2_member, p_b1_member, p_b2_member];
  v_slot_guest uuid[] := array[p_a1_guest, p_a2_guest, p_b1_guest, p_b2_guest];
  v_slot_won boolean[] := array[v_a_won, v_a_won, not v_a_won, not v_a_won];
  i integer;
begin
  member_ids := array[]::uuid[];
  member_won := array[]::boolean[];
  guest_ids := array[]::uuid[];
  guest_won := array[]::boolean[];

  for i in 1 .. 4 loop
    if v_slot_member[i] is not null then
      member_ids := member_ids || v_slot_member[i];
      member_won := member_won || v_slot_won[i];
    else
      guest_ids := guest_ids || v_slot_guest[i];
      guest_won := guest_won || v_slot_won[i];
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public._event_game_result_effect_arrays(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;


-- ============================================================
-- 3) save_event_game_result — 최초 저장 + 수정 + no-op
-- ============================================================
-- 계약 요약
--   · Event 전체 확정값(participants_confirmed_at / scheduling_confirmed_at)은
--     읽지도 검사하지도 않는다. 다른 Game의 상태도 보지 않는다.
--   · completed Event에서도 저장·수정 가능. cancelled Event/Game은 차단.
--   · 복식만 지원(singles는 matches의 XOR CHECK 4종 때문에 저장 자체가 불가).
--   · Game 하나당 linked Match는 최대 1건(0057 matches_event_game_uniq).
--   · 같은 canonical 요청 재시도는 포인트·전적을 다시 반영하지 않는다.
--   · 결과가 바뀌면 반드시 "기존 효과 undo → 새 효과 apply"를 같은 트랜잭션에서
--     수행한다. 중간 실패 시 트랜잭션 전체가 롤백되므로 효과만 사라진 상태는
--     구조적으로 남을 수 없다.
--
-- is_active 계약(2A-7B-2C)
--   is_active는 "새 배정 자격"이다. 이미 이 Game에 배정돼 있던 participant는
--   이후 비활성화됐더라도 그대로 유지·정정할 수 있다. 새로 들어오는(=현재
--   event_game_players에 없는) participant만 is_active=true를 요구한다.
--   0058이 draft/in_progress Game 배정 참가자의 비활성화를 이미 막고 있으므로,
--   면제 대상이 되는 것은 실질적으로 completed Game에 저장돼 있던 선수뿐이다.
--
-- 점수 저장 위치
--   event_games에는 점수·승자 컬럼이 없다(0054/0057 확인). 확정된 아키텍처가
--   "matches = 점수·승패의 source of truth, 중복 저장 금지"이므로, Game의
--   점수는 linked Match가 유일한 저장소다. 따라서 "Game 점수 저장/초기화"는
--   linked Match의 생성·수정·삭제로 달성되고, Game 쪽에서 동기화하는 것은
--   status와 completed_at뿐이다.
create function public.save_event_game_result(
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
  select e.member_ids, e.member_won, e.guest_ids, e.guest_won
    into v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
  from public._event_game_result_effect_arrays(
    v_winner,
    v_member[1], v_guest[1], v_member[2], v_guest[2],
    v_member[3], v_guest[3], v_member[4], v_guest[4]
  ) as e;

  if v_has_match and not v_match_same then
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

    perform public._match_apply_effects(
      p_club_id, v_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
    );

    v_action := 'created';
  else
    v_match_id := v_match.id;

    if not v_match_same then
      perform public._match_undo_effects(
        p_club_id, v_match_id, v_old_member_ids, v_old_member_won, v_old_guest_ids, v_old_guest_won
      );

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

      perform public._match_apply_effects(
        p_club_id, v_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
      );
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


-- ============================================================
-- 4) clear_event_game_result — 결과 초기화
-- ============================================================
-- linked Match의 효과를 undo하고 Match를 삭제한 뒤 Game을 draft로 되돌린다.
-- Game을 draft로 돌려야 이후 일반 Game RPC(set_event_game_players /
-- place_event_game / cancel_event_game)로 선수·배치를 다시 수정할 수 있다.
-- 선수 배정(event_game_players)과 court/session/position은 유지한다.
--
-- Match를 soft-delete하지 않고 실제로 지우는 이유: matches에 무효화 컬럼이
-- 없고 0057 matches_event_game_uniq가 살아 있어, 행을 남기면 같은 Game에
-- 결과를 다시 저장할 수 없다. point_history.match_id는 ON DELETE SET NULL
-- (0009)이라 포인트 이력(regular_match_win/loss + regular_match_rollback)은
-- 삭제 후에도 보존된다 — legacy delete_match_with_effects와 동일한 관례다.
create function public.clear_event_game_result(
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
  -- completed Event에서도 초기화할 수 있다. cancelled만 차단.
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
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

  select e.member_ids, e.member_won, e.guest_ids, e.guest_won
    into v_member_ids, v_member_won, v_guest_ids, v_guest_won
  from public._event_game_result_effect_arrays(
    v_match.winner_team::text,
    v_match.team_a_player1_member, v_match.team_a_player1_guest,
    v_match.team_a_player2_member, v_match.team_a_player2_guest,
    v_match.team_b_player1_member, v_match.team_b_player1_guest,
    v_match.team_b_player2_member, v_match.team_b_player2_guest
  ) as e;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  perform public._match_undo_effects(
    p_club_id, v_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );

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

-- update_match_with_effects  (원본: 0045, event_game_id 가드만 추가)
create or replace function public.update_match_with_effects(
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

  -- ★ 0059 신규: Event Game에 연결된 Match는 이 legacy 경로로 수정·삭제할 수
  -- 없다. 여기서 Match만 바꾸면 event_games.status/completed_at,
  -- event_game_players, matches.event_game_id 링크가 서로 어긋난 채 남는다
  -- (Game 쪽을 함께 갱신할 방법이 이 함수에는 없다). Event Game 결과는
  -- save_event_game_result / clear_event_game_result로만 변경한다.
  -- event_game_id가 null인 일반 legacy 경기는 기존과 완전히 동일하게 동작한다.
  if v_old.event_game_id is not null then
    raise exception 'EVENT_GAME_MATCH_MANAGED_SEPARATELY';
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

-- delete_match_with_effects  (원본: 0045, event_game_id 가드만 추가)
create or replace function public.delete_match_with_effects(
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

  -- ★ 0059 신규: Event Game에 연결된 Match는 이 legacy 경로로 수정·삭제할 수
  -- 없다. 여기서 Match만 바꾸면 event_games.status/completed_at,
  -- event_game_players, matches.event_game_id 링크가 서로 어긋난 채 남는다
  -- (Game 쪽을 함께 갱신할 방법이 이 함수에는 없다). Event Game 결과는
  -- save_event_game_result / clear_event_game_result로만 변경한다.
  -- event_game_id가 null인 일반 legacy 경기는 기존과 완전히 동일하게 동작한다.
  if v_old.event_game_id is not null then
    raise exception 'EVENT_GAME_MATCH_MANAGED_SEPARATELY';
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

-- ============================================================
-- RPC 권한 — 기존 Event/Match RPC와 동일한 보안 계약.
-- private helper는 어떤 role에도 execute를 주지 않는다(위 정의 직후에 각각
-- revoke를 선언했다). 공개 RPC는 service_role만 실행한다.
-- ============================================================

revoke all on function public.save_event_game_result(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid
) from public, anon, authenticated;
grant execute on function public.save_event_game_result(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid
) to service_role;

revoke all on function public.clear_event_game_result(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.clear_event_game_result(uuid, uuid, uuid)
to service_role;

revoke all on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

revoke all on function public.delete_match_with_effects(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_match_with_effects(uuid, uuid)
to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop function if exists public.save_event_game_result(
--   uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid);
-- drop function if exists public.clear_event_game_result(uuid, uuid, uuid);
-- drop function if exists public._event_game_result_effect_arrays(
--   text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid);
-- drop function if exists public._event_game_result_score(integer, integer, integer, integer);
--
-- commit;
--
-- update_match_with_effects / delete_match_with_effects는 DROP하지 말고
-- 0045_create_atomic_match_functions.sql의 원본 정의를 CREATE OR REPLACE로
-- 다시 실행해 되돌린다(두 함수는 0059가 새로 만든 것이 아니라 가드 한 블록만
-- 추가해 재정의한 것이다).
--
-- 주의: 이미 저장된 Event Game 결과가 있는 상태에서 rollback하면 그 결과를
-- 수정·초기화할 제품 경로가 사라진다. 포인트·전적과 linked Match는 그대로
-- 남으므로 데이터가 깨지지는 않지만, 실행 전 영향 범위를 확인해야 한다.
