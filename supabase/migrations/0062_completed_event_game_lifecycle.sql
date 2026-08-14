-- ============================================================
-- 0062: completed Event lifecycle 잠금 (Phase 2A-8B-3B)
--
-- ------------------------------------------------------------
-- 배경
-- ------------------------------------------------------------
-- 0058이 Event 전체 구조 잠금을 cancelled 하나로 축소한 뒤, completed Event
-- 에서도 대진 구조를 바꿀 수 있는 상태가 남아 있었다. 2A-8B-3A 격리 DB 실측
-- 결과 9개 Game mutation 중 8개가 completed Event에서 실제로 정상 mutation
-- 됐다(ensure_event_game_count만 0061에서 이미 차단). 또 Event 완료에는
-- 전제조건이 전혀 없어 Game 0건이나 선수 미배정 빈 Game이 남은 상태로도
-- 완료할 수 있었다.
--
-- 이 migration은 그 두 공백을 닫는다.
--
-- ------------------------------------------------------------
-- 확정 정책 (2A-8B-3B)
-- ------------------------------------------------------------
-- [1] Event 완료 조건 — update_event(p_status='completed')
--     · non-cancelled Game이 1건 이상 있어야 한다        → 없으면 EVENT_COMPLETION_NO_GAMES
--     · non-cancelled Game 전부가 status='completed'여야 한다
--       (draft·in_progress가 하나라도 있으면 차단. 선수 미배정 빈 draft Game도
--        미완료로 센다)                                   → EVENT_COMPLETION_GAMES_INCOMPLETE
--     · 따라서 Game 0건 Event는 completed로 갈 수 없다.
--
-- [2] completed Event 구조 잠금 — 아래 6개 함수에서 차단
--       create_event_game / update_event_game(format) / set_event_game_players
--       place_event_game / reorder_event_games / cancel_event_game
--     ensure_event_game_count(0061)은 이미 차단하므로 재정의하지 않는다.
--     오류 코드는 EVENT_STRUCTURE_LOCKED에 하위 이유를 붙인다:
--       'EVENT_STRUCTURE_LOCKED: event is completed'
--     (cancelled는 접미사 없는 기존 형태를 그대로 유지 — API가 두 경우의
--      문구를 구분할 수 있다.)
--
-- [3] completed Event 결과 정책 — save_event_game_result
--     · 기존 결과 "정정"만 허용한다. 인정 조건은 둘 다 충족일 때뿐:
--         Game status = 'completed'  AND  연결된 matches row 정확히 1건
--     · 그 밖(=draft/in_progress Game에 최초 입력)은 차단
--                                                        → EVENT_RESULT_FIRST_SAVE_LOCKED
--     · 정정 자체의 동작은 바꾸지 않는다 — 기존 효과 undo → 새 효과 apply를
--       같은 트랜잭션에서 수행하고 Match는 1건을 유지한다.
--
-- [4] completed Event 결과 초기화 — clear_event_game_result
--     · linked Match 존재 여부와 무관하게 차단          → EVENT_RESULT_CLEAR_LOCKED
--     · Game·Match를 조회하기도 전에 막으므로 어떤 행도 잠기지 않는다.
--
-- [5] 재활성화 — completed → active (기존 계약 유지)
--     · completed_at = null
--     · Game·결과·Match·effect 전부 유지
--     · 이후 구조 변경·최초 결과 입력·결과 초기화가 다시 가능해진다
--     completed_at은 "현재 완료 상태에 진입한 시각"으로 해석한다. 최초 완료
--     이력 보존은 이번 범위 밖이며 컬럼을 추가하지 않는다.
--
-- [6] cancelled Event — 기존대로 모든 Game mutation 차단(terminal).
--
-- draft/active Event의 모든 동작은 바뀌지 않는다.
--
-- ------------------------------------------------------------
-- 재정의 함수 9개와 각각의 "원본" migration
-- ------------------------------------------------------------
--   update_event              0058
--   create_event_game         0058
--   update_event_game         0058
--   set_event_game_players    0058
--   place_event_game          0058
--   cancel_event_game         0058
--   reorder_event_games       0060  ★ 0058이 아니다
--   save_event_game_result    0059
--   clear_event_game_result   0059
--   ensure_event_game_count   재정의하지 않음 (0061 유지)
--
-- 본문은 손으로 재작성하지 않았다. 위 원본에서 프로그램으로 정의를 추출하고
-- guard만 기계적으로 삽입한 뒤, 원본과 신규를 줄 단위 multiset으로 대조해
-- "삭제·변형된 줄 0건 / 추가된 줄은 전부 guard·주석·선언"임을 검증했다.
-- 특히 reorder_event_games는 0060 정의(Event 전체 max(position) 기준,
-- bigint overflow 방어, 단일 scoped UPDATE)를 원본으로 사용했다 — 0058에서
-- 복사하면 position 충돌 수정이 유실된다.
--
-- 스키마·인덱스·제약 변경 없음. 데이터 변경(backfill) 없음.
-- 함수 시그니처·반환 타입 변경 없음.
-- ============================================================

begin;

