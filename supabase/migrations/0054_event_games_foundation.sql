-- ============================================================
-- 0054: event_games + event_game_players (Match System 2.0 Phase 2A-6B-1)
--
-- 계층: Event -> Event Court -> Event Session -> Event Game(이번 phase) -> Event Game Player
--
-- 배경(2A-6A 조사 결론 반영):
--   - 레거시 matches(8-슬롯 컬럼, 상태 없음, 완료-즉시-랭킹반영 모델)는
--     확장하지 않는다. 신규 event_games/event_game_players만 사용한다.
--   - legacy 랭킹·경기 기록 연결, 대진 확정(games_confirmed_at), 자동 편성,
--     결과 입력·검수는 전부 이번 phase 범위 밖이며 이 migration은 건드리지
--     않는다.
--
-- 상태 모델: draft/in_progress/completed/cancelled 4개를 컬럼 CHECK에 전부
--   포함하되(스키마는 미래 상태 대비), 이번 phase의 RPC가 실제로 만들 수
--   있는 전이는 생성(항상 draft)과 취소(draft -> cancelled)뿐이다.
--   in_progress/completed로 전환하는 RPC는 아직 존재하지 않으므로, 그
--   상태들은 스키마상 가능하지만 이번 phase의 어떤 API 경로로도 도달할 수
--   없다(다음 phase에서 진행/완료 RPC가 추가되기 전까지).
--
-- event_court_id/event_session_id를 둘 다 유지하는 이유: none 모드는
--   "코트만 지정, 슬롯 없음" 배치를 허용해야 하므로 court 참조만으로도
--   유효한 배치가 성립해야 한다. session이 있으면 court도 항상 있어야
--   한다는 불변식은 event_games_session_requires_court_check(테이블
--   CHECK)로 강제하고, session이 실제로 그 court에 속하는지는
--   event_games_session_court_fk(4컬럼 복합 FK, 아래)로 DB가 강제한다.
--
-- event_sessions에 신규 unique(id, event_court_id, event_id, club_id)를
--   추가하는 이유: id는 이미 PK라 그 자체로 유일하지만, Postgres FK는
--   참조 대상 컬럼 목록과 정확히 일치하는 unique/PK 제약이 있어야 한다.
--   기존 unique(id, event_id, club_id)는 event_court_id를 포함하지 않아
--   이 4컬럼 조합의 FK 대상으로 쓸 수 없다 — 새 데이터 무결성을 추가하는
--   것이 아니라(id 단독으로 이미 충분히 유일), event_games의 4컬럼 복합
--   FK가 "session이 이 court에 속함"까지 한 번에 강제하도록 하기 위한
--   순수 구조적 요구사항이다.
--
-- 잠금 순서(전역 규칙 승계): 이 migration의 모든 mutation RPC는 예외 없이
--   public.events 행을 FOR UPDATE로 먼저 잠근다(0051/0052/0053과 동일한
--   전역 규칙). court/session 계열이 FOR SHARE를 쓰는 경우가 있던 것과
--   달리, game 계열은 전부 FOR UPDATE로 통일한다 — 같은 이벤트에 대한
--   동시 게임 배치/선수 교체/참가자·코트·슬롯 변경이 전부 이 하나의 행
--   잠금으로 직렬화되어야 하기 때문이다(요청 사항 5,7 — 동일 session
--   동시 배치, 동일 참가자 timed 중복 배치, 게임 mutation과 참가자·코트·
--   슬롯 mutation 경쟁을 모두 이 잠금이 방어).
--
-- 참가자 재검증: event_participant_id FK는 "그 행이 존재한다"만 보장하고
--   "지금 confirmed/active 상태인가"는 보장할 수 없다(CHECK는 다른 행을
--   볼 수 없음, 2A-6A 조사 결론). 그래서 모든 생성·선수교체 RPC가 매번
--   _event_game_validate_players로 그 시점의 status/is_active를 재조회
--   한다. 참가자가 이후 withdrawn/excluded로 바뀌어 draft 게임에 그대로
--   남는 문제는 이번 phase에서 자동 삭제/제거하지 않는다(2A-6C에서
--   games_confirmed_at 무효화 및 재확정 검증으로 처리 예정).
--
-- 오류 코드 관례: 0050 교정 이후 관례(UUID/이름을 오류 메시지에 절대
--   보간하지 않음)를 그대로 따른다. EVENT_GAME_* 접두사로 court/session/
--   participant 도메인 코드와 겹치지 않게 한다.
-- ============================================================

begin;

