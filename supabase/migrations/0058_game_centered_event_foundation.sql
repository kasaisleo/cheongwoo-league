-- ============================================================
-- 0058: Game 중심 운영 기반 전환 (Match System 2.0 — Phase 2A-7B-2B)
--
-- 배경: Event 전체를 "참가자 확정 → 스케줄 확정 → 결과 입력" 순서로 잠그는
--   단계형 구조가 실제 관리자 운영에 비해 과도하다고 판단해, 운영 단위를
--   Event에서 Game으로 옮긴다. 목표 흐름은 다음과 같다.
--
--     출석 명단 로드 → Game 생성 → Game별 선수 배정
--       → Game별 점수 입력·저장 → 필요하면 관리자 수정
--
--   Attendance / Event Participants = Game에 배정할 선수 풀
--   Event Game                      = 코트·순서·선수 배정·점수의 중심 단위
--   Match                           = 저장된 결과 및 포인트·전적 반영 기록
--
-- 이번 migration은 결과 저장 RPC를 만들지 않는다 — 그 앞단에서 "운영 확정
-- 절차"와 "Event 완료 잠금"을 제거하는 기반 변경만 수행한다.
-- save_event_game_result / clear_event_game_result는 후속 단계에서 구현한다.
--
-- ------------------------------------------------------------
-- 이번 migration이 바꾸는 것 (함수 19개 재정의, 스키마 변경 0건)
-- ------------------------------------------------------------
-- 1) 선수 배정 자격: event_participants.status = 'confirmed' 요구를 제거하고
--    is_active만 요구한다(_event_game_validate_players).
--
--      is_active = true   → 새 Game에 배정 가능한 선수 풀
--      is_active = false  → 새 Game에 배정 불가
--      status             → 기존 호환용 값. Game 배정 선행조건으로 쓰지 않는다.
--
--    import 참가자(기본 status='pending')와 수동 추가 참가자 모두 별도 확정
--    버튼 없이 바로 Game에 배정할 수 있어야 하므로, "import 시 confirmed로
--    생성"하는 방식은 채택하지 않았다. participants_confirmed_at /
--    scheduling_confirmed_at도 Game 생성·배정 선행조건으로 추가하지 않는다.
--
--    기존 active pending 참가자를 일괄 변경하거나 backfill하지 않는다 —
--    이 변경만으로 기존 행이 그대로 배정 가능해진다.
--
-- 2) Event 구조 잠금: Event 하위 구조를 다루는 모든 RPC에서
--      status in ('completed', 'cancelled')  →  status = 'cancelled'
--    로 좁힌다. Event의 completed는 운영상 종료 표시이며 구조 잠금으로
--    사용하지 않는다. cancelled Event는 기존처럼 terminal·읽기 전용이다
--    (update_event의 전이표에서 cancelled는 어떤 상태로도 나갈 수 없다).
--
-- 3) 참가자 비활성화 방어: 아직 결과가 저장되지 않은 Game(draft/in_progress)에
--    배정된 참가자는 비활성화(withdrawn/excluded)할 수 없다
--    → EVENT_PARTICIPANT_IN_ACTIVE_GAME.
--    completed Game에만 배정된 참가자는 비활성화를 허용한다 — 이미 정상적으로
--    배정·완료된 과거 Game의 결과·기록은 이후 비활성화와 무관하게 유효하다.
--    cancelled Game은 차단 근거로 쓰지 않는다.
--
-- 4) Event 취소 안전장치: status='completed'인 Event Game이 있거나 Event Game에
--    연결된 Match가 있으면 Event를 cancelled로 전환할 수 없다
--    → EVENT_HAS_COMPLETED_GAMES.
--    사용자 안내: "확정된 경기 결과가 있습니다. 경기 결과를 먼저 취소한 뒤
--    Event를 취소해주세요."
--    올바른 순서: Game 결과 초기화 → 연결 Match·포인트 효과 제거 → Event 취소.
--
-- ------------------------------------------------------------
-- 이번 migration이 바꾸지 않는 것
-- ------------------------------------------------------------
-- · Game 자체 잠금은 그대로 유지한다 — 일반 구조 RPC(update_event_game,
--   set_event_game_players, place_event_game, cancel_event_game)는 계속
--   game.status <> 'draft'에서 EVENT_GAME_STRUCTURE_LOCKED로 거부한다.
--   completed Game의 결과·선수 수정은 후속 전용 저장 RPC가 Match 효과의
--   undo/apply와 함께 단일 트랜잭션으로 처리해야 하며, 일반 RPC로 우회
--   수정하면 연결 Match와 불일치가 발생한다. Event 잠금과 Game 잠금은
--   서로 다른 축이다.
-- · confirm_event_participants / confirm_event_scheduling RPC는 삭제하지
--   않는다(Event 잠금 조건만 다른 함수와 동일하게 좁힌다). 운영에서는 이
--   경로를 사용하지 않을 예정이며 API/UI 제거는 후속 단계에서 처리한다.
--   confirm_event_scheduling의 EVENT_PARTICIPANTS_NOT_CONFIRMED 검사도
--   이번 단계에서는 그대로 둔다.
-- · participants_confirmed_at / scheduling_confirmed_at 컬럼과 그 무효화
--   지점은 그대로 둔다 — 결과 저장 경로가 이 값을 읽지 않으므로 값이 무엇이든
--   무해하다. 삭제는 하지 않는다.
-- · reorder_event_games의 "completed Game과 draft Game이 같은 position을
--   가질 수 있는" 문제는 발견 사항으로만 남긴다(partial unique가
--   status='draft' and event_session_id is null에만 걸리기 때문). Game 목록이
--   완료 Game까지 포함해 어떤 순서로 표시·재정렬되는지 API/UI 계약과 함께
--   결정한 뒤 별도 migration에서 다룬다.
-- · 결과 저장·수정·초기화 RPC, Match 생성, 포인트 반영은 이번 범위 밖이다.
-- · 0057은 수정하지 않는다.
--
-- ------------------------------------------------------------
-- 적용 순서 의존성
-- ------------------------------------------------------------
-- 이 migration은 0057 이후에만 적용할 수 있다 — update_event의 취소 안전장치가
-- matches.event_game_id(0057 신설)를 참조한다.
--
-- ------------------------------------------------------------
-- 작성 방식
-- ------------------------------------------------------------
-- 아래 19개 함수 정의는 0052/0053/0054의 최종 정의를 그대로 추출해 위 1~4의
-- 해당 줄만 기계적으로 치환·삽입한 결과다(손으로 다시 타이핑하지 않았다).
-- 원본 대비 변경이 의도한 줄에만 국한되는지 다중집합 diff로 검증했고,
-- signature / 인자 순서 / 반환형 / language / security definer /
-- set search_path = '' / 오류 코드 / 멱등성 분기는 전부 원본과 동일하다.
-- 각 함수 앞 주석에 원본 migration 번호를 남겼다.
-- ============================================================

begin;

