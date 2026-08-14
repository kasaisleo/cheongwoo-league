-- ============================================================
-- 0063: Event 운영 방식(slot_mode) 설정 경로 (Phase 2A-8C)
--
-- ------------------------------------------------------------
-- 배경
-- ------------------------------------------------------------
-- slot_mode는 0050부터 events.match_config에 존재하고 none/ordered/timed
-- 세 값이 Session·Game 배치 규칙 전체를 좌우하지만, 제품에는 이 값을 바꾸는
-- 경로가 없었다. Event 생성·수정 API가 p_match_config를 항상 null로 넘겨
-- 모든 Event가 클럽 기본값 none으로 고정돼 있었다(2A-8A 조사).
--
-- 이 migration은 그 설정 경로만 연다. Court·Session·Game을 만들거나 지우지
-- 않고, match_config의 다른 키도 건드리지 않는다.
--
-- ------------------------------------------------------------
-- 왜 update_event(p_match_config)를 쓰지 않는가
-- ------------------------------------------------------------
-- 기존 경로는 클라이언트가 보낸 match_config "전체"를 normalize_match_config로
-- 정규화해 통째로 덮어쓴다. 그래서
--   · 클라이언트가 모르는 키(court_count, auto_generation_enabled 등)가
--     기본값으로 되돌아갈 수 있고,
--   · 화면을 연 뒤 다른 곳에서 바뀐 값이 오래된 스냅샷으로 유실되며,
--   · slot_mode만 바꾸려는 요청이 다른 설정까지 수정할 권한을 갖게 된다.
-- 이 함수는 Event row를 잠근 뒤 "현재 저장된" match_config를 읽어 slot_mode
-- 키 하나만 jsonb_set으로 교체한다. 다른 키는 읽은 그대로 되돌려 쓴다.
--
-- ------------------------------------------------------------
-- 계약
-- ------------------------------------------------------------
-- [1] 입력은 DB canonical string만 받는다 — 'none' | 'ordered' | 'timed'.
--     null·공백·대소문자 변형을 보정하지 않고 CONFIG_INVALID_SLOT_MODE로
--     거부한다(0050 normalize_match_config와 같은 코드를 재사용).
--
-- [2] lifecycle (0062 계약 재사용)
--       draft·active   허용
--       completed      EVENT_STRUCTURE_LOCKED: event is completed
--       cancelled      EVENT_STRUCTURE_LOCKED
--
-- [3] 같은 값 재저장은 완전한 no-op — UPDATE 0건, updated_at·
--     scheduling_confirmed_at·다른 키 전부 불변. 전환 잠금 검사도 하지 않는다
--     (바뀌는 것이 없으므로 검사할 이유가 없고, 활성 슬롯이 있는 Event에서
--      현재 모드를 그대로 저장하는 것까지 막을 이유도 없다).
--
-- [4] 실제로 모드가 바뀔 때만 전환 잠금을 본다. 아래 중 하나라도 있으면 차단:
--       A. is_active = true 인 event_sessions 1건 이상
--          → EVENT_SLOT_MODE_LOCKED: active sessions exist
--       B. status <> 'cancelled' 이고 event_session_id 가 있는 event_games
--          1건 이상  → EVENT_SLOT_MODE_LOCKED: games are assigned to sessions
--     B는 inactive Session을 참조하는 Game까지 포함한다(A만으로는 슬롯을
--     비활성화한 뒤에도 Game이 그 슬롯을 붙들고 있는 상태를 놓친다 —
--     0058 update_event의 active-session-only guard보다 이 점에서 엄격하다).
--     cancelled Game의 과거 Session 참조는 이력일 뿐이라 막지 않는다.
--     Court만 배정되고 Session이 null인 Game도 막지 않는다(none 모드에서
--     정상적으로 생기는 상태다).
--
-- [5] 실제 변경 시 scheduling_confirmed_at = null. 이미 확정된 스케줄은 새
--     모드의 요구조건(ordered/timed는 활성 코트마다 활성 슬롯 필요)을 더 이상
--     만족하지 못하기 때문이다. 이미 null이면 그대로 null.
--     participants_confirmed_at · attendance timestamps · started_at ·
--     completed_at · status · Court/Session/Game/Participant/Match는 건드리지
--     않는다.
--
-- events_match_config_normalized CHECK(0050)가 최종 방어선이다 — jsonb_set
-- 결과가 정규화 형태가 아니면 UPDATE 자체가 실패하고 트랜잭션이 롤백된다.
-- 그래서 여기서 normalize를 다시 호출해 전체를 덮어쓰지 않는다.
--
-- ------------------------------------------------------------
-- [6] update_event 우회 차단 (2A-8C 보완)
-- ------------------------------------------------------------
-- 전용 RPC를 만들어도 기존 update_event(p_match_config)가 config 전체를
-- 덮어쓰는 한 slot_mode를 그 경로로 바꿀 수 있고, 그러면 위 [4] 전환 잠금이
-- 통째로 우회된다(활성 Session이나 Session 배정 Game이 있어도 바뀐다).
-- 그래서 이 migration은 update_event도 함께 재정의해, p_match_config가
-- 실제로 넘어온 경우 정규화된 신규 config의 slot_mode와 현재 Event의
-- slot_mode를 비교하고 다르면 어떤 DML보다 먼저 차단한다:
--
--   EVENT_SLOT_MODE_DEDICATED_PATH_REQUIRED
--
--   · p_match_config = null            → title/date/status 수정 기존 그대로
--   · slot_mode 동일                    → 다른 config 키 수정 기존 그대로
--   · slot_mode 상이                    → 무조건 차단
--   · 호출자가 slot_mode 키를 누락해 normalize 결과가 기본 'none'이 되는
--     경우도 현재 값과 다르면 차단된다(비교 대상이 normalize 이후 값이므로).
--
-- update_event의 signature·return type은 바뀌지 않는다. 0062의 완료 guard
-- (EVENT_COMPLETION_NO_GAMES / EVENT_COMPLETION_GAMES_INCOMPLETE),
-- status 전이 규칙, completed → active, completed_at 계약, cancelled
-- terminal, Event row FOR UPDATE, Club/Event scope는 전부 그대로다.
-- 본문은 0062 정의를 프로그램으로 추출해 guard만 삽입했고, 원본 코드 줄은
-- 하나도 삭제하지 않았다.
--
-- 이 파일이 정의하는 함수는 정확히 2개다:
--   update_event_slot_mode  (신규)
--   update_event            (0062 기준 재정의)
--
-- 스키마·인덱스·제약 변경 없음. 그 밖의 함수 재정의 없음. backfill 없음.
-- ============================================================

