-- ============================================================
-- 0051: event_courts + event_sessions (Match System 2.0 Phase 2A-2)
--
-- 계층: Event -> Event Court -> Event Session -> Game(후속 phase)
--
-- 용어 경계(반드시 유지):
--   - public.attendance_sessions(레거시 출석 세션)와 public.event_sessions는
--     완전히 다른 개념이다. 이번 migration은 attendance_sessions를 전혀
--     건드리지 않는다(컬럼 추가/FK/데이터 변경 전부 없음).
--   - 토요정기/일요정기 같은 attendance_sessions.session_day류의 고정
--     구분값은 이번 신규 스키마 어디에도 enum/컬럼으로 추가하지 않는다.
--     Match System 2.0에서 모임 성격 차이는 Event.title/event_date +
--     event_courts/event_sessions 구성 + match_config 조합으로만 표현한다.
--
-- 이번 phase 범위 밖(다음 phase 이후): attendance_sessions.event_id 브릿지,
-- event_participants, games/matches lifecycle, 대진 생성, 결과 입력,
-- 기존 출석 UI/API, public/admin UI, 레거시 데이터 backfill.
--
-- btree_gist 실측 결과(사용자 제공, 2026-08-04):
--   - pg_extension: btree_gist 0 rows(미설치)
--   - extensions 스키마: 존재
--   - service_role의 extensions 스키마 USAGE: true
--   -> exclusion constraint(A안) 채택 확정. 아래 CREATE EXTENSION으로 설치한다.
--
-- search_path 안전장치:
--   CREATE EXTENSION ... WITH SCHEMA extensions로 설치하면 btree_gist가
--   제공하는 gist 연산자 클래스(uuid용 포함)가 extensions 스키마에 생긴다.
--   이 DB의 기본 search_path에 extensions가 포함되어 있는지 실측하지
--   않았으므로, 아래 EXCLUDE ... USING gist DDL이 해당 연산자 클래스를
--   확실히 찾도록 이 트랜잭션에 한해서만(SET LOCAL) search_path를 명시
--   확장한다. 함수 본문들은 이미 각자 SET search_path=''로 독립적이라
--   이 트랜잭션 레벨 설정과 무관하게 안전하다.
--
-- 잠금 순서(교착 방지, 전역 규칙): 모든 court/session RPC는 예외 없이
--   public.events 행을 먼저 잠근 뒤에만 public.event_courts 행을 잠근다.
--   court 계열(create/update/reorder_event_court*)은 events를 FOR UPDATE로
--   잠그고, session 계열(create/update/reorder_event_session*)은 events를
--   FOR SHARE로만 읽은 뒤 실제 쓰기 직렬화 경계인 부모 event_court 행을
--   FOR UPDATE로 잠근다. 이 순서(항상 events 먼저)를 어기면 court 계열과
--   session 계열이 반대 순서로 같은 두 자원을 잠그게 되어 교착이 발생할 수
--   있다 — 이번 migration의 모든 함수가 이 규칙을 예외 없이 지킨다.
--
-- reorder 알고리즘: unique(..., position) where is_active 파샬 인덱스
--   특성상 두 행의 position을 단순 swap하면 중간 상태에서 반드시 충돌한다.
--   이번 migration은 "현재 최댓값+1"을 동적 offset으로 삼아 ①임시 offset
--   구간으로 전원 이동 ②최종 1..N 확정의 2단계 UPDATE로 재배치한다.
--   offset은 bigint로 계산해 int4 overflow를 사전 검사(2147483647 초과 시
--   EVENT_COURT_POSITION_OVERFLOW / EVENT_SESSION_POSITION_OVERFLOW로 거부)한
--   뒤에만 integer로 캐스팅해 저장한다.
--
-- 오류 코드 관례: 0050 교정 이후 관례(UUID/이름을 오류 메시지에 절대
--   보간하지 않음)를 그대로 따른다. attendance_sessions 도메인과 코드가
--   섞이지 않도록 EVENT_COURT_*/EVENT_SESSION_* 접두사를 전부 붙였다
--   (0045의 SESSION_NOT_FOUND 등 레거시 코드와 절대 겹치지 않게 함).
-- ============================================================

