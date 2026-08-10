-- ============================================================
-- 0053: confirm_event_scheduling + 확정 무효화 계약 (Match System 2.0 Phase 2A-5C)
--
-- 이번 migration의 목적: "코트·슬롯 구성을 운영자가 확정하고, 이후 실질적인
-- 구성 변경이 발생하면 확정 상태가 자동으로 무효화되는" 계약을 완성한다.
--
-- 확정된 정책(그대로 구현):
--   1) 참가자 확정(participants_confirmed_at) 전에도 코트·슬롯 설정은 가능.
--   2) 스케줄 확정에는 participants_confirmed_at이 반드시 필요.
--   3) 확정 시 scheduling_confirmed_at = now() 기록.
--   4) 코트·슬롯의 실질적인 변경 시 scheduling_confirmed_at = null.
--   5) 값이 실제로 바뀌지 않은 no-op 요청은 확정 시각을 그대로 유지.
--   6) 참가자 명단이 실질적으로 변경되면 participants_confirmed_at과
--      scheduling_confirmed_at을 "같은 트랜잭션"에서 함께 null로 만든다
--      (스케줄 확정이 참가자 확정을 선행조건으로 삼으므로, 선행조건이
--      깨지면 스케줄 확정도 동시에 무효화되어야 계약이 일관된다).
--   7) confirm_event_participants 자체는 스케줄을 무효화하지 않는다
--      (참가자 확정은 스케줄 확정의 전제일 뿐, 스케줄 자체를 변경하는
--      행위가 아니다 — 이 함수는 이번 migration에서 손대지 않는다).
--   8) 대진 생성/게임 배치/자동 조편성/legacy attendance_sessions는 범위 밖.
--
-- 변경 대상(전부 CREATE OR REPLACE — signature/반환형/권한/오류코드/club
-- 경계/멱등성은 그대로 유지하고 본문에 no-op 감지 + 무효화만 추가한다):
--   - public.create_event_court / update_event_court / reorder_event_courts (0051)
--   - public.create_event_session / update_event_session / reorder_event_sessions (0051)
--   - public.update_event (0050/0051) — slot_mode 실질 변경 시에만 무효화
--   - public.import_event_participants_from_attendance / create_event_participant /
--     update_event_participant (0052) — 참가자 실질 변경 시 두 확정값 모두 무효화
--   - (신규) public.confirm_event_scheduling
--
-- 신규 오류 코드: EVENT_PARTICIPANTS_NOT_CONFIRMED, EVENT_SCHEDULING_NO_ACTIVE_COURTS,
--   EVENT_SCHEDULING_COURT_MISSING_SESSIONS. 0045의 관례(오류 메시지에 UUID/이름
--   절대 보간하지 않음)를 그대로 따른다.
--
-- 잠금 순서: confirm_event_scheduling은 events만 FOR UPDATE로 잠그고 courts/
--   sessions는 잠그지 않는다(둘 다 수정하지 않고 개수만 센다) — 모든 court/
--   session 계열 RPC가 courts/sessions를 건드리기 전에 반드시 events를 먼저
--   잠그므로(court 계열 FOR UPDATE, session 계열 FOR SHARE), confirm이 events를
--   FOR UPDATE로 쥐고 있는 동안 그 어떤 구조 변경 RPC도 진행할 수 없다 — 확정과
--   구조 변경이 자동으로 직렬화된다. 기존 잠금 순서(항상 events 먼저)를 그대로
--   따르므로 이번 신규 함수가 새로운 교착 가능성을 만들지 않는다.
--
-- no-op 판정 순서(중요): 모든 court/session RPC에서 no-op 조기 반환은 반드시
--   EVENT_NOT_FOUND/EVENT_STRUCTURE_LOCKED/각종 존재성 검증보다 "뒤"에 온다.
--   즉 잠긴(completed/cancelled) Event에 동일값 요청을 보내도 no-op 성공이
--   아니라 기존과 동일하게 EVENT_STRUCTURE_LOCKED가 먼저 발생한다.
--
-- NULL-안전 비교: event_sessions.starts_at/ends_at/label은 nullable이므로
--   최종값 비교에 plain =이 아니라 IS NOT DISTINCT FROM을 쓴다(둘 다 null인
--   경우를 "같음"으로 정확히 판정하기 위함 — plain =은 NULL 피연산자가 있으면
--   항상 unknown이 되어 진짜 no-op을 "다름"으로 오판할 수 있다). event_courts의
--   name/position/is_active와 event_sessions의 position/is_active는 전부
--   not null 컬럼이라 plain =로 충분하다. 재정렬의 순서 비교(uuid[] = uuid[])도
--   두 배열 모두 이 시점엔 NULL 원소가 있을 수 없으므로 plain =로 충분하다.
-- ============================================================

begin;

-- ============================================================
-- 1) event_courts RPC 3종 재정의
-- ============================================================

-- 1-1) create_event_court — 항상 신규 삽입이므로 항상 실질 변경 → 무조건 무효화.
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

-- 1-2) update_event_court — 최종값이 현재값과 완전히 같으면 no-op.
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

-- 1-3) reorder_event_courts — 집합이 같아도 "순서"까지 같으면 no-op.
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

-- ============================================================
-- 2) event_sessions RPC 3종 재정의
-- ============================================================

-- 2-1) create_event_session — 항상 신규 삽입 → 무조건 무효화.
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

-- 2-2) update_event_session — 최종값이 현재값과 완전히 같으면 no-op(nullable
--      필드는 IS NOT DISTINCT FROM으로 비교).
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 2-3) reorder_event_sessions — 해당 코트 스코프에서 순서까지 동일하면 no-op.
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