-- _event_game_validate_players  (원본: 0054)
create or replace function public._event_game_validate_players(
  p_event_id uuid,
  p_club_id uuid,
  p_format text,
  p_participant_ids uuid[],
  p_teams text[],
  p_slots integer[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_required_count integer;
  v_len integer;
  v_distinct_participants integer;
  v_distinct_slots integer;
  v_unavailable_count integer;
begin
  if p_format not in ('singles', 'doubles') then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: invalid format';
  end if;

  v_required_count := case p_format when 'singles' then 2 else 4 end;

  if p_participant_ids is null or p_teams is null or p_slots is null then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: players must be provided';
  end if;

  v_len := array_length(p_participant_ids, 1);
  if v_len is null
     or v_len <> v_required_count
     or coalesce(array_length(p_teams, 1), 0) <> v_required_count
     or coalesce(array_length(p_slots, 1), 0) <> v_required_count
  then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: expected % players', v_required_count;
  end if;

  if exists (select 1 from unnest(p_participant_ids) as pid where pid is null) then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: participant id required';
  end if;
  if exists (select 1 from unnest(p_teams) as t where t is null or t not in ('A', 'B')) then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: invalid team value';
  end if;
  if exists (select 1 from unnest(p_slots) as s where s is null or s not in (1, 2)) then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: invalid slot value';
  end if;
  if p_format = 'singles' and exists (select 1 from unnest(p_slots) as s where s = 2) then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: singles cannot use slot 2';
  end if;

  select count(distinct pid) into v_distinct_participants from unnest(p_participant_ids) as pid;
  if v_distinct_participants <> v_required_count then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: duplicate participant';
  end if;

  select count(distinct (team || ':' || slot::text)) into v_distinct_slots
  from unnest(p_teams, p_slots) as u(team, slot);
  if v_distinct_slots <> v_required_count then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: duplicate team/slot assignment';
  end if;

  select count(*) into v_unavailable_count
  from unnest(p_participant_ids) as pid
  where not exists (
    select 1 from public.event_participants ep
    where ep.id = pid
      and ep.event_id = p_event_id
      and ep.club_id = p_club_id
      and ep.is_active
  );
  if v_unavailable_count > 0 then
    raise exception 'EVENT_GAME_PARTICIPANT_UNAVAILABLE: participant not active/in-club';
  end if;
end;
$$;

-- create_event_court  (원본: 0053)
create or replace function public.create_event_court(
  p_event_id uuid,
  p_club_id uuid,
  p_name text,
  p_position integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_name text;
  v_position integer;
  v_position_bigint bigint;
  v_court_id uuid;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  v_name := btrim(p_name);
  if v_name is null or v_name = '' then
    raise exception 'INVALID_EVENT_COURT_NAME';
  end if;
  if p_position is not null and p_position < 1 then
    raise exception 'INVALID_EVENT_COURT_POSITION';
  end if;

  perform 1 from public.event_courts
  where event_id = p_event_id and is_active and lower(btrim(name)) = lower(v_name);
  if found then
    raise exception 'EVENT_COURT_NAME_TAKEN';
  end if;

  if p_position is null then
    select coalesce(max(position), 0)::bigint + 1 into v_position_bigint
    from public.event_courts
    where event_id = p_event_id and is_active;
    if v_position_bigint > 2147483647 then
      raise exception 'EVENT_COURT_POSITION_OVERFLOW';
    end if;
    v_position := v_position_bigint::integer;
  else
    v_position := p_position;
    perform 1 from public.event_courts
    where event_id = p_event_id and is_active and position = v_position;
    if found then
      raise exception 'EVENT_COURT_POSITION_TAKEN';
    end if;
  end if;

  insert into public.event_courts (event_id, club_id, name, position)
  values (p_event_id, p_club_id, v_name, v_position)
  returning id into v_court_id;

  -- ★ 2A-5C 신규: 생성은 항상 실질 변경.
  update public.events set scheduling_confirmed_at = null where id = p_event_id;

  return v_court_id;
end;
$$;

-- update_event_court  (원본: 0053)
create or replace function public.update_event_court(
  p_court_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_name text default null,
  p_position integer default null,
  p_is_active boolean default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_court public.event_courts%rowtype;
  v_new_name text;
  v_new_position integer;
  v_new_is_active boolean;
  v_active_session_count integer;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select * into v_court
  from public.event_courts
  where id = p_court_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_COURT_NOT_FOUND';
  end if;

  v_new_name := v_court.name;
  if p_name is not null then
    v_new_name := btrim(p_name);
    if v_new_name = '' then
      raise exception 'INVALID_EVENT_COURT_NAME';
    end if;
  end if;

  v_new_position := coalesce(p_position, v_court.position);
  if p_position is not null and p_position < 1 then
    raise exception 'INVALID_EVENT_COURT_POSITION';
  end if;

  v_new_is_active := coalesce(p_is_active, v_court.is_active);

  -- ★ 2A-5C 신규: 최종값이 현재값과 완전히 동일하면 no-op — 아무것도 쓰지
  -- 않고 즉시 반환한다(scheduling_confirmed_at도 건드리지 않음). 이 지점은
  -- 이미 EVENT_NOT_FOUND/EVENT_STRUCTURE_LOCKED를 통과한 뒤이므로, 잠긴
  -- Event에 대한 동일값 요청은 no-op이 아니라 위에서 이미 거부되어 있다.
  if v_new_name = v_court.name
     and v_new_position = v_court.position
     and v_new_is_active = v_court.is_active
  then
    return;
  end if;

  if v_court.is_active and not v_new_is_active then
    select count(*) into v_active_session_count
    from public.event_sessions
    where event_court_id = p_court_id and is_active;
    if v_active_session_count > 0 then
      raise exception 'EVENT_COURT_HAS_ACTIVE_SESSIONS';
    end if;
  end if;

  if v_new_is_active then
    perform 1 from public.event_courts
    where event_id = p_event_id and is_active and id <> p_court_id
      and lower(btrim(name)) = lower(v_new_name);
    if found then
      raise exception 'EVENT_COURT_NAME_TAKEN';
    end if;

    perform 1 from public.event_courts
    where event_id = p_event_id and is_active and id <> p_court_id and position = v_new_position;
    if found then
      raise exception 'EVENT_COURT_POSITION_TAKEN';
    end if;
  end if;

  update public.event_courts set
    name = v_new_name,
    position = v_new_position,
    is_active = v_new_is_active,
    updated_at = now()
  where id = p_court_id and event_id = p_event_id and club_id = p_club_id;

  -- ★ 2A-5C 신규: 위 no-op 체크를 통과했다는 것은 실질 변경이 확정됨을 뜻한다.
  update public.events set scheduling_confirmed_at = null where id = p_event_id;
end;
$$;

-- reorder_event_courts  (원본: 0053)
create or replace function public.reorder_event_courts(
  p_event_id uuid,
  p_club_id uuid,
  p_court_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_count bigint;
  v_offset bigint;
  v_active_ids uuid[];
  v_sorted_input uuid[];
  v_current_order uuid[];
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  v_count := coalesce(array_length(p_court_ids, 1), 0);
  if v_count > 500 then
    raise exception 'EVENT_COURT_REORDER_TOO_LARGE';
  end if;

  if v_count <> (select count(distinct x) from unnest(p_court_ids) as x) then
    raise exception 'EVENT_COURT_REORDER_DUPLICATE_ID';
  end if;

  perform 1 from public.event_courts
  where id = any(p_court_ids) and event_id = p_event_id and club_id = p_club_id
  order by id
  for update;

  if (
    select count(*) from public.event_courts
    where id = any(p_court_ids) and event_id = p_event_id and club_id = p_club_id
  ) <> v_count then
    raise exception 'EVENT_COURT_REORDER_SET_MISMATCH';
  end if;

  select coalesce(array_agg(id order by id), array[]::uuid[]) into v_active_ids
  from public.event_courts
  where event_id = p_event_id and is_active;

  select coalesce(array_agg(x order by x), array[]::uuid[]) into v_sorted_input
  from unnest(p_court_ids) as x;

  if v_sorted_input is distinct from v_active_ids then
    raise exception 'EVENT_COURT_REORDER_SET_MISMATCH';
  end if;

  -- ★ 2A-5C 신규: 집합은 같아도 요청 순서가 현재 position 순서와 완전히
  -- 같으면 no-op — position을 다시 쓰지 않고 확정 시각도 유지한다.
  select coalesce(array_agg(id order by position), array[]::uuid[]) into v_current_order
  from public.event_courts
  where event_id = p_event_id and club_id = p_club_id and is_active;

  if p_court_ids = v_current_order then
    return;
  end if;

  select coalesce(max(position), 0)::bigint + 1 into v_offset
  from public.event_courts
  where event_id = p_event_id
    and club_id = p_club_id
    and is_active;

  if v_offset + v_count > 2147483647 then
    raise exception 'EVENT_COURT_POSITION_OVERFLOW';
  end if;

  update public.event_courts ec
  set position = (v_offset + ord.rn)::integer, updated_at = now()
  from unnest(p_court_ids) with ordinality as ord(id, rn)
  where ec.id = ord.id;

  update public.event_courts ec
  set position = ord.rn::integer, updated_at = now()
  from unnest(p_court_ids) with ordinality as ord(id, rn)
  where ec.id = ord.id;

  update public.events set scheduling_confirmed_at = null where id = p_event_id;
end;
$$;

-- create_event_session  (원본: 0053)
create or replace function public.create_event_session(
  p_event_id uuid,
  p_club_id uuid,
  p_event_court_id uuid,
  p_position integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_label text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_court public.event_courts%rowtype;
  v_label text;
  v_position integer;
  v_position_bigint bigint;
  v_session_id uuid;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for share;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select * into v_court
  from public.event_courts
  where id = p_event_court_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_COURT_NOT_FOUND';
  end if;
  if not v_court.is_active then
    raise exception 'EVENT_COURT_INACTIVE';
  end if;

  if (p_starts_at is null) <> (p_ends_at is null) then
    raise exception 'EVENT_SESSION_TIME_RANGE_INCOMPLETE';
  end if;

  perform public._event_session_validate_mode(v_slot_mode, p_starts_at, p_ends_at);

  if p_starts_at is not null and p_ends_at <= p_starts_at then
    raise exception 'EVENT_SESSION_TIME_RANGE';
  end if;

  v_label := p_label;
  if v_label is not null then
    v_label := btrim(v_label);
    if v_label = '' then
      raise exception 'INVALID_EVENT_SESSION_LABEL';
    end if;
  end if;

  if p_position is not null and p_position < 1 then
    raise exception 'INVALID_EVENT_SESSION_POSITION';
  end if;

  if p_starts_at is not null then
    perform 1 from public.event_sessions
    where event_court_id = p_event_court_id and is_active
      and starts_at is not null
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');
    if found then
      raise exception 'EVENT_SESSION_OVERLAP';
    end if;
  end if;

  if p_position is null then
    select coalesce(max(position), 0)::bigint + 1 into v_position_bigint
    from public.event_sessions
    where event_court_id = p_event_court_id and is_active;
    if v_position_bigint > 2147483647 then
      raise exception 'EVENT_SESSION_POSITION_OVERFLOW';
    end if;
    v_position := v_position_bigint::integer;
  else
    v_position := p_position;
    perform 1 from public.event_sessions
    where event_court_id = p_event_court_id and is_active and position = v_position;
    if found then
      raise exception 'EVENT_SESSION_POSITION_TAKEN';
    end if;
  end if;

  begin
    insert into public.event_sessions (event_id, club_id, event_court_id, position, starts_at, ends_at, label)
    values (p_event_id, p_club_id, p_event_court_id, v_position, p_starts_at, p_ends_at, v_label)
    returning id into v_session_id;
  exception
    when exclusion_violation then
      raise exception 'EVENT_SESSION_OVERLAP';
  end;

  -- ★ 2A-5C 신규: 생성은 항상 실질 변경.
  update public.events set scheduling_confirmed_at = null where id = p_event_id;

  return v_session_id;
end;
$$;

-- update_event_session  (원본: 0053)
create or replace function public.update_event_session(
  p_session_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_position integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_clear_times boolean default false,
  p_label text default null,
  p_clear_label boolean default false,
  p_is_active boolean default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_event_court_id uuid;
  v_court public.event_courts%rowtype;
  v_session public.event_sessions%rowtype;
  v_new_position integer;
  v_new_starts_at timestamptz;
  v_new_ends_at timestamptz;
  v_new_label text;
  v_new_is_active boolean;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for share;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select event_court_id into v_event_court_id
  from public.event_sessions
  where id = p_session_id and event_id = p_event_id and club_id = p_club_id;

  if not found then
    raise exception 'EVENT_SESSION_NOT_FOUND';
  end if;

  select * into v_court
  from public.event_courts
  where id = v_event_court_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_COURT_NOT_FOUND';
  end if;

  select * into v_session
  from public.event_sessions
  where id = p_session_id and event_id = p_event_id and club_id = p_club_id
    and event_court_id = v_event_court_id
  for update;

  if not found then
    raise exception 'EVENT_SESSION_NOT_FOUND';
  end if;

  if p_clear_times and (p_starts_at is not null or p_ends_at is not null) then
    raise exception 'EVENT_SESSION_CLEAR_TIMES_WITH_VALUE';
  end if;

  if p_clear_times then
    v_new_starts_at := null;
    v_new_ends_at := null;
  elsif p_starts_at is null and p_ends_at is null then
    v_new_starts_at := v_session.starts_at;
    v_new_ends_at := v_session.ends_at;
  elsif p_starts_at is not null and p_ends_at is not null then
    v_new_starts_at := p_starts_at;
    v_new_ends_at := p_ends_at;
  else
    raise exception 'EVENT_SESSION_TIME_RANGE_INCOMPLETE';
  end if;

  if p_clear_label and p_label is not null then
    raise exception 'EVENT_SESSION_CLEAR_LABEL_WITH_VALUE';
  end if;

  if p_clear_label then
    v_new_label := null;
  elsif p_label is not null then
    v_new_label := btrim(p_label);
    if v_new_label = '' then
      raise exception 'INVALID_EVENT_SESSION_LABEL';
    end if;
  else
    v_new_label := v_session.label;
  end if;

  v_new_position := coalesce(p_position, v_session.position);
  if p_position is not null and p_position < 1 then
    raise exception 'INVALID_EVENT_SESSION_POSITION';
  end if;

  v_new_is_active := coalesce(p_is_active, v_session.is_active);

  -- ★ 2A-5C 신규: 최종값이 현재값과 완전히 동일하면 no-op. starts_at/ends_at/
  -- label은 nullable이라 IS NOT DISTINCT FROM으로 비교(둘 다 null인 경우도
  -- "같음"으로 정확히 판정 — plain =은 NULL 비교 시 항상 unknown이 되어
  -- 진짜 no-op을 "다름"으로 오판할 수 있다).
  if v_new_position = v_session.position
     and v_new_starts_at is not distinct from v_session.starts_at
     and v_new_ends_at is not distinct from v_session.ends_at
     and v_new_label is not distinct from v_session.label
     and v_new_is_active = v_session.is_active
  then
    return;
  end if;

  if v_new_is_active and not v_court.is_active then
    raise exception 'EVENT_COURT_INACTIVE';
  end if;

  if v_new_starts_at is not null and v_new_ends_at <= v_new_starts_at then
    raise exception 'EVENT_SESSION_TIME_RANGE';
  end if;

  if v_new_is_active then
    perform public._event_session_validate_mode(v_slot_mode, v_new_starts_at, v_new_ends_at);

    perform 1 from public.event_sessions
    where event_court_id = v_event_court_id and is_active
      and id <> p_session_id and position = v_new_position;
    if found then
      raise exception 'EVENT_SESSION_POSITION_TAKEN';
    end if;

    if v_new_starts_at is not null then
      perform 1 from public.event_sessions
      where event_court_id = v_event_court_id and is_active and id <> p_session_id
        and starts_at is not null
        and tstzrange(starts_at, ends_at, '[)') && tstzrange(v_new_starts_at, v_new_ends_at, '[)');
      if found then
        raise exception 'EVENT_SESSION_OVERLAP';
      end if;
    end if;
  end if;

  begin
    update public.event_sessions set
      position = v_new_position,
      starts_at = v_new_starts_at,
      ends_at = v_new_ends_at,
      label = v_new_label,
      is_active = v_new_is_active,
      updated_at = now()
    where id = p_session_id and event_id = p_event_id and club_id = p_club_id;
  exception
    when exclusion_violation then
      raise exception 'EVENT_SESSION_OVERLAP';
  end;

  update public.events set scheduling_confirmed_at = null where id = p_event_id;
end;
$$;

-- reorder_event_sessions  (원본: 0053)
create or replace function public.reorder_event_sessions(
  p_event_court_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_session_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_count bigint;
  v_offset bigint;
  v_active_ids uuid[];
  v_sorted_input uuid[];
  v_current_order uuid[];
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for share;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  perform 1 from public.event_courts
  where id = p_event_court_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_COURT_NOT_FOUND';
  end if;

  v_count := coalesce(array_length(p_session_ids, 1), 0);
  if v_count > 500 then
    raise exception 'EVENT_SESSION_REORDER_TOO_LARGE';
  end if;

  if v_count <> (select count(distinct x) from unnest(p_session_ids) as x) then
    raise exception 'EVENT_SESSION_REORDER_DUPLICATE_ID';
  end if;

  perform 1 from public.event_sessions
  where id = any(p_session_ids) and event_court_id = p_event_court_id
    and event_id = p_event_id and club_id = p_club_id
  order by id
  for update;

  if (
    select count(*) from public.event_sessions
    where id = any(p_session_ids) and event_court_id = p_event_court_id
      and event_id = p_event_id and club_id = p_club_id
  ) <> v_count then
    raise exception 'EVENT_SESSION_REORDER_SET_MISMATCH';
  end if;

  select coalesce(array_agg(id order by id), array[]::uuid[]) into v_active_ids
  from public.event_sessions
  where event_court_id = p_event_court_id and is_active;

  select coalesce(array_agg(x order by x), array[]::uuid[]) into v_sorted_input
  from unnest(p_session_ids) as x;

  if v_sorted_input is distinct from v_active_ids then
    raise exception 'EVENT_SESSION_REORDER_SET_MISMATCH';
  end if;

  -- ★ 2A-5C 신규: 순서까지 동일하면 no-op.
  select coalesce(array_agg(id order by position), array[]::uuid[]) into v_current_order
  from public.event_sessions
  where event_court_id = p_event_court_id and event_id = p_event_id and club_id = p_club_id and is_active;

  if p_session_ids = v_current_order then
    return;
  end if;

  select coalesce(max(position), 0)::bigint + 1 into v_offset
  from public.event_sessions
  where event_court_id = p_event_court_id
    and event_id = p_event_id
    and club_id = p_club_id
    and is_active;

  if v_offset + v_count > 2147483647 then
    raise exception 'EVENT_SESSION_POSITION_OVERFLOW';
  end if;

  update public.event_sessions es
  set position = (v_offset + ord.rn)::integer, updated_at = now()
  from unnest(p_session_ids) with ordinality as ord(id, rn)
  where es.id = ord.id;

  update public.event_sessions es
  set position = ord.rn::integer, updated_at = now()
  from unnest(p_session_ids) with ordinality as ord(id, rn)
  where es.id = ord.id;

  update public.events set scheduling_confirmed_at = null where id = p_event_id;
end;
$$;

-- import_event_participants_from_attendance  (원본: 0053)
create or replace function public.import_event_participants_from_attendance(
  p_event_id uuid,
  p_club_id uuid,
  p_attendance_session_id uuid
) returns table(
  inserted_count integer,
  reactivated_count integer,
  skipped_duplicate_count integer,
  skipped_excluded_count integer,
  skipped_inactive_member_count integer,
  skipped_inactive_guest_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_session_club_id uuid;

  v_inserted integer := 0;
  v_reactivated integer := 0;
  v_skipped_duplicate integer := 0;
  v_skipped_excluded integer := 0;
  v_skipped_inactive_member integer := 0;
  v_skipped_inactive_guest integer := 0;
  v_any_change boolean := false;

  v_member_record_ids uuid[];
  v_member_ids uuid[];
  v_member_names text[];
  v_member_actives boolean[];

  v_guest_record_ids uuid[];
  v_guest_ids uuid[];
  v_guest_names text[];
  v_guest_actives boolean[];

  i integer;
  v_snapshot text;
  v_pid uuid;
  v_outcome text;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select club_id into v_session_club_id
  from public.attendance_sessions
  where id = p_attendance_session_id;

  if not found or v_session_club_id <> p_club_id then
    raise exception 'ATTENDANCE_SESSION_NOT_FOUND';
  end if;

  perform 1 from public.attendance a
  join public.members m on m.id = a.member_id
  where a.session_id = p_attendance_session_id
    and a.status = 'attending'
    and m.club_id <> p_club_id;
  if found then
    raise exception 'ATTENDANCE_MEMBER_SCOPE_INVALID';
  end if;

  perform 1 from public.session_guests sg
  join public.guests g on g.id = sg.guest_id
  where sg.session_id = p_attendance_session_id
    and g.club_id <> p_club_id;
  if found then
    raise exception 'SESSION_GUEST_SCOPE_INVALID';
  end if;

  select
    coalesce(array_agg(a.id order by a.member_id), array[]::uuid[]),
    coalesce(array_agg(a.member_id order by a.member_id), array[]::uuid[]),
    coalesce(array_agg(m.name order by a.member_id), array[]::text[]),
    coalesce(array_agg(m.is_active order by a.member_id), array[]::boolean[])
  into v_member_record_ids, v_member_ids, v_member_names, v_member_actives
  from public.attendance a
  join public.members m on m.id = a.member_id and m.club_id = p_club_id
  where a.session_id = p_attendance_session_id and a.status = 'attending';

  select
    coalesce(array_agg(sg.id order by sg.guest_id), array[]::uuid[]),
    coalesce(array_agg(sg.guest_id order by sg.guest_id), array[]::uuid[]),
    coalesce(array_agg(g.name order by sg.guest_id), array[]::text[]),
    coalesce(array_agg(g.is_active order by sg.guest_id), array[]::boolean[])
  into v_guest_record_ids, v_guest_ids, v_guest_names, v_guest_actives
  from public.session_guests sg
  join public.guests g on g.id = sg.guest_id and g.club_id = p_club_id
  where sg.session_id = p_attendance_session_id;

  for i in 1 .. coalesce(array_length(v_member_ids, 1), 0) loop
    if not v_member_actives[i] then
      v_skipped_inactive_member := v_skipped_inactive_member + 1;
      continue;
    end if;

    v_snapshot := btrim(v_member_names[i]);
    if v_snapshot = '' then
      raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
    end if;

    select participant_id, outcome into v_pid, v_outcome
    from public._event_participant_upsert(
      p_event_id, p_club_id, 'member', v_member_ids[i], null, v_snapshot,
      'attendance_member', p_attendance_session_id, v_member_record_ids[i]
    );

    if v_outcome = 'inserted' then
      v_inserted := v_inserted + 1;
      v_any_change := true;
    elsif v_outcome = 'reactivated' then
      v_reactivated := v_reactivated + 1;
      v_any_change := true;
    elsif v_outcome = 'skipped_active' then
      v_skipped_duplicate := v_skipped_duplicate + 1;
    elsif v_outcome = 'skipped_excluded' then
      v_skipped_excluded := v_skipped_excluded + 1;
    end if;
  end loop;

  for i in 1 .. coalesce(array_length(v_guest_ids, 1), 0) loop
    if not v_guest_actives[i] then
      v_skipped_inactive_guest := v_skipped_inactive_guest + 1;
      continue;
    end if;

    v_snapshot := btrim(v_guest_names[i]);
    if v_snapshot = '' then
      raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
    end if;

    select participant_id, outcome into v_pid, v_outcome
    from public._event_participant_upsert(
      p_event_id, p_club_id, 'guest', null, v_guest_ids[i], v_snapshot,
      'session_guest', p_attendance_session_id, v_guest_record_ids[i]
    );

    if v_outcome = 'inserted' then
      v_inserted := v_inserted + 1;
      v_any_change := true;
    elsif v_outcome = 'reactivated' then
      v_reactivated := v_reactivated + 1;
      v_any_change := true;
    elsif v_outcome = 'skipped_active' then
      v_skipped_duplicate := v_skipped_duplicate + 1;
    elsif v_outcome = 'skipped_excluded' then
      v_skipped_excluded := v_skipped_excluded + 1;
    end if;
  end loop;

  -- ★ 2A-5C 신규: 참가자 실질 변경 시 참가자 확정과 스케줄 확정을 함께 무효화.
  if v_any_change then
    update public.events set participants_confirmed_at = null, scheduling_confirmed_at = null where id = p_event_id;
  end if;

  return query select
    v_inserted, v_reactivated, v_skipped_duplicate, v_skipped_excluded,
    v_skipped_inactive_member, v_skipped_inactive_guest;
end;
$$;

-- create_event_participant  (원본: 0053)
create or replace function public.create_event_participant(
  p_event_id uuid,
  p_club_id uuid,
  p_member_id uuid default null,
  p_guest_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participant_type text;
  v_snapshot text;
  v_target_active boolean;
  v_pid uuid;
  v_outcome text;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  if (p_member_id is not null) = (p_guest_id is not null) then
    raise exception 'INVALID_PARTICIPANT_SELECTOR';
  end if;

  if p_member_id is not null then
    v_participant_type := 'member';
    select name, is_active into v_snapshot, v_target_active
    from public.members
    where id = p_member_id and club_id = p_club_id;

    if not found then
      raise exception 'PARTICIPANT_MEMBER_NOT_FOUND';
    end if;
    if not v_target_active then
      raise exception 'PARTICIPANT_MEMBER_INACTIVE';
    end if;
  else
    v_participant_type := 'guest';
    select name, is_active into v_snapshot, v_target_active
    from public.guests
    where id = p_guest_id and club_id = p_club_id;

    if not found then
      raise exception 'PARTICIPANT_GUEST_NOT_FOUND';
    end if;
    if not v_target_active then
      raise exception 'PARTICIPANT_GUEST_INACTIVE';
    end if;
  end if;

  v_snapshot := btrim(v_snapshot);
  if v_snapshot = '' then
    raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
  end if;

  select participant_id, outcome into v_pid, v_outcome
  from public._event_participant_upsert(
    p_event_id, p_club_id, v_participant_type, p_member_id, p_guest_id, v_snapshot,
    'manual', null, null
  );

  if v_outcome = 'skipped_active' then
    raise exception 'EVENT_PARTICIPANT_ALREADY_ACTIVE';
  elsif v_outcome = 'skipped_excluded' then
    raise exception 'EVENT_PARTICIPANT_EXCLUDED';
  end if;

  -- ★ 2A-5C 신규: 'inserted'/'reactivated' 둘 다 실질 변경이므로 참가자
  -- 확정과 스케줄 확정을 함께 무효화(항상, 조건 없이).
  update public.events set participants_confirmed_at = null, scheduling_confirmed_at = null where id = p_event_id;

  return v_pid;
end;
$$;

-- update_event_participant  (원본: 0053)
create or replace function public.update_event_participant(
  p_participant_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participant public.event_participants%rowtype;
  v_new_is_active boolean;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  if p_status not in ('pending', 'confirmed', 'withdrawn', 'excluded') then
    raise exception 'INVALID_PARTICIPANT_STATUS';
  end if;

  select * into v_participant
  from public.event_participants
  where id = p_participant_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_PARTICIPANT_NOT_FOUND';
  end if;

  if p_status = v_participant.status then
    return; -- no-op: 참가자 확정도 스케줄 확정도 무효화하지 않는다(2A-5C).
  end if;

  v_new_is_active := p_status in ('pending', 'confirmed');

  -- ★ 0058 신규: is_active는 "새 Game에 배정 가능한 자격"이다. 비활성화(withdrawn/
  -- excluded)로 내려갈 때, 아직 결과가 저장되지 않은 Game(draft/in_progress)에
  -- 이미 배정돼 있으면 차단한다 — 그대로 두면 배정 자격이 없는 선수가 남은 채로
  -- 결과가 저장되고 포인트까지 반영된다. event_game_players_participant_fk는 행
  -- 삭제만 막고 status 변경은 막지 못하므로 이 명시적 검사가 유일한 방어선이다.
  --
  -- completed Game만 참조하는 참가자는 비활성화를 허용한다 — 이미 정상적으로
  -- 배정·완료된 과거 Game의 결과와 기록은 이후 참가자 비활성화와 무관하게
  -- 유효해야 한다(결과 수정 RPC도 현재 is_active를 다시 요구하지 않는다).
  -- cancelled Game은 배정 차단 근거로 쓰지 않는다.
  if not v_new_is_active then
    if exists (
      select 1
      from public.event_game_players gp
      join public.event_games g
        on g.id = gp.event_game_id
       and g.event_id = gp.event_id
       and g.club_id = gp.club_id
      where gp.event_participant_id = p_participant_id
        and gp.event_id = p_event_id
        and gp.club_id = p_club_id
        and g.status in ('draft', 'in_progress')
    ) then
      raise exception 'EVENT_PARTICIPANT_IN_ACTIVE_GAME';
    end if;
  end if;

  update public.event_participants set
    status = p_status,
    is_active = v_new_is_active,
    updated_at = now()
  where id = p_participant_id;

  -- ★ 2A-5C 신규: 상태가 실제로 바뀌었으므로(위 no-op 분기를 통과) 참가자
  -- 확정과 스케줄 확정을 함께 무효화.
  update public.events set participants_confirmed_at = null, scheduling_confirmed_at = null where id = p_event_id;
end;
$$;

-- confirm_event_participants  (원본: 0052)
create or replace function public.confirm_event_participants(
  p_event_id uuid,
  p_club_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_confirmed_at timestamptz;
  v_active_count integer;
  v_pending_count integer;
  v_transitioned integer;
begin
  select status, participants_confirmed_at into v_event_status, v_confirmed_at
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select count(*) into v_active_count
  from public.event_participants
  where event_id = p_event_id and is_active;

  if v_active_count = 0 then
    raise exception 'EVENT_NO_ACTIVE_PARTICIPANTS';
  end if;

  select count(*) into v_pending_count
  from public.event_participants
  where event_id = p_event_id and is_active and status = 'pending';

  if v_pending_count > 0 then
    update public.event_participants
    set status = 'confirmed', updated_at = now()
    where event_id = p_event_id and is_active and status = 'pending';

    get diagnostics v_transitioned = row_count;

    update public.events set participants_confirmed_at = now() where id = p_event_id;

    return v_transitioned;
  end if;

  -- pending = 0: 참가자 row는 절대 건드리지 않는다.
  if v_confirmed_at is null then
    -- 최초 확정 — 개별 참가자가 이미 다 confirmed 상태(수동 전환 등)였더라도
    -- Event 레벨 확정 타임스탬프는 아직 없었으므로 지금 찍는다.
    update public.events set participants_confirmed_at = now() where id = p_event_id;
  end if;
  -- v_confirmed_at is not null: 완전 no-op(타임스탬프도 건드리지 않음).

  return 0;
end;
$$;

-- confirm_event_scheduling  (원본: 0053)
create or replace function public.confirm_event_scheduling(
  p_event_id uuid,
  p_club_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participants_confirmed_at timestamptz;
  v_scheduling_confirmed_at timestamptz;
  v_slot_mode text;
  v_active_court_count integer;
  v_courts_with_sessions_count integer;
begin
  select status, participants_confirmed_at, scheduling_confirmed_at, match_config->>'slot_mode'
    into v_event_status, v_participants_confirmed_at, v_scheduling_confirmed_at, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  if v_participants_confirmed_at is null then
    raise exception 'EVENT_PARTICIPANTS_NOT_CONFIRMED';
  end if;

  -- 완전 no-op: 이미 확정된 상태면 재검증도 하지 않고 그대로 반환한다
  -- (confirm_event_participants의 "pending=0 and confirmed_at is not null"
  -- 분기와 동일한 strict idempotency 철학).
  if v_scheduling_confirmed_at is not null then
    return;
  end if;

  select count(*) into v_active_court_count
  from public.event_courts
  where event_id = p_event_id and is_active;

  if v_active_court_count = 0 then
    raise exception 'EVENT_SCHEDULING_NO_ACTIVE_COURTS';
  end if;

  if v_slot_mode in ('ordered', 'timed') then
    -- 활성 슬롯을 1개 이상 가진 활성 코트 수를 센다 — 활성 코트 전체 수와
    -- 다르면 슬롯이 하나도 없는 활성 코트가 있다는 뜻이다(정책: ordered/timed는
    -- 각 활성 코트마다 활성 슬롯이 1개 이상 필요).
    select count(distinct ec.id) into v_courts_with_sessions_count
    from public.event_courts ec
    join public.event_sessions es on es.event_court_id = ec.id and es.is_active
    where ec.event_id = p_event_id and ec.is_active;

    if v_courts_with_sessions_count < v_active_court_count then
      raise exception 'EVENT_SCHEDULING_COURT_MISSING_SESSIONS';
    end if;
  end if;

  update public.events set scheduling_confirmed_at = now() where id = p_event_id;
end;
$$;

-- update_event  (원본: 0053)
create or replace function public.update_event(
  p_event_id uuid,
  p_club_id uuid,
  p_title text default null,
  p_event_date date default null,
  p_status text default null,
  p_match_config jsonb default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_new_config jsonb;
  v_active_session_count integer;
  v_slot_mode_changed boolean := false;
begin
  select * into v_event
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if p_title is not null then
    if btrim(p_title) = '' then
      raise exception 'INVALID_TITLE';
    end if;
    v_event.title := btrim(p_title);
  end if;

  if p_event_date is not null then
    v_event.event_date := p_event_date;
  end if;

  if p_match_config is not null then
    v_new_config := public.normalize_match_config(p_match_config);

    if (v_new_config->>'slot_mode') is distinct from (v_event.match_config->>'slot_mode') then
      select count(*) into v_active_session_count
      from public.event_sessions
      where event_id = p_event_id and is_active;
      if v_active_session_count > 0 then
        raise exception 'EVENT_SLOT_MODE_LOCKED';
      end if;
      -- ★ 2A-5C 신규: slot_mode가 실제로 바뀌는 경로는 활성 세션이 0개일
      -- 때뿐이다(위 잠금으로 보장). 이 경우에도 이미 확정된 스케줄(주로
      -- none으로 확정된, 세션 없는 상태)이 새 모드의 요구조건(ordered/timed는
      -- 활성 코트마다 활성 슬롯 필요)을 더 이상 만족하지 못하므로 무효화한다.
      v_slot_mode_changed := true;
    end if;

    v_event.match_config := v_new_config;
  end if;

  if p_status is not null and p_status <> v_event.status then
    if v_event.status = 'cancelled' then
      raise exception 'EVENT_STATUS_TERMINAL: cancelled event cannot transition';
    end if;
    if v_event.status = 'draft' and p_status not in ('active','completed','cancelled') then
      raise exception 'INVALID_STATUS_TRANSITION: draft -> %', p_status;
    end if;
    if v_event.status = 'active' and p_status not in ('completed','cancelled') then
      raise exception 'INVALID_STATUS_TRANSITION: active -> %', p_status;
    end if;
    if v_event.status = 'completed' and p_status <> 'active' then
      raise exception 'INVALID_STATUS_TRANSITION: completed -> %', p_status;
    end if;

    -- ★ 0058 신규: 확정된 결과가 있는 Event는 취소할 수 없다.
    -- 결과 저장 시 포인트·전적이 즉시 반영되는데, 그 상태로 Event가 cancelled가
    -- 되면 결과 Match와 포인트가 그대로 남고, cancelled는 terminal이라(위 전이표)
    -- 이후 결과 초기화 경로까지 영구 차단되어 되돌릴 방법이 없다.
    -- 올바른 순서: Game 결과 초기화 → 연결 Match·포인트 효과 제거 → Event 취소.
    -- matches.event_game_id는 0057이 추가한 컬럼이므로 0058은 0057 이후에만
    -- 적용할 수 있다.
    if p_status = 'cancelled' then
      if exists (
        select 1
        from public.event_games g
        where g.event_id = p_event_id
          and g.club_id = p_club_id
          and g.status = 'completed'
      ) or exists (
        select 1
        from public.matches m
        join public.event_games g
          on g.id = m.event_game_id
         and g.club_id = m.club_id
        where g.event_id = p_event_id
          and g.club_id = p_club_id
      ) then
        raise exception 'EVENT_HAS_COMPLETED_GAMES';
      end if;
    end if;

    if p_status = 'completed' then
      v_event.completed_at := coalesce(v_event.completed_at, now());
    elsif v_event.status = 'completed' and p_status = 'active' then
      v_event.completed_at := null;
    end if;

    v_event.status := p_status;
  end if;

  update public.events set
    title = v_event.title,
    event_date = v_event.event_date,
    status = v_event.status,
    match_config = v_event.match_config,
    completed_at = v_event.completed_at,
    updated_at = now()
  where id = p_event_id and club_id = p_club_id;

  if v_slot_mode_changed then
    update public.events set scheduling_confirmed_at = null where id = p_event_id;
  end if;
end;
$$;

-- create_event_game  (원본: 0054)
create or replace function public.create_event_game(
  p_event_id uuid,
  p_club_id uuid,
  p_format text,
  p_participant_ids uuid[],
  p_teams text[],
  p_slots integer[],
  p_event_court_id uuid default null,
  p_event_session_id uuid default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_game_id uuid;
  v_position integer;
  v_session_starts_at timestamptz;
  v_session_ends_at timestamptz;
  v_constraint_name text;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  if p_created_by is not null then
    perform 1 from public.members where id = p_created_by and club_id = p_club_id;
    if not found then
      raise exception 'CREATED_BY_CLUB_MISMATCH';
    end if;
  end if;

  perform public._event_game_validate_placement(
    p_event_id, p_club_id, v_slot_mode, p_event_court_id, p_event_session_id
  );

  perform public._event_game_validate_players(
    p_event_id, p_club_id, p_format, p_participant_ids, p_teams, p_slots
  );

  if p_event_session_id is not null and v_slot_mode = 'timed' then
    select starts_at, ends_at into v_session_starts_at, v_session_ends_at
    from public.event_sessions
    where id = p_event_session_id and event_id = p_event_id and club_id = p_club_id;

    -- 신규 생성이라 자기 자신을 제외할 게임 id가 없다(p_exclude_game_id = null).
    perform public._event_game_check_time_conflict(
      p_event_id, null, p_participant_ids, v_session_starts_at, v_session_ends_at
    );
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id;

  -- unique_violation catch 범위를 이 INSERT 문 하나로만 좁히고, constraint
  -- 이름이 event_games_active_session_uniq일 때만 EVENT_GAME_SESSION_CONFLICT로
  -- 변환한다. 다른 unique 위반(예: event_game_players 쪽)은 원래 오류를 그대로
  -- 재발생시킨다.
  begin
    insert into public.event_games (
      event_id, club_id, event_court_id, event_session_id,
      format, status, source, position, created_by
    ) values (
      p_event_id, p_club_id, p_event_court_id, p_event_session_id,
      p_format, 'draft', 'manual', v_position, p_created_by
    )
    returning id into v_game_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'event_games_active_session_uniq' then
        raise exception 'EVENT_GAME_SESSION_CONFLICT';
      end if;
      raise;
  end;

  insert into public.event_game_players (event_game_id, event_id, club_id, event_participant_id, team, slot)
  select v_game_id, p_event_id, p_club_id, pid, team, slot
  from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot);

  return v_game_id;
end;
$$;

-- update_event_game  (원본: 0054)
create or replace function public.update_event_game(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_format_supplied boolean default false,
  p_format text default null,
  p_participant_ids uuid[] default null,
  p_teams text[] default null,
  p_slots integer[] default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_game public.event_games%rowtype;
  v_session_starts_at timestamptz;
  v_session_ends_at timestamptz;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
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
  if v_game.status <> 'draft' then
    raise exception 'EVENT_GAME_STRUCTURE_LOCKED';
  end if;

  if not p_format_supplied then
    -- 분기 2: format 변경 의도가 없다고 선언했는데 값이 온 것은 입력 계약 불일치.
    if p_format is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: p_format must be null when p_format_supplied is false';
    end if;
    -- 분기 1: format 변경 없음 + 선수 배열 3개 전부 미제공 → no-op.
    if p_participant_ids is not null or p_teams is not null or p_slots is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: use set_event_game_players to replace players without a format change';
    end if;
    return;
  end if;

  -- 분기 3: 변경 의도는 있는데 값이 null → "format을 null로 변경"은 명시적으로 거부.
  if p_format is null then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: format cannot be set to null';
  end if;

  if p_format = v_game.format then
    -- 분기 5: 같은 값으로의 "변경" 선언 + 선수 하나라도 제공 → set_event_game_players 영역.
    if p_participant_ids is not null or p_teams is not null or p_slots is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: use set_event_game_players to replace players without a format change';
    end if;
    -- 분기 4: 같은 값 + 선수 3개 전부 미제공 → 검증(위 단계까지) 후 no-op.
    return;
  end if;

  -- 분기 7: 실제로 다른 format인데 선수 배열 3개 중 하나라도 미제공 → 거부.
  if p_participant_ids is null or p_teams is null or p_slots is null then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: players are required when changing format';
  end if;

  -- 분기 6: 실제 변경. 카디널리티/참가자 유효성은 helper가 재검증.
  perform public._event_game_validate_players(
    p_event_id, p_club_id, p_format, p_participant_ids, p_teams, p_slots
  );

  if v_game.event_session_id is not null and v_slot_mode = 'timed' then
    select starts_at, ends_at into v_session_starts_at, v_session_ends_at
    from public.event_sessions
    where id = v_game.event_session_id and event_id = p_event_id and club_id = p_club_id;

    perform public._event_game_check_time_conflict(
      p_event_id, p_game_id, p_participant_ids, v_session_starts_at, v_session_ends_at
    );
  end if;

  update public.event_games
  set format = p_format, updated_at = now()
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id;

  delete from public.event_game_players where event_game_id = p_game_id;

  insert into public.event_game_players (event_game_id, event_id, club_id, event_participant_id, team, slot)
  select p_game_id, p_event_id, p_club_id, pid, team, slot
  from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot);
end;
$$;

-- set_event_game_players  (원본: 0054)
create or replace function public.set_event_game_players(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_participant_ids uuid[],
  p_teams text[],
  p_slots integer[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_game public.event_games%rowtype;
  v_session_starts_at timestamptz;
  v_session_ends_at timestamptz;
  v_diff_count integer;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
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
  if v_game.status <> 'draft' then
    raise exception 'EVENT_GAME_STRUCTURE_LOCKED';
  end if;

  perform public._event_game_validate_players(
    p_event_id, p_club_id, v_game.format, p_participant_ids, p_teams, p_slots
  );

  -- no-op 판정: (participant, team, slot) 집합이 현재와 완전히 동일하면 대칭차 0.
  -- EXCEPT/UNION ALL은 명시적 괄호 없이 좌결합이라(둘 다 동일 우선순위),
  -- 괄호를 생략하면 "((A except B) union all C) except D"로 묶여 대칭차가
  -- 아니게 된다 — 두 EXCEPT를 각각 괄호로 감싸 진짜 대칭차만 계산한다.
  select count(*) into v_diff_count
  from (
    (
      select event_participant_id, team, slot
      from public.event_game_players
      where event_game_id = p_game_id
      except
      select pid, team, slot from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot)
    )
    union all
    (
      select pid, team, slot from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot)
      except
      select event_participant_id, team, slot
      from public.event_game_players
      where event_game_id = p_game_id
    )
  ) d;

  if v_diff_count = 0 then
    return;
  end if;

  if v_game.event_session_id is not null and v_slot_mode = 'timed' then
    select starts_at, ends_at into v_session_starts_at, v_session_ends_at
    from public.event_sessions
    where id = v_game.event_session_id and event_id = p_event_id and club_id = p_club_id;

    perform public._event_game_check_time_conflict(
      p_event_id, p_game_id, p_participant_ids, v_session_starts_at, v_session_ends_at
    );
  end if;

  delete from public.event_game_players where event_game_id = p_game_id;

  insert into public.event_game_players (event_game_id, event_id, club_id, event_participant_id, team, slot)
  select p_game_id, p_event_id, p_club_id, pid, team, slot
  from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot);

  update public.event_games set updated_at = now() where id = p_game_id;
end;
$$;

-- place_event_game  (원본: 0054)
create or replace function public.place_event_game(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_event_court_id uuid,
  p_event_session_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_game public.event_games%rowtype;
  v_session_starts_at timestamptz;
  v_session_ends_at timestamptz;
  v_participant_ids uuid[];
  v_constraint_name text;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
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
  if v_game.status <> 'draft' then
    raise exception 'EVENT_GAME_STRUCTURE_LOCKED';
  end if;

  -- 요청된 코트·세션의 소속/활성/모드 검증을 no-op 판정보다 먼저 수행한다.
  perform public._event_game_validate_placement(
    p_event_id, p_club_id, v_slot_mode, p_event_court_id, p_event_session_id
  );

  if p_event_session_id is not null and v_slot_mode = 'timed' then
    select starts_at, ends_at into v_session_starts_at, v_session_ends_at
    from public.event_sessions
    where id = p_event_session_id and event_id = p_event_id and club_id = p_club_id;

    select array_agg(event_participant_id) into v_participant_ids
    from public.event_game_players
    where event_game_id = p_game_id;

    if v_participant_ids is not null then
      -- 자기 게임은 충돌 대상에서 제외(p_exclude_game_id = p_game_id).
      perform public._event_game_check_time_conflict(
        p_event_id, p_game_id, v_participant_ids, v_session_starts_at, v_session_ends_at
      );
    end if;
  end if;

  -- no-op 판정은 위 검증을 모두 통과한 뒤에만 수행한다 — 검증에 걸리는
  -- 배치는(코트 비활성화 등) 값이 같아도 여기서 no-op으로 새치기하지 않는다.
  if v_game.event_court_id is not distinct from p_event_court_id
     and v_game.event_session_id is not distinct from p_event_session_id
  then
    return;
  end if;

  -- unique_violation catch 범위를 이 UPDATE 문 하나로만 좁히고, constraint
  -- 이름을 확인해 event_games_active_session_uniq 위반일 때만
  -- EVENT_GAME_SESSION_CONFLICT로 변환한다. 다른 unique 위반은 원래 오류를
  -- 그대로 재발생시킨다(raise; — 인자 없는 RAISE는 현재 예외를 그대로 재발생).
  begin
    update public.event_games
    set event_court_id = p_event_court_id,
        event_session_id = p_event_session_id,
        updated_at = now()
    where id = p_game_id and event_id = p_event_id and club_id = p_club_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'event_games_active_session_uniq' then
        raise exception 'EVENT_GAME_SESSION_CONFLICT';
      end if;
      raise;
  end;
end;
$$;

-- reorder_event_games  (원본: 0054)
create or replace function public.reorder_event_games(
  p_event_id uuid,
  p_club_id uuid,
  p_game_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_desired_ids uuid[];
  v_len integer;
  v_distinct_len integer;
  v_current_order uuid[];
  v_offset bigint;
  v_id uuid;
  v_idx integer;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  if v_slot_mode <> 'none' then
    raise exception 'EVENT_GAME_REORDER_INVALID: reorder is only available in none mode';
  end if;

  if p_game_ids is null then
    raise exception 'EVENT_GAME_REORDER_INVALID: game ids array is required';
  end if;

  v_desired_ids := p_game_ids;

  v_len := array_length(v_desired_ids, 1);
  if v_len is not null then
    select count(distinct x) into v_distinct_len from unnest(v_desired_ids) as x;
    if v_distinct_len <> v_len then
      raise exception 'EVENT_GAME_REORDER_INVALID: duplicate id';
    end if;
  end if;

  -- 대상(none 모드 draft 실행 큐) 집합을 id 오름차순으로 잠근다(교착 방지, 0045/0051과 동일 원리).
  perform 1
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status = 'draft' and event_session_id is null
  order by id
  for update;

  select coalesce(array_agg(id order by position, id), array[]::uuid[])
    into v_current_order
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status = 'draft' and event_session_id is null;

  if (select coalesce(array_agg(x order by x), array[]::uuid[]) from unnest(v_current_order) as x)
     is distinct from
     (select coalesce(array_agg(x order by x), array[]::uuid[]) from unnest(v_desired_ids) as x)
  then
    raise exception 'EVENT_GAME_REORDER_INVALID: id set mismatch';
  end if;

  -- no-op: 집합만이 아니라 순서까지 현재와 완전히 동일.
  if v_current_order = v_desired_ids then
    return;
  end if;

  select coalesce(max(position), 0)::bigint + 1 into v_offset
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status = 'draft' and event_session_id is null;

  if v_offset + coalesce(array_length(v_desired_ids, 1), 0) > 2147483647 then
    raise exception 'EVENT_GAME_REORDER_INVALID: position overflow';
  end if;

  -- phase 1: 충돌 없는 임시 offset 구간으로 전원 이동
  update public.event_games eg
  set position = (v_offset + ord.rn - 1)::integer, updated_at = now()
  from unnest(v_desired_ids) with ordinality as ord(id, rn)
  where eg.id = ord.id;

  -- phase 2: 입력 배열 순서대로 최종 1..N 확정
  v_idx := 0;
  foreach v_id in array v_desired_ids loop
    v_idx := v_idx + 1;
    update public.event_games set position = v_idx, updated_at = now() where id = v_id;
  end loop;
end;
$$;

-- cancel_event_game  (원본: 0054)
create or replace function public.cancel_event_game(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_game_status text;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select status into v_game_status
  from public.event_games
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_GAME_NOT_FOUND';
  end if;

  if v_game_status = 'cancelled' then
    return;
  end if;
  if v_game_status <> 'draft' then
    raise exception 'EVENT_GAME_STRUCTURE_LOCKED';
  end if;

  update public.event_games
  set status = 'cancelled', updated_at = now()
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id;
end;
$$;

-- ============================================================
-- RPC 권한 — CREATE OR REPLACE는 기존 ACL을 보존하지만, 0051~0054 관례를
-- 따라 명시적으로 다시 선언한다. 재정의 전후로 owner(postgres)와 grant/revoke
-- 집합이 동일해야 한다.
-- ============================================================

-- private helper — 어떤 role에도 execute를 주지 않는다(호출은 SECURITY DEFINER
-- 공개 함수 내부에서만 일어난다).
revoke all on function public._event_game_validate_players(uuid, uuid, text, uuid[], text[], integer[])
from public, anon, authenticated, service_role;

revoke all on function public.create_event_court(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_event_court(uuid, uuid, text, integer) to service_role;

revoke all on function public.update_event_court(uuid, uuid, uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.update_event_court(uuid, uuid, uuid, text, integer, boolean) to service_role;

revoke all on function public.reorder_event_courts(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_event_courts(uuid, uuid, uuid[]) to service_role;

revoke all on function public.create_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.create_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, text) to service_role;

revoke all on function public.update_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, boolean, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.update_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, boolean, text, boolean, boolean) to service_role;

revoke all on function public.reorder_event_sessions(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_event_sessions(uuid, uuid, uuid, uuid[]) to service_role;

revoke all on function public.update_event(uuid, uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_event(uuid, uuid, text, date, text, jsonb) to service_role;

revoke all on function public.import_event_participants_from_attendance(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.import_event_participants_from_attendance(uuid, uuid, uuid) to service_role;

revoke all on function public.create_event_participant(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_event_participant(uuid, uuid, uuid, uuid) to service_role;

revoke all on function public.update_event_participant(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_event_participant(uuid, uuid, uuid, text) to service_role;

revoke all on function public.confirm_event_participants(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_event_participants(uuid, uuid) to service_role;

revoke all on function public.confirm_event_scheduling(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_event_scheduling(uuid, uuid) to service_role;

revoke all on function public.create_event_game(uuid, uuid, text, uuid[], text[], integer[], uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_event_game(uuid, uuid, text, uuid[], text[], integer[], uuid, uuid, uuid)
to service_role;

revoke all on function public.update_event_game(uuid, uuid, uuid, boolean, text, uuid[], text[], integer[])
from public, anon, authenticated;
grant execute on function public.update_event_game(uuid, uuid, uuid, boolean, text, uuid[], text[], integer[])
to service_role;

revoke all on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
from public, anon, authenticated;
grant execute on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
to service_role;

revoke all on function public.place_event_game(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.place_event_game(uuid, uuid, uuid, uuid, uuid)
to service_role;

revoke all on function public.reorder_event_games(uuid, uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.reorder_event_games(uuid, uuid, uuid[])
to service_role;

revoke all on function public.cancel_event_game(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.cancel_event_game(uuid, uuid, uuid)
to service_role;

commit;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- 이 migration은 스키마를 바꾸지 않고 함수 19개만 재정의한다. 되돌리려면
-- 아래 원본 정의를 그 파일에서 그대로 다시 실행하면 된다(CREATE OR REPLACE로
-- 바꿔 실행할 것 — 함수가 이미 존재하기 때문이다). 데이터 되돌림은 필요 없다.
--
--   0052_event_participants.sql        confirm_event_participants
--   0053_confirm_event_scheduling.sql  create_event_court, update_event_court,
--                                      reorder_event_courts, create_event_session,
--                                      update_event_session, reorder_event_sessions,
--                                      update_event,
--                                      import_event_participants_from_attendance,
--                                      create_event_participant,
--                                      update_event_participant,
--                                      confirm_event_scheduling
--   0054_event_games_foundation.sql    _event_game_validate_players,
--                                      create_event_game, update_event_game,
--                                      set_event_game_players, place_event_game,
--                                      reorder_event_games, cancel_event_game
--
-- 주의: rollback하면 Event completed 잠금과 status='confirmed' 배정 요구가
-- 되살아난다. 이미 Game 중심 흐름으로 운영된 Event(active pending 참가자가
-- Game에 배정된 상태)는 rollback 후 해당 Game의 선수 수정이
-- EVENT_GAME_PARTICIPANT_UNAVAILABLE로 실패할 수 있다. 저장된 데이터가
-- 깨지지는 않지만, 실행 전 영향 범위를 확인해야 한다.