begin;

set local search_path = public, extensions;

-- ============================================================
-- 1) event_courts
-- ============================================================
create table public.event_courts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  club_id uuid not null,
  name text not null,
  position integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_courts_name_not_blank check (btrim(name) <> ''),
  constraint event_courts_position_positive check (position >= 1),
  constraint event_courts_id_event_id_club_id_uniq unique (id, event_id, club_id),
  constraint event_courts_event_club_fk
    foreign key (event_id, club_id) references public.events (id, club_id)
);

comment on table public.event_courts is
  'Match System 2.0 — Event 안의 코트/운영 슬롯(0051). attendance_sessions
   와 무관. 삭제 RPC 없음 — is_active=false로만 비활성화(Game이 참조한
   코트를 물리 삭제하지 않기 위함). unique(id, event_id, club_id)는
   event_sessions의 복합 FK가 cross-event/cross-club 참조를 DB에서
   차단하도록 지원한다.';

-- 활성 코트끼리만 순서/이름 충돌 방지 — 비활성 이력은 값 그대로 보존
create unique index event_courts_active_position_uniq
  on public.event_courts (event_id, position) where is_active;
create unique index event_courts_active_name_uniq
  on public.event_courts (event_id, lower(btrim(name))) where is_active;

alter table public.event_courts enable row level security;
-- 정책 0개 — anon/authenticated는 GRANT 자체가 없어 정책 여부와 무관하게 접근 불가.
revoke all on public.event_courts from public, anon, authenticated, service_role;
grant select on public.event_courts to service_role;
-- INSERT/UPDATE/DELETE는 어떤 role에도 부여하지 않는다 — 쓰기는 아래 RPC 전용.

-- ============================================================
-- 2) event_sessions
-- ============================================================
create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  club_id uuid not null,
  event_court_id uuid not null,
  position integer not null,
  starts_at timestamptz,
  ends_at timestamptz,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_sessions_position_positive check (position >= 1),
  constraint event_sessions_label_not_blank check (label is null or btrim(label) <> ''),
  constraint event_sessions_timestamps_paired check ((starts_at is null) = (ends_at is null)),
  constraint event_sessions_time_range check (starts_at is null or ends_at > starts_at),
  constraint event_sessions_id_event_id_club_id_uniq unique (id, event_id, club_id),
  constraint event_sessions_event_club_fk
    foreign key (event_id, club_id) references public.events (id, club_id),
  constraint event_sessions_court_fk
    foreign key (event_court_id, event_id, club_id)
    references public.event_courts (id, event_id, club_id)
);

comment on table public.event_sessions is
  'Match System 2.0 — Event Court 안의 경기 슬롯(0051). 출석 세션
   (attendance_sessions)이 아니다. slot_mode는 이 테이블에 중복 저장하지
   않는다 — events.match_config->>''slot_mode''가 유일한 source of truth이며
   모든 규칙 검증은 RPC가 매 호출마다 그 시점 값을 다시 읽어 수행한다.
   ordered 모드: starts_at/ends_at 둘 다 null, position으로만 순서 관리.
   timed 모드: starts_at/ends_at 둘 다 필수, ends_at > starts_at, 동일 코트
   내 활성 세션끼리 시간 겹침 금지(exclusion constraint, 아래).
   Event.event_date와의 날짜 정합성(자정 넘김 포함)은 이번 phase에서
   DB 레벨로 강제하지 않는다 — 서비스 전체에 timezone 계약이 아직 없음을
   실측으로 확인했고(코드베이스에 Asia/Seoul 등 하드코딩 0건), 임의로
   가정하는 대신 이 한계를 명시적으로 남기고 후속 timezone phase로 미룬다.';

create unique index event_sessions_active_position_uniq
  on public.event_sessions (event_court_id, position) where is_active;

-- btree_gist 미설치 확인(실측) — 이 migration에서 설치. extensions 스키마는
-- 이미 존재하고 service_role은 USAGE 보유(실측 확인) — CREATE는 이 SQL을
-- 실행하는 Studio 세션 권한으로 수행된다.
create extension if not exists btree_gist with schema extensions;