-- ============================================================
-- 3) update_event 재정의 — slot_mode가 실제로 바뀔 때만 스케줄 확정 무효화.
--    title/event_date/status 변경만으로는 절대 무효화하지 않는다.
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

-- ============================================================
-- 4) event_participants RPC 3종 재정의 — 참가자 실질 변경 시
--    participants_confirmed_at과 scheduling_confirmed_at을 함께 무효화.
--    signature/반환형/권한/오류코드/club 경계/멱등성은 전부 그대로 유지하고
--    무효화 UPDATE 문의 SET 목록에 scheduling_confirmed_at = null만 추가한다.
--    confirm_event_participants는 이번 migration에서 손대지 않는다(참가자
--    확정 자체는 스케줄을 변경하는 행위가 아니므로 스케줄을 무효화하지 않음).
-- ============================================================

-- 4-1) import_event_participants_from_attendance
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 4-2) create_event_participant
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
  if v_event_status in ('completed', 'cancelled') then
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

-- 4-3) update_event_participant
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
  if v_event_status in ('completed', 'cancelled') then
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

-- ============================================================
-- 5) confirm_event_scheduling (신규) — events만 FOR UPDATE로 잠근다(court/
--    session 계열과 동일한 잠금 순서 규칙 — 항상 events 먼저). courts/
--    sessions는 개수만 세고 수정하지 않으므로 별도 잠금이 필요 없다: 모든
--    구조 변경 RPC가 courts/sessions를 만지기 전에 반드시 events를 먼저
--    잠그므로, 이 함수가 events를 FOR UPDATE로 쥐고 있는 동안에는 어떤
--    구조 변경도 진행될 수 없다(직렬화).
-- ============================================================
create function public.confirm_event_scheduling(
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
  if v_event_status in ('completed', 'cancelled') then
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

-- ============================================================
-- 6) RPC 권한 — 신규/교체 함수 전부 방어적으로 재기술(CREATE OR REPLACE는
--    기존 ACL을 보존하지만, 0051/0052 관례를 따라 명시적으로 다시 선언한다).
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

revoke all on function public.update_event(uuid, uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_event(uuid, uuid, text, date, text, jsonb) to service_role;

revoke all on function public.import_event_participants_from_attendance(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.import_event_participants_from_attendance(uuid, uuid, uuid) to service_role;

revoke all on function public.create_event_participant(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_event_participant(uuid, uuid, uuid, uuid) to service_role;

revoke all on function public.update_event_participant(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_event_participant(uuid, uuid, uuid, text) to service_role;

revoke all on function public.confirm_event_scheduling(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_event_scheduling(uuid, uuid) to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행 — 이 migration이 교체한 9개 함수를
-- 전부 2A-5C 이전(0051/0052) 원본 본문으로 복원하고, confirm_event_scheduling을
-- 제거한다)
-- ============================================================
-- begin;
--
-- drop function if exists public.confirm_event_scheduling(uuid, uuid);
--
-- create or replace function public.create_event_court(
--   p_event_id uuid, p_club_id uuid, p_name text, p_position integer default null
-- ) returns uuid language plpgsql security definer set search_path = '' as $$
-- declare
--   v_event_status text; v_name text; v_position integer; v_position_bigint bigint; v_court_id uuid;
-- begin
--   select status into v_event_status from public.events where id = p_event_id and club_id = p_club_id for update;
--   if not found then raise exception 'EVENT_NOT_FOUND'; end if;
--   if v_event_status in ('completed', 'cancelled') then raise exception 'EVENT_STRUCTURE_LOCKED'; end if;
--   v_name := btrim(p_name);
--   if v_name is null or v_name = '' then raise exception 'INVALID_EVENT_COURT_NAME'; end if;
--   if p_position is not null and p_position < 1 then raise exception 'INVALID_EVENT_COURT_POSITION'; end if;
--   perform 1 from public.event_courts where event_id = p_event_id and is_active and lower(btrim(name)) = lower(v_name);
--   if found then raise exception 'EVENT_COURT_NAME_TAKEN'; end if;
--   if p_position is null then
--     select coalesce(max(position), 0)::bigint + 1 into v_position_bigint from public.event_courts where event_id = p_event_id and is_active;
--     if v_position_bigint > 2147483647 then raise exception 'EVENT_COURT_POSITION_OVERFLOW'; end if;
--     v_position := v_position_bigint::integer;
--   else
--     v_position := p_position;
--     perform 1 from public.event_courts where event_id = p_event_id and is_active and position = v_position;
--     if found then raise exception 'EVENT_COURT_POSITION_TAKEN'; end if;
--   end if;
--   insert into public.event_courts (event_id, club_id, name, position) values (p_event_id, p_club_id, v_name, v_position) returning id into v_court_id;
--   return v_court_id;
-- end; $$;
--
-- -- (update_event_court/reorder_event_courts/create_event_session/update_event_session/
-- --  reorder_event_sessions/update_event/import_event_participants_from_attendance/
-- --  create_event_participant/update_event_participant의 0051/0052 원본 본문은 각각
-- --  supabase/migrations/0051_event_courts_sessions.sql, 0052_event_participants.sql의
-- --  최초 CREATE 문을 그대로 CREATE OR REPLACE로 재실행하면 복원된다 — 본문이 길어
-- --  이 파일에 전부 중복 기재하지 않고 원본 파일을 가리킨다. GRANT/REVOKE는 0051/0052와
-- --  동일하므로 이 migration의 6번 섹션을 그대로 다시 실행해도 무방하다(대상 함수의
-- --  시그니처가 변하지 않았으므로).
--
-- commit;