begin;

create function public.update_event_slot_mode(
  p_event_id uuid,
  p_club_id uuid,
  p_slot_mode text
) returns table(
  event_id uuid,
  slot_mode text,
  scheduling_confirmed_at timestamptz,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_config jsonb;
  v_current text;
  v_scheduling timestamptz;
  v_active_sessions integer;
  v_session_games integer;
  v_new_config jsonb;
begin
  -- ----------------------------------------------------------
  -- [1] 입력 검증 — 잠금·조회 이전에 fail-fast.
  --     보정하지 않는다: ' none ', 'None', 'NONE' 전부 거부.
  -- ----------------------------------------------------------
  if p_slot_mode is null then
    raise exception 'CONFIG_INVALID_SLOT_MODE: slot mode is required';
  end if;
  if p_slot_mode not in ('none', 'ordered', 'timed') then
    raise exception 'CONFIG_INVALID_SLOT_MODE: %', p_slot_mode;
  end if;

  -- ----------------------------------------------------------
  -- [2] Event row 잠금 — id + club_id scope.
  --     update_event / 구조 mutation / 결과 RPC가 모두 같은 row를 FOR UPDATE
  --     하므로 같은 Event에 대한 요청은 전부 직렬화된다. 현재 slot_mode와
  --     전환 잠금 대상을 이 잠금 "이후에" 읽으므로, 두 요청이 같은 이전 값을
  --     보고 서로의 변경을 덮어쓰는 창이 없다.
  --     OUT 파라미터(event_id 등)와 테이블 컬럼이 겹치므로 모든 컬럼 참조에
  --     별칭을 붙인다(0059에서 겪은 ambiguous column 재발 방지).
  -- ----------------------------------------------------------
  select e.status, e.match_config, e.scheduling_confirmed_at
    into v_status, v_config, v_scheduling
  from public.events e
  where e.id = p_event_id and e.club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  if v_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
  end if;

  v_current := v_config->>'slot_mode';

  -- ----------------------------------------------------------
  -- [3] no-op — 어떤 DML도 실행하지 않고 현재값을 그대로 돌려준다.
  -- ----------------------------------------------------------
  if v_current is not distinct from p_slot_mode then
    event_id := p_event_id;
    slot_mode := v_current;
    scheduling_confirmed_at := v_scheduling;
    changed := false;
    return next;
    return;
  end if;

  -- ----------------------------------------------------------
  -- [4] 전환 잠금 — 모드가 실제로 바뀔 때만 본다.
  -- ----------------------------------------------------------
  select count(*) into v_active_sessions
  from public.event_sessions es
  where es.event_id = p_event_id and es.club_id = p_club_id and es.is_active;

  if v_active_sessions > 0 then
    raise exception 'EVENT_SLOT_MODE_LOCKED: active sessions exist';
  end if;

  -- inactive Session을 참조하는 Game도 포함한다. cancelled Game은 제외.
  select count(*) into v_session_games
  from public.event_games g
  where g.event_id = p_event_id and g.club_id = p_club_id
    and g.status <> 'cancelled'
    and g.event_session_id is not null;

  if v_session_games > 0 then
    raise exception 'EVENT_SLOT_MODE_LOCKED: games are assigned to sessions';
  end if;

  -- ----------------------------------------------------------
  -- [5] slot_mode 키 하나만 교체한다.
  --     나머지 13개 키는 방금 읽은 값을 그대로 되돌려 쓴다 — 기본값으로
  --     재설정되지 않는다. create_if_missing = true(기본)로 두어 키가 없는
  --     비정상 config에서도 값이 설정되게 한다(그 경우 CHECK가 최종 판정).
  -- ----------------------------------------------------------
  v_new_config := jsonb_set(v_config, '{slot_mode}', to_jsonb(p_slot_mode));

  update public.events e
  set match_config = v_new_config,
      scheduling_confirmed_at = null,
      updated_at = now()
  where e.id = p_event_id and e.club_id = p_club_id;

  event_id := p_event_id;
  slot_mode := p_slot_mode;
  scheduling_confirmed_at := null;
  changed := true;
  return next;
end;
$$;

-- 0051~0062 관례와 동일 — service_role만 실행 가능.
revoke all on function public.update_event_slot_mode(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.update_event_slot_mode(uuid, uuid, text)
to service_role;

comment on function public.update_event_slot_mode(uuid, uuid, text) is
'Event의 운영 방식(match_config.slot_mode)만 원자적으로 교체한다(2A-8C).
Event row를 잠근 뒤 저장된 match_config를 읽어 slot_mode 키 하나만 jsonb_set
으로 바꾸므로 다른 13개 키는 절대 변하지 않는다. 같은 값 재저장은 DML 없이
changed=false를 반환한다. 모드가 실제로 바뀔 때만 활성 Session(1건 이상)과
Session에 배정된 non-cancelled Game(1건 이상)을 검사해 차단하고, 성공 시
scheduling_confirmed_at을 null로 무효화한다. completed/cancelled Event는
차단하며 Court·Session·Game·Participant·Match는 건드리지 않는다.';


-- ============================================================
-- update_event 재정의  (원본: 0062 — 완료 guard를 포함한 최신 정의)
-- ============================================================
-- 0062 본문을 프로그램으로 추출해 우회 차단 guard만 기계적으로 삽입했다.
-- signature·return type·완료 guard·status 전이·timestamp 계약은 전부 그대로다.
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

    -- ★ 2A-8C 보완: slot_mode 변경은 이 경로로 할 수 없다.
    -- update_event는 config 전체를 통째로 받으므로, 여기서 slot_mode가
    -- 바뀌면 update_event_slot_mode(0063)의 전환 잠금(활성 Session·Session에
    -- 배정된 Game)을 통째로 우회하게 된다. 그래서 "실제로 값이 달라지는"
    -- 경우를 어떤 DML보다 먼저 차단한다.
    -- 호출자가 신규 config에서 slot_mode 키를 누락해 normalize 결과가 기본
    -- 'none'이 되는 경우도 현재 값과 다르면 여기에 걸린다(normalize를 이미
    -- 거친 v_new_config로 비교하기 때문이다).
    -- slot_mode가 같으면 기존 계약 그대로 다른 config 키를 수정할 수 있다.
    if (v_new_config->>'slot_mode') is distinct from (v_event.match_config->>'slot_mode') then
      raise exception 'EVENT_SLOT_MODE_DEDICATED_PATH_REQUIRED';
    end if;

    -- 아래 2A-5C 블록은 위 차단 때문에 더 이상 도달할 수 없다(조건이 같다).
    -- 0062 정의를 한 줄도 잃지 않기 위해 지우지 않고 그대로 둔다 —
    -- v_slot_mode_changed는 이제 항상 false이므로 함수 끝의
    -- scheduling_confirmed_at 무효화도 이 경로에서는 실행되지 않는다.

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

commit;

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
--   drop function public.update_event_slot_mode(uuid, uuid, text);
--   그리고 0062의 update_event 정의를 그대로 다시 실행한다
--   (0062는 이미 create or replace 형태다).
--
-- 스키마를 바꾸지 않고 데이터도 쓰지 않으므로 위 둘만 되돌리면 0062 상태로
-- 완전히 돌아간다. 단 이 migration으로 이미 바뀐 Event의 slot_mode는 그대로
-- 남는다(그 값 자체는 0050부터 유효한 값이므로 다른 계약을 깨지 않는다).
--
-- 주의: update_event만 되돌리면 p_match_config로 slot_mode를 바꾸는 우회
-- 경로가 다시 열려 update_event_slot_mode의 전환 잠금이 무력화된다.
-- 두 함수는 함께 되돌려야 한다.