-- 동일 코트, 활성 세션끼리 timed 구간 겹침을 DB 불변식으로 직접 차단.
-- 비활성 세션은 제외(historical 값 보존, 스케줄링에 영향 없음).
alter table public.event_sessions
  add constraint event_sessions_no_overlap
  exclude using gist (
    event_court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (
    starts_at is not null
    and ends_at is not null
    and is_active
  );

alter table public.event_sessions enable row level security;
revoke all on public.event_sessions from public, anon, authenticated, service_role;
grant select on public.event_sessions to service_role;

-- ============================================================
-- 3) 비공개 helper — slot_mode 규칙 검증 (SECURITY DEFINER 아님, EXECUTE 전부 revoke)
--    create_event_session/update_event_session이 동일 로직을 중복 구현하지
--    않도록 공유한다. 0045의 private helper 패턴과 동일 원리 — 함수 소유자
--    (postgres)가 SECURITY DEFINER 외부 함수 내부에서 호출하면 revoke와
--    무관하게 정상 동작한다.
-- ============================================================
create function public._event_session_validate_mode(
  p_slot_mode text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_slot_mode = 'none' then
    raise exception 'EVENT_SLOT_MODE_NONE_NO_SESSIONS';
  elsif p_slot_mode = 'ordered' then
    if p_starts_at is not null or p_ends_at is not null then
      raise exception 'EVENT_SESSION_TIMESTAMPS_NOT_ALLOWED';
    end if;
  elsif p_slot_mode = 'timed' then
    if p_starts_at is null or p_ends_at is null then
      raise exception 'EVENT_SESSION_TIMESTAMPS_REQUIRED';
    end if;
  end if;
end;
$$;

revoke all on function public._event_session_validate_mode(text, timestamptz, timestamptz)
from public, anon, authenticated, service_role;

-- ============================================================
-- 4) event_courts RPC 3종
-- ============================================================