-- ============================================================
-- 1) event_sessions — game FK 매칭을 위한 구조적 unique 추가(§배경 참고)
-- ============================================================
alter table public.event_sessions
  add constraint event_sessions_id_court_event_club_uniq
  unique (id, event_court_id, event_id, club_id);

-- ============================================================
-- 2) event_games
-- ============================================================
create table public.event_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  club_id uuid not null,
  event_court_id uuid,
  event_session_id uuid,
  format text not null,
  status text not null default 'draft',
  source text not null default 'manual',
  position integer not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_games_format_check check (format in ('singles', 'doubles')),
  constraint event_games_status_check check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  constraint event_games_source_check check (source in ('manual', 'auto')),
  constraint event_games_position_positive check (position >= 1),
  constraint event_games_session_requires_court_check
    check (event_session_id is null or event_court_id is not null),

  constraint event_games_id_event_club_uniq unique (id, event_id, club_id),
  constraint event_games_event_club_fk
    foreign key (event_id, club_id) references public.events (id, club_id),
  constraint event_games_court_fk
    foreign key (event_court_id, event_id, club_id)
    references public.event_courts (id, event_id, club_id),
  constraint event_games_session_court_fk
    foreign key (event_session_id, event_court_id, event_id, club_id)
    references public.event_sessions (id, event_court_id, event_id, club_id)
);

comment on table public.event_games is
  'Match System 2.0 — Event 안의 개별 게임(0054). 레거시 matches(완료-즉시
   기록)와 무관한 신규 계층 — draft로 생성되어 배치·선수 구성을 자유롭게
   조정하다가, 이후 phase(2A-6C+)에서 in_progress/completed로 전환되고
   결과·랭킹에 연결된다. event_court_id만 있고 event_session_id가 없는
   행은 none 모드의 "코트만 배정, 슬롯 없음" 상태다. 삭제 RPC 없음 —
   is_active 컬럼이 없는 대신 status=cancelled로만 종료 처리한다(cancelled
   게임도 이력으로 영구 보존).';

alter table public.event_games
  add constraint event_games_created_by_club_fk
  foreign key (club_id, created_by) references public.members (club_id, id);
-- MATCH SIMPLE(기본값) — created_by가 null이면 이 FK는 검사되지 않는다(events와 동일 관례).

-- non-cancelled 게임은 한 session에 최대 1개(요청 사항 2) — session_id가
-- 있는 행끼리만, cancelled는 예외(취소된 게임이 자리를 계속 점유하지 않음).
create unique index event_games_active_session_uniq
  on public.event_games (event_session_id)
  where event_session_id is not null and status <> 'cancelled';

-- reorder_event_games가 대상으로 삼는 "none 모드 draft 실행 큐"에서만
-- position 충돌을 막는다 — 이 큐는 완전 미배치 게임(court/session 둘 다
-- null)과 court만 지정된 게임을 모두 포함한다(2A-6B-1 재감사로 명확화 —
-- event_court_id 유무와 무관하게 event_session_id가 null이면 이 하나의
-- 전역 실행 큐에 속한다). ordered/timed로 배치된 게임은 session의
-- position/time이 실행 순서의 유일한 근거이므로(요청 사항 8) 이 unique
-- 범위에 들어가지 않는다. 이 partial unique index가 있어야
-- reorder_event_games가 기존 court/session reorder와 동일한 2단계 offset
-- 재배치 알고리즘을 쓸 이유가 생긴다(unique 충돌이 없다면 그 알고리즘
-- 자체가 불필요하기 때문). reorder_event_games 자체도 slot_mode='none'일
-- 때만 실행되도록 RPC 내부에서 강제한다.
create unique index event_games_unplaced_position_uniq
  on public.event_games (event_id, position)
  where status = 'draft' and event_session_id is null;

create index event_games_event_status_idx on public.event_games (event_id, status);
create index event_games_court_idx on public.event_games (event_court_id) where event_court_id is not null;

alter table public.event_games enable row level security;
-- 정책 0개 — anon/authenticated는 GRANT 자체가 없어 정책 여부와 무관하게 접근 불가.
revoke all on public.event_games from public, anon, authenticated, service_role;
grant select on public.event_games to service_role;
-- INSERT/UPDATE/DELETE는 어떤 role에도 부여하지 않는다 — 쓰기는 아래 RPC 전용.