-- ============================================================
-- update_event  (원본: 0058)
-- ============================================================
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
  v_completable_game_count integer;
  v_unfinished_game_count integer;
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
      -- ★ 2A-8B-3B: 완료 전제조건.
      --   · non-cancelled Game이 1건도 없으면 완료할 것이 없다.
      --   · non-cancelled Game 중 completed가 아닌 것이 하나라도 있으면
      --     완료할 수 없다(draft·in_progress 모두 포함되며, 선수 미배정
      --     빈 draft Game도 그대로 미완료로 센다).
      -- 이 블록은 "p_status <> 현재 status"인 전이에서만 실행되므로
      -- completed → completed 재저장은 여기까지 오지 않는다(재검증도
      -- timestamp 변경도 없다 — 기존 계약 그대로).
      -- Event row는 이미 위에서 FOR UPDATE로 잠겨 있고, Game 조회에는
      -- event_id + club_id scope를 모두 적용한다.
      select
        count(*) filter (where g.status <> 'cancelled'),
        count(*) filter (where g.status <> 'cancelled' and g.status <> 'completed')
      into v_completable_game_count, v_unfinished_game_count
      from public.event_games g
      where g.event_id = p_event_id and g.club_id = p_club_id;

      if v_completable_game_count = 0 then
        raise exception 'EVENT_COMPLETION_NO_GAMES';
      end if;
      if v_unfinished_game_count > 0 then
        raise exception 'EVENT_COMPLETION_GAMES_INCOMPLETE: % game(s) not completed', v_unfinished_game_count;
      end if;

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

revoke all on function public.update_event(uuid, uuid, text, date, text, jsonb)
from public, anon, authenticated;
grant execute on function public.update_event(uuid, uuid, text, date, text, jsonb)
to service_role;


-- ============================================================
-- create_event_game  (원본: 0058)
-- ============================================================
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

revoke all on function public.create_event_game(uuid, uuid, text, uuid[], text[], integer[], uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_event_game(uuid, uuid, text, uuid[], text[], integer[], uuid, uuid, uuid)
to service_role;


-- ============================================================
-- update_event_game  (원본: 0058)
-- ============================================================
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

revoke all on function public.update_event_game(uuid, uuid, uuid, boolean, text, uuid[], text[], integer[])
from public, anon, authenticated;
grant execute on function public.update_event_game(uuid, uuid, uuid, boolean, text, uuid[], text[], integer[])
to service_role;


-- ============================================================
-- set_event_game_players  (원본: 0058)
-- ============================================================
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

revoke all on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
from public, anon, authenticated;
grant execute on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
to service_role;


-- ============================================================
-- place_event_game  (원본: 0058)
-- ============================================================
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

revoke all on function public.place_event_game(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.place_event_game(uuid, uuid, uuid, uuid, uuid)
to service_role;


-- ============================================================
-- reorder_event_games  (원본: 0060)
-- ============================================================
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
  v_event_max bigint;
  v_target_count bigint;
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

  -- ★ 0060: 큐가 아니라 Event 전체 게임의 최대 position을 기준으로 삼는다.
  -- 큐 기준으로 계산하면 completed/cancelled 게임의 position을 지나칠 수 있어
  -- 최종 1..N 부여 시 그 값과 충돌했다.
  select coalesce(max(position), 0)::bigint into v_event_max
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id;

  v_target_count := coalesce(array_length(v_desired_ids, 1), 0)::bigint;

  -- overflow 검사는 offset이 아니라 "최종 최대값"을 본다. 좌변 전체가 bigint로
  -- 계산되므로 검사 도중에 int4 overflow가 먼저 터지지 않는다. 초과 시 UPDATE
  -- 이전에 예외를 던지므로 부분 update가 남지 않는다.
  if v_event_max + v_target_count > 2147483647 then
    raise exception 'EVENT_GAME_REORDER_INVALID: position overflow';
  end if;

  -- 단일 UPDATE — 목표 구간(eventMax+1 .. eventMax+N)이 기존 모든 position보다
  -- 크므로 임시 이동 단계가 필요 없다. id뿐 아니라 event_id/club_id까지 조건에
  -- 넣어 UPDATE 자체도 Club/Event 경계를 강제한다(위 집합 일치 검증과 이중 방어).
  update public.event_games eg
  set position = (v_event_max + ord.rn)::integer, updated_at = now()
  from unnest(v_desired_ids) with ordinality as ord(id, rn)
  where eg.id = ord.id
    and eg.event_id = p_event_id
    and eg.club_id = p_club_id;
end;
$$;

revoke all on function public.reorder_event_games(uuid, uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.reorder_event_games(uuid, uuid, uuid[])
to service_role;


-- ============================================================
-- cancel_event_game  (원본: 0058)
-- ============================================================
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
  -- ★ 2A-8B-3B: completed Event 구조 잠금. 하위 이유를 붙여 bulk 전용이
  -- 아닌 일반 구조 변경임을 API가 구분할 수 있게 한다. Game DML과 그 밖의
  -- 모든 추가 검증보다 먼저 실행되므로, 차단 시 어떤 행도 바뀌지 않는다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
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

revoke all on function public.cancel_event_game(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.cancel_event_game(uuid, uuid, uuid)
to service_role;


-- ============================================================
-- save_event_game_result  (원본: 0059)
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

revoke all on function public.save_event_game_result(uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid)
from public, anon, authenticated;
grant execute on function public.save_event_game_result(uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, integer, integer, integer, uuid)
to service_role;


-- ============================================================
-- clear_event_game_result  (원본: 0059)
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

revoke all on function public.clear_event_game_result(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.clear_event_game_result(uuid, uuid, uuid)
to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
-- 각 함수의 원본 정의를 그대로 다시 실행하면 된다.
--   0058: update_event / create_event_game / update_event_game /
--         set_event_game_players / place_event_game / cancel_event_game
--   0059: save_event_game_result / clear_event_game_result
--   0060: reorder_event_games      ★ 0058이 아니다
-- 0058/0060은 이미 create or replace 형태이고, 0059는 create function이므로
-- rollback 시 create or replace로 바꿔 실행해야 한다.
--
-- 스키마 변경이 없으므로 데이터 되돌림은 필요 없다. 단 rollback하면
-- completed Event에서 대진 구조 변경·최초 결과 입력·결과 초기화가 다시
-- 열리고, Game이 0건이거나 미완료 Game이 남은 Event도 완료할 수 있게 된다.