-- 4-1) create_event_court — events를 FOR UPDATE로 잠근다(court 계열 공통 규칙).
create function public.create_event_court(
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
  if v_event_status in ('completed', 'cancelled') then
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
    -- ★ P0 수정(4): bigint로 계산 후 int4 범위 사전 검사 — max가 INT_MAX 근처일 때
    -- integer 산술 자체가 overflow로 raw 에러를 내기 전에 친절한 코드로 거부한다.
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

  -- ★ P0 수정(1): `return (insert ... returning id)`는 PostgreSQL에서 문법 오류다.
  -- RETURNING은 INSERT 문의 절이지 표현식이 아니므로 return()으로 감쌀 수 없다.
  insert into public.event_courts (event_id, club_id, name, position)
  values (p_event_id, p_club_id, v_name, v_position)
  returning id into v_court_id;

  return v_court_id;
end;
$$;

-- 4-2) update_event_court — name/position/is_active 선택 수정. 최종 상태
--      기준으로 항상 재검증(재활성화도 별도 분기 없이 동일 규칙 적용).
create function public.update_event_court(
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
  if v_event_status in ('completed', 'cancelled') then
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

  -- 활성화->비활성화 전환 시, 참조 중인 활성 event_sessions가 있으면 거부(확정 정책)
  if v_court.is_active and not v_new_is_active then
    select count(*) into v_active_session_count
    from public.event_sessions
    where event_court_id = p_court_id and is_active;
    if v_active_session_count > 0 then
      raise exception 'EVENT_COURT_HAS_ACTIVE_SESSIONS';
    end if;
  end if;

  -- 최종 상태가 활성이면 이름/포지션 충돌을 항상 재검증(재활성화 포함)
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
end;
$$;

-- 4-3) reorder_event_courts — 배열이 활성 코트 전체를 정확히 1회 포함해야
--      함. 동적 offset(현재 최댓값+1, bigint 계산) 2단계 재배치.
create function public.reorder_event_courts(
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

  v_count := coalesce(array_length(p_court_ids, 1), 0);
  if v_count > 500 then
    raise exception 'EVENT_COURT_REORDER_TOO_LARGE';
  end if;

  if v_count <> (select count(distinct x) from unnest(p_court_ids) as x) then
    raise exception 'EVENT_COURT_REORDER_DUPLICATE_ID';
  end if;

  -- 대상 행을 id 오름차순으로 잠근다(교착 방지, 0045의 참가자 잠금과 동일 원리)
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

  -- ★ P0 수정(1, 이번 라운드): 활성 row만 기준으로 offset 계산 — 비활성
  -- 이력 row의 큰 position 값이 이 max()에 섞이면(예: 과거 명시적 p_position
  -- 지정으로 큰 값을 가진 채 비활성화된 코트) 이후 모든 reorder의 offset이
  -- 불필요하게 커져, 결국 INT_MAX 근접 시 활성 코트 개수가 몇 개 안 되더라도
  -- reorder 자체가 영구적으로 막힐 수 있다. partial unique index 자체가
  -- is_active 조건부라 비활성 row의 position 값은 애초에 이 계산과 무관해도
  -- 안전하므로(활성 row끼리만 충돌 방지가 목적), 활성 row만 스캔한다.
  select coalesce(max(position), 0)::bigint + 1 into v_offset
  from public.event_courts
  where event_id = p_event_id
    and club_id = p_club_id
    and is_active;

  if v_offset + v_count > 2147483647 then
    raise exception 'EVENT_COURT_POSITION_OVERFLOW';
  end if;

  -- phase 1: 충돌 없는 임시 offset 구간으로 전원 이동
  update public.event_courts ec
  set position = (v_offset + ord.rn)::integer, updated_at = now()
  from unnest(p_court_ids) with ordinality as ord(id, rn)
  where ec.id = ord.id;

  -- phase 2: 입력 배열 순서대로 최종 1..N 확정
  update public.event_courts ec
  set position = ord.rn::integer, updated_at = now()
  from unnest(p_court_ids) with ordinality as ord(id, rn)
  where ec.id = ord.id;
end;
$$;

-- ============================================================
-- 5) event_sessions RPC 3종
-- ============================================================