-- ============================================================
-- 3) event_game_players
-- ============================================================
create table public.event_game_players (
  id uuid primary key default gen_random_uuid(),
  event_game_id uuid not null,
  event_id uuid not null,
  club_id uuid not null,
  event_participant_id uuid not null,
  team text not null,
  slot integer not null,
  created_at timestamptz not null default now(),

  constraint event_game_players_team_check check (team in ('A', 'B')),
  constraint event_game_players_slot_check check (slot in (1, 2)),
  constraint event_game_players_game_team_slot_uniq unique (event_game_id, team, slot),
  constraint event_game_players_game_participant_uniq unique (event_game_id, event_participant_id),
  constraint event_game_players_game_fk
    foreign key (event_game_id, event_id, club_id)
    references public.event_games (id, event_id, club_id),
  constraint event_game_players_participant_fk
    foreign key (event_participant_id, event_id, club_id)
    references public.event_participants (id, event_id, club_id)
);

comment on table public.event_game_players is
  'Match System 2.0 — event_games의 선수 슬롯(0054). member/guest 전용 컬럼을
   따로 두지 않는다 — event_participant_id 하나가 이미 event_participants에서
   member/guest를 통합한 identity이므로 그대로 참조한다(레거시 matches의
   8-슬롯 member/guest 쌍 컬럼 방식과 의도적으로 다름, 2A-6A 조사 결론).
   singles/doubles별 정원(2명/4명)과 팀당 인원(1명/2명)은 이 테이블의 CHECK
   만으로 강제할 수 없다(다른 행 집계가 필요) — create_event_game/
   update_event_game/set_event_game_players가 매번 재검증한다.';

create index event_game_players_participant_idx on public.event_game_players (event_participant_id);

alter table public.event_game_players enable row level security;
revoke all on public.event_game_players from public, anon, authenticated, service_role;
grant select on public.event_game_players to service_role;

-- ============================================================
-- 4) 비공개 helper 3종(SECURITY DEFINER 아님, EXECUTE 전부 revoke) —
--    0045/0051/0052의 private helper 패턴과 동일 원리. 함수 소유자
--    (postgres)가 SECURITY DEFINER 외부 함수 내부에서 호출하면 revoke와
--    무관하게 정상 동작한다.
-- ============================================================

-- 4-1) 배치(court/session) 유효성 검증 — create_event_game/place_event_game 공유.
create function public._event_game_validate_placement(
  p_event_id uuid,
  p_club_id uuid,
  p_slot_mode text,
  p_event_court_id uuid,
  p_event_session_id uuid
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_court_is_active boolean;
  v_session_court_id uuid;
  v_session_is_active boolean;
  v_session_starts_at timestamptz;
begin
  -- 미배치로 되돌리는 것(둘 다 null)은 모드 무관 draft에서 항상 허용.
  if p_event_court_id is null and p_event_session_id is null then
    return;
  end if;

  if p_event_session_id is not null and p_event_court_id is null then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: session requires a court';
  end if;

  if p_event_court_id is not null then
    select is_active into v_court_is_active
    from public.event_courts
    where id = p_event_court_id and event_id = p_event_id and club_id = p_club_id;

    if not found then
      raise exception 'EVENT_GAME_COURT_UNAVAILABLE: court not found';
    end if;
    if not v_court_is_active then
      raise exception 'EVENT_GAME_COURT_UNAVAILABLE: court inactive';
    end if;
  end if;

  if p_slot_mode = 'none' then
    if p_event_session_id is not null then
      raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: none mode does not use sessions';
    end if;
    return;
  end if;

  -- ordered / timed: 실제 배치(둘 다 null이 아닌 경우)에는 court+session 둘 다 필수.
  if p_event_session_id is null then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: this mode requires a session to place a game';
  end if;

  select event_court_id, is_active, starts_at
    into v_session_court_id, v_session_is_active, v_session_starts_at
  from public.event_sessions
  where id = p_event_session_id and event_id = p_event_id and club_id = p_club_id;

  if not found then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: session not found';
  end if;
  if v_session_court_id <> p_event_court_id then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: session does not belong to the given court';
  end if;
  if not v_session_is_active then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: session inactive';
  end if;

  if p_slot_mode = 'ordered' and v_session_starts_at is not null then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: ordered mode session must not have a time range';
  end if;
  if p_slot_mode = 'timed' and v_session_starts_at is null then
    raise exception 'EVENT_GAME_SESSION_UNAVAILABLE: timed mode session must have a time range';
  end if;
end;
$$;

revoke all on function public._event_game_validate_placement(uuid, uuid, text, uuid, uuid)
from public, anon, authenticated, service_role;

-- 4-2) 선수 구성 유효성 검증 — create_event_game/update_event_game/set_event_game_players 공유.
--      participant id/team/slot을 병렬 배열로 받는다(레거시 matches의 8-슬롯
--      컬럼 방식이 아니라, event_game_players insert와 그대로 zip되는 구조).
create function public._event_game_validate_players(
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
      and ep.status = 'confirmed'
      and ep.is_active
  );
  if v_unavailable_count > 0 then
    raise exception 'EVENT_GAME_PARTICIPANT_UNAVAILABLE: participant not confirmed/active/in-club';
  end if;