-- 5-1) create_event_session — events는 FOR SHARE(상태/slot_mode 확정용),
--      실제 직렬화 경계는 부모 event_court 행 FOR UPDATE(session 계열 공통 규칙).
create function public.create_event_session(
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
  if v_event_status in ('completed', 'cancelled') then
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

  -- 겹침 사전 확인(exclusion constraint가 최종 backstop)
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
    -- ★ P0 수정(4): bigint 계산 후 int4 범위 사전 검사(court와 동일 원리)
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

  return v_session_id;
end;
$$;

-- 5-2) update_event_session — NULL patch 3-상태 처리(p_clear_times/
--      p_clear_label). slot_mode/position/overlap 검증은 최종 활성 상태일
--      때만 적용("비활성 row는 이력" 원칙, 재활성화는 그 순간의 현재
--      slot_mode로 전체 재검증). 잠금 순서는 court 계열과 동일하게
--      events -> event_courts -> event_sessions로 통일(교착 방지, ★ P0 수정 2).
create function public.update_event_session(
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
  -- 1) events는 FOR SHARE(상태/slot_mode 확정용) — session 계열 공통 규칙
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for share;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  -- 2) 세션을 비잠금으로 먼저 조회해 event_court_id만 알아낸다(★ P0 수정 2) —
  --    아직 아무 행도 잠그지 않은 상태이므로 reorder_event_sessions와 잠금
  --    순서가 겹칠 일이 없다.
  select event_court_id into v_event_court_id
  from public.event_sessions
  where id = p_session_id and event_id = p_event_id and club_id = p_club_id;

  if not found then
    raise exception 'EVENT_SESSION_NOT_FOUND';
  end if;

  -- 3) 부모 event_court 행을 FOR UPDATE로 잠근다 — events 다음, court 계열과
  --    동일한 순서(events -> event_courts)이므로 reorder_event_sessions
  --    (events -> 그 court -> sessions)와 교착이 발생하지 않는다.
  select * into v_court
  from public.event_courts
  where id = v_event_court_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_COURT_NOT_FOUND';
  end if;

  -- 4) 이제 세션을 FOR UPDATE로 잠근다. WHERE에 event_court_id = v_event_court_id를
  --    포함해, 2)에서 읽은 값과 지금 잠근 행의 값이 동일한지 검증한다(요청 반영) —
  --    이 서비스에는 세션을 다른 코트로 옮기는 경로가 없어 이론상 항상 같지만,
  --    방어적으로 WHERE 조건 자체에 포함시켜 불일치 시 자연스럽게 NOT FOUND가
  --    되도록 한다.
  select * into v_session
  from public.event_sessions
  where id = p_session_id and event_id = p_event_id and club_id = p_club_id
    and event_court_id = v_event_court_id
  for update;

  if not found then
    raise exception 'EVENT_SESSION_NOT_FOUND';
  end if;

  -- ── 시간 필드 3-상태: 미터치 / 명시적 clear / 새 범위로 교체 ──
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

  -- ── label 3-상태: 미터치 / 명시적 clear / 새 값으로 교체 ──
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

  -- ★ P0 수정(3): 부모 코트가 비활성 상태면 세션을 활성으로 되돌릴 수 없다
  -- (비활성 코트 아래에서 활성 세션이 존재하는 상태 자체를 만들지 않는다).
  if v_new_is_active and not v_court.is_active then
    raise exception 'EVENT_COURT_INACTIVE';
  end if;

  -- 구조적 range 체크(ends_at > starts_at)는 활성 여부와 무관하게 항상 적용한다.
  -- CHECK(event_sessions_time_range)가 최종 backstop이고, 이 값 자체는 "비활성
  -- row도 저장 시점에는 유효한 값이어야 한다"는 구조 규칙이지 slot_mode
  -- 비즈니스 규칙이 아니므로 아래 활성 전용 블록과 분리해 항상 검사한다.
  if v_new_starts_at is not null and v_new_ends_at <= v_new_starts_at then
    raise exception 'EVENT_SESSION_TIME_RANGE';
  end if;

  -- ★ P0 수정(5): slot_mode/position/overlap 검증은 최종 활성 상태(재활성화
  -- 포함)일 때만 적용한다 — "비활성 row는 이력일 뿐 현재 상태를 구속하지
  -- 않는다" 원칙과 일관되게, 비활성으로 남거나 전환되는 경우는 그 시점
  -- slot_mode와 맞지 않는 값이라도(예: 과거 timed 값이 남은 채 label만 수정)
  -- 그대로 허용한다. 활성으로 남거나 전환되는 경우에는 그 순간의 현재
  -- slot_mode로 전체를 다시 검증한다.
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
end;
$$;

-- 5-3) reorder_event_sessions — event_court 스코프 내에서 court와 동일한
--      2단계 offset 재배치.
create function public.reorder_event_sessions(
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
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for share;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
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

  -- ★ P0 수정(1, 이번 라운드): court와 동일한 이유로 활성 row만 기준으로 계산
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
end;
$$;

-- ============================================================
-- 6) update_event 교체 — slot_mode 잠금 로직 추가
--    시그니처(인자 타입/순서)는 0050과 완전 동일 — CREATE OR REPLACE라
--    기존 GRANT를 그대로 보존한다(방어적으로 아래에서 재기술도 한다).
--    event_sessions 존재를 전제하므로 반드시 위 2)~5) 이후에 위치해야 한다.
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

    -- ★ 0051 신규: slot_mode가 실제로 바뀌고, 활성 event_sessions가 하나라도
    -- 있으면 거부한다. event_courts만 있거나 비활성 session만 있는 경우는
    -- 허용(§9 "비활성 row는 이력일 뿐 현재 상태를 구속하지 않는다" 원칙과 일관).
    if (v_new_config->>'slot_mode') is distinct from (v_event.match_config->>'slot_mode') then
      select count(*) into v_active_session_count
      from public.event_sessions
      where event_id = p_event_id and is_active;
      if v_active_session_count > 0 then
        raise exception 'EVENT_SLOT_MODE_LOCKED';
      end if;
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

    if p_status = 'completed' then
      v_event.completed_at := coalesce(v_event.completed_at, now());
    elsif v_event.status = 'completed' and p_status = 'active' then
      v_event.completed_at := null;  -- 재오픈 시 완료 시각 초기화(0050 승인된 권장안 유지)
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
end;
$$;

-- ============================================================
-- 7) RPC 권한
-- ============================================================
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

-- update_event: CREATE OR REPLACE는 기존 ACL을 보존하지만 방어적으로 재기술한다.
revoke all on function public.update_event(uuid, uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_event(uuid, uuid, text, date, text, jsonb) to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop function if exists public.reorder_event_sessions(uuid, uuid, uuid, uuid[]);
-- drop function if exists public.update_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, boolean, text, boolean, boolean);
-- drop function if exists public.create_event_session(uuid, uuid, uuid, integer, timestamptz, timestamptz, text);
-- drop function if exists public.reorder_event_courts(uuid, uuid, uuid[]);
-- drop function if exists public.update_event_court(uuid, uuid, uuid, text, integer, boolean);
-- drop function if exists public.create_event_court(uuid, uuid, text, integer);
-- drop function if exists public._event_session_validate_mode(text, timestamptz, timestamptz);
--
-- -- update_event를 0050 원본 body로 정확히 복원(시그니처 동일 유지, ACL 보존)
-- create or replace function public.update_event(
--   p_event_id uuid,
--   p_club_id uuid,
--   p_title text default null,
--   p_event_date date default null,
--   p_status text default null,
--   p_match_config jsonb default null
-- ) returns void
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- declare
--   v_event public.events%rowtype;
-- begin
--   select * into v_event
--   from public.events
--   where id = p_event_id and club_id = p_club_id
--   for update;
--
--   if not found then
--     raise exception 'EVENT_NOT_FOUND';
--   end if;
--
--   if p_title is not null then
--     if btrim(p_title) = '' then
--       raise exception 'INVALID_TITLE';
--     end if;
--     v_event.title := btrim(p_title);
--   end if;
--
--   if p_event_date is not null then
--     v_event.event_date := p_event_date;
--   end if;
--
--   if p_match_config is not null then
--     v_event.match_config := public.normalize_match_config(p_match_config);
--   end if;
--
--   if p_status is not null and p_status <> v_event.status then
--     if v_event.status = 'cancelled' then
--       raise exception 'EVENT_STATUS_TERMINAL: cancelled event cannot transition';
--     end if;
--     if v_event.status = 'draft' and p_status not in ('active','completed','cancelled') then
--       raise exception 'INVALID_STATUS_TRANSITION: draft -> %', p_status;
--     end if;
--     if v_event.status = 'active' and p_status not in ('completed','cancelled') then
--       raise exception 'INVALID_STATUS_TRANSITION: active -> %', p_status;
--     end if;
--     if v_event.status = 'completed' and p_status <> 'active' then
--       raise exception 'INVALID_STATUS_TRANSITION: completed -> %', p_status;
--     end if;
--
--     if p_status = 'completed' then
--       v_event.completed_at := coalesce(v_event.completed_at, now());
--     elsif v_event.status = 'completed' and p_status = 'active' then
--       v_event.completed_at := null;
--     end if;
--
--     v_event.status := p_status;
--   end if;
--
--   update public.events set
--     title = v_event.title,
--     event_date = v_event.event_date,
--     status = v_event.status,
--     match_config = v_event.match_config,
--     completed_at = v_event.completed_at,
--     updated_at = now()
--   where id = p_event_id and club_id = p_club_id;
-- end;
-- $$;
--
-- drop table if exists public.event_sessions;
-- drop table if exists public.event_courts;
--
-- -- btree_gist extension은 drop하지 않는다(공유 리소스 — 다른 기능이 이미
-- -- 의존할 수 있고, 설치 자체는 부작용이 없다는 확정 정책).
--
-- commit;