end;
$$;

revoke all on function public._event_game_validate_players(uuid, uuid, text, uuid[], text[], integer[])
from public, anon, authenticated, service_role;

-- 4-3) timed 모드 동시간대 중복 배치 검증 — place_event_game/set_event_game_players/
--      update_event_game 공유. 호출부가 이미 events 행을 FOR UPDATE로 잠근
--      뒤이므로, 이 SELECT는 같은 이벤트에 대한 유일한 쓰기 트랜잭션 안에서
--      실행되어 동시성 경합이 없다(§잠금 순서 참고).
create function public._event_game_check_time_conflict(
  p_event_id uuid,
  p_exclude_game_id uuid,
  p_participant_ids uuid[],
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_starts_at is null or p_ends_at is null then
    return;
  end if;

  -- es.starts_at/ends_at가 null인 세션(ordered 모드)을 걸러내지 않으면
  -- tstzrange(null, null, '[)')가 "무한 범위"로 해석되어 timed 모드가 아닌
  -- 다른 모든 게임과 항상 거짓 충돌로 판정된다 — 반드시 둘 다 not null인
  -- 세션끼리만 비교한다.
  perform 1
  from public.event_game_players egp
  join public.event_games eg on eg.id = egp.event_game_id
  join public.event_sessions es on es.id = eg.event_session_id
  where eg.event_id = p_event_id
    and (p_exclude_game_id is null or eg.id <> p_exclude_game_id)
    and eg.status <> 'cancelled'
    and eg.event_session_id is not null
    and es.starts_at is not null
    and es.ends_at is not null
    and egp.event_participant_id = any(p_participant_ids)
    and tstzrange(es.starts_at, es.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');

  if found then
    raise exception 'EVENT_GAME_PLAYER_TIME_CONFLICT: participant already scheduled in an overlapping session';
  end if;
end;
$$;

revoke all on function public._event_game_check_time_conflict(uuid, uuid, uuid[], timestamptz, timestamptz)
from public, anon, authenticated, service_role;

-- ============================================================
-- 5) 공개 RPC 6종
-- ============================================================

-- 5-1) create_event_game — 게임 생성 + 최초 선수 배정을 한 트랜잭션에서
--      원자적으로 처리한다(요청 사항 4) — 게임 행만 생성되고 선수 저장이
--      실패하는 중간 상태를 만들 수 없다(같은 함수 본문, 같은 트랜잭션).
create function public.create_event_game(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 5-2) update_event_game — 이번 phase에서 유일하게 남는 "게임 자체 정보"
--      변경 필드는 format이다(court/session=place_event_game, status=
--      cancel_event_game, position=reorder_event_games가 전담). format이
--      바뀌면 카디널리티(2명/4명)가 달라지므로 새 선수 구성이 항상 함께
--      필요하다 — 그래서 p_players가 format 변경과 결합되어 있다. format이
--      바뀌지 않는데 선수만 바꾸려는 호출은 set_event_game_players의
--      책임이므로 여기서는 거부한다(배치 API/정보 API 분리 원칙, 2A-6A §7).
--
--      ★ 2A-6B-1 최종 보정: p_format text default null 하나만으로는
--      "format 파라미터 생략"과 "format을 명시적으로 null로 전달"을 구분할
--      수 없다(coalesce(null, ...)로는 두 경우가 동일하게 보임) — 이를
--      "구조적으로 불가능하다"고 덮지 않고, 변경 의도를 나타내는
--      p_format_supplied boolean 파라미터를 별도로 둬서 이 두 상태를 RPC가
--      직접 구분하도록 계약을 고정한다. 최종 7분기(최종 보고서에 표로도
--      정리):
--        1. supplied=false + format=null + 선수 3개 전부 null      → no-op
--        2. supplied=false + format이 non-null                     → 거부(입력 계약 불일치)
--        3. supplied=true  + format=null                           → 거부(format null 불가)
--        4. supplied=true  + format=현재값 + 선수 3개 전부 null      → 검증 후 no-op
--        5. supplied=true  + format=현재값 + 선수 하나라도 제공      → 거부(set_event_game_players 영역)
--        6. supplied=true  + format=다른값 + 선수 3개 전부 제공      → format+선수 원자적 변경
--        7. supplied=true  + format=다른값 + 선수 중 하나라도 미제공 → 거부
create function public.update_event_game(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 5-3) set_event_game_players — 기존 draft 게임의 전체 선수를 한 트랜잭션에서
--      교체한다(부분 추가/삭제 없음, 요청 사항 4). format은 건드리지 않고
--      현재 format의 카디널리티를 그대로 요구한다.
create function public.set_event_game_players(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 5-4) place_event_game — court/session 배정만 변경한다(게임 정보/선수
--      변경과 분리, 2A-6A §7). p_event_court_id/p_event_session_id는 항상
--      "원하는 최종 상태"를 직접 나타낸다(tri-state clear 플래그 없음) —
--      둘 다 null을 넘기면 명시적으로 미배치 상태로 되돌리는 것이다.
--
--      ★ 2A-6B-1 재감사 수정: 검증 순서를 "no-op 판정 → 검증"에서
--      "검증 → no-op 판정"으로 바꾼다. 동일 배치를 재요청해도 그 사이
--      코트/세션이 비활성화되었거나 slot_mode가 바뀌어 더 이상 유효하지
--      않다면 조용히 통과시키지 않아야 한다. 시간 충돌 검사는 자기 게임을
--      제외한다(p_exclude_game_id에 p_game_id 전달).
create function public.place_event_game(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 5-5) reorder_event_games — none 모드 draft 실행 큐(status=draft AND
--      event_session_id is null)의 순서만 다룬다. 이 큐는 완전 미배치
--      게임(court/session 둘 다 null)과 court만 지정된 게임을 모두
--      포함한다 — position이 court 지정 여부와 무관하게 "이 Event의 none
--      모드 실행 순서"라는 단일 의미를 갖는다(2A-6B-1 재감사로 "미배치
--      큐"라는 표현을 이 의미로 명확화). ordered/timed로 배치된 게임은
--      session의 position/time이 실행 순서의 유일한 근거이므로(요청
--      사항 8) 이 RPC의 대상 집합에서 애초에 제외된다.
--
--      ★ 2A-6B-1 재감사 수정: (1) 이 RPC는 slot_mode='none'일 때만
--      실행 가능하다(다른 모드에서는 게임 실행 순서의 근거가 session이므로
--      이 RPC로 건드릴 대상이 없다는 사실을 명시적으로 오류로 알린다).
--      (2) p_game_ids가 null이면 "빈 배열 요청"과 구분해 항상 명확히
--      거부한다(호출자가 항상 명시적 배열을 넘기도록 강제).
create function public.reorder_event_games(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 5-6) cancel_event_game — draft -> cancelled만 실제 전이. 이미 cancelled면
--      idempotent no-op(confirm_event_scheduling과 동일한 관례). in_progress/
--      completed로의 전환 RPC가 아직 없으므로 그 상태들은 이번 phase에서
--      절대 취소 대상이 될 수 없다(도달 자체가 불가능).
create function public.cancel_event_game(
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
  if v_event_status in ('completed', 'cancelled') then
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
-- 6) RPC 권한 — service_role만 EXECUTE, PUBLIC/anon/authenticated는 revoke
-- ============================================================
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
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop function if exists public.cancel_event_game(uuid, uuid, uuid);
-- drop function if exists public.reorder_event_games(uuid, uuid, uuid[]);
-- drop function if exists public.place_event_game(uuid, uuid, uuid, uuid, uuid);
-- drop function if exists public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[]);
-- drop function if exists public.update_event_game(uuid, uuid, uuid, boolean, text, uuid[], text[], integer[]);
-- drop function if exists public.create_event_game(uuid, uuid, text, uuid[], text[], integer[], uuid, uuid, uuid);
--
-- drop function if exists public._event_game_check_time_conflict(uuid, uuid, uuid[], timestamptz, timestamptz);
-- drop function if exists public._event_game_validate_players(uuid, uuid, text, uuid[], text[], integer[]);
-- drop function if exists public._event_game_validate_placement(uuid, uuid, text, uuid, uuid);
--
-- drop table if exists public.event_game_players;
-- drop table if exists public.event_games;
--
-- alter table public.event_sessions drop constraint if exists event_sessions_id_court_event_club_uniq;
--
-- commit;
