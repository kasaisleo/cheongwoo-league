-- ============================================================
-- 0050: events + match_config Foundation (Match System 2.0 Phase 2A-1)
--
-- 배경: Match System 2.0의 Event/Session/Game 3계층 중 최상위 Event와,
-- 클럽 기본값+Event 스냅샷 방식의 운영 설정(match_config) 저장 기반만
-- 이번 phase에서 놓는다. event_courts/event_sessions/event_participants/
-- matches lifecycle/game_generation_runs/attendance_sessions.event_id는
-- 전부 이번 phase 범위 밖이며 건드리지 않는다.
--
-- v1 Event는 하루 단위다 — event_date(date) 하나만 사용하고 starts_at/
-- ends_at/timezone은 추가하지 않는다. 다일 이벤트는 범위 밖.
--
-- config는 "club 기본값(clubs.match_config_defaults) + Event 생성 시점
-- snapshot(events.match_config)" 구조다. Event 생성 이후 club 기본값이
-- 바뀌어도 이미 생성된 Event의 config는 변하지 않는다(snapshot 원칙).
-- preset 이름 같은 UI 템플릿 식별자는 어디에도 저장하지 않는다 —
-- normalize_match_config가 반환하는 최종 key-value만 저장된다.
--
-- 권한 설계(★ 조건부 승인 후 수정된 핵심 부분):
--   1) normalize_match_config: PUBLIC/anon/authenticated는 revoke,
--      service_role에는 EXECUTE grant. 이유: clubs_match_config_defaults_
--      normalized CHECK가 clubs UPDATE 시(예: center-court의 기존
--      /api/platform/clubs/[id] PATCH — service-role로 name/slug/
--      description/status만 바꾸는 raw UPDATE)마다 평가되는데, 이 UPDATE는
--      SECURITY DEFINER RPC를 거치지 않는 순수 service-role 문이라 CHECK가
--      호출하는 normalize_match_config의 EXECUTE 권한이 "그 UPDATE를 실행
--      중인 service_role" 기준으로 검사된다. service_role의 EXECUTE를
--      revoke하면 match_config_defaults를 전혀 건드리지 않는 clubs UPDATE
--      조차도 CHECK 평가 단계에서 permission denied로 실패한다.
--   2) events: service_role조차 SELECT만 허용하고 INSERT/UPDATE/DELETE는
--      전부 revoke — raw DML로 create_event/update_event의 상태 전이
--      규칙(§전이표)과 config 정규화를 우회할 수 없게 한다. RPC 3종은
--      SECURITY DEFINER로 정의자(postgres, 테이블 소유자) 권한으로 실행되
--      므로 이 revoke와 무관하게 정상 동작한다(0045의 private helper와
--      동일한 원리 — 함수 소유자는 자신이 소유한 객체에 대해 GRANT/REVOKE와
--      무관하게 항상 권한을 가진다).
--   3) clubs.match_config_defaults 컬럼 자체의 privilege는 이번 phase에서
--      변경하지 않는다 — clubs 테이블 전체가 0049에서 이미 service_role에
--      ALL PRIVILEGES를 부여받았고, 컬럼 단위 세분화는 이번 범위 밖이다.
--      따라서 "DB에서 완전히 RPC 전용"이 아니다 — set_club_match_config_
--      defaults RPC가 코드 레벨(그리고 center-court PATCH의 명시적
--      whitelist)에서 유일한 정상 변경 경로일 뿐, service_role이 원한다면
--      DB 권한상 raw UPDATE로 이 컬럼을 직접 바꾸는 것 자체는 막혀있지
--      않다. 이 경계를 정확히 인지한 채로 진행한다.
--
-- create_event는 club 활성 상태와 기본 config를 단일 SELECT ... FOR SHARE
-- 로 한 번에 읽어 두 값 사이의 레이스(활성 상태 확인 이후, 기본 config
-- 조회 이전에 club이 바뀌는 경우)를 제거한다.
--
-- version 검증은 "JSON number 타입" → "정수인지(소수부 없음)" → "값이
-- 1인지" 순서로 3단계 확인한다(string "1", 1.5 등 전부 거부, 1.0처럼
-- 정수값이지만 소수 표기인 경우는 정수 검사를 통과하되 그 다음 단계에서
-- 값 자체가 1이므로 정상 통과 — "정수인지" 검증의 목적은 1.5 같은 진짜
-- 소수를 걸러내는 것이지 리터럴 표기 방식을 문제삼는 것이 아니다).
--
-- 기존 clubs 2행은 컬럼 추가 시 DEFAULT가 즉시 채워지므로(Postgres 상수
-- DEFAULT, 풀 리라이트 불필요) 별도 backfill 문이 없다 — QA에서 실측 검증.
-- ============================================================

begin;

-- ============================================================
-- 1) normalize_match_config — 순수 함수, 테이블 접근 없음
-- ============================================================
create function public.normalize_match_config(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb;
  v_key text;
  v_allowed_keys text[] := array[
    'version','attendance_enabled','participant_confirmation_required',
    'court_assignment_enabled','slot_mode','pre_scheduling_enabled',
    'live_queue_enabled','auto_generation_enabled','review_required',
    'court_count','max_games_per_member','rest_gap_minutes',
    'partner_repeat_limit','opponent_repeat_limit'
  ];
  v_bool_keys text[] := array[
    'attendance_enabled','participant_confirmation_required',
    'court_assignment_enabled','pre_scheduling_enabled',
    'live_queue_enabled','auto_generation_enabled','review_required'
  ];
  v_numeric_keys text[] := array[
    'court_count','max_games_per_member','rest_gap_minutes',
    'partner_repeat_limit','opponent_repeat_limit'
  ];
  v_min_values jsonb := '{"court_count":0,"max_games_per_member":1,"rest_gap_minutes":0,"partner_repeat_limit":0,"opponent_repeat_limit":0}'::jsonb;
begin
  -- A. 입력 전체
  if p_config is null then
    raise exception 'CONFIG_NOT_OBJECT: config must not be null';
  end if;
  if jsonb_typeof(p_config) <> 'object' then
    raise exception 'CONFIG_NOT_OBJECT: config must be a JSON object';
  end if;

  -- F. 알 수 없는 키 거부 (구조 오류를 가장 먼저 걸러 fail-fast)
  for v_key in select jsonb_object_keys(p_config) loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'CONFIG_UNKNOWN_KEY: %', v_key;
    end if;
  end loop;

  -- B. version — number 타입 → 정수 여부 → 값 1 순서로 검증
  if not (p_config ? 'version') then
    raise exception 'CONFIG_MISSING_VERSION';
  end if;
  if jsonb_typeof(p_config->'version') <> 'number' then
    raise exception 'CONFIG_INVALID_VERSION_TYPE';
  end if;
  if (p_config->>'version')::numeric <> floor((p_config->>'version')::numeric) then
    raise exception 'CONFIG_INVALID_VERSION_TYPE: version must be an integer';
  end if;
  if (p_config->>'version')::numeric <> 1 then
    raise exception 'CONFIG_UNSUPPORTED_VERSION: %', p_config->>'version';
  end if;

  v_result := p_config;

  -- C. boolean 키 — 존재 시 타입 검증, 누락 시 false 보충
  foreach v_key in array v_bool_keys loop
    if v_result ? v_key then
      if jsonb_typeof(v_result->v_key) <> 'boolean' then
        raise exception 'CONFIG_INVALID_BOOLEAN: %', v_key;
      end if;
    else
      v_result := jsonb_set(v_result, array[v_key], 'false'::jsonb);
    end if;
  end loop;

  -- D. slot_mode — 존재 시 string+허용값 검증, 누락 시 "none" 보충
  if v_result ? 'slot_mode' then
    if jsonb_typeof(v_result->'slot_mode') <> 'string' then
      raise exception 'CONFIG_INVALID_SLOT_MODE: not a string';
    end if;
    if v_result->>'slot_mode' not in ('none','ordered','timed') then
      raise exception 'CONFIG_INVALID_SLOT_MODE: %', v_result->>'slot_mode';
    end if;
  else
    v_result := jsonb_set(v_result, '{slot_mode}', '"none"'::jsonb);
  end if;

  -- E. nullable numeric — null 또는 정수(소수 금지) + 최소값 검증, 누락 시 null 보충
  foreach v_key in array v_numeric_keys loop
    if v_result ? v_key then
      if jsonb_typeof(v_result->v_key) <> 'null' then
        if jsonb_typeof(v_result->v_key) <> 'number' then
          raise exception 'CONFIG_INVALID_NUMBER: %', v_key;
        end if;
        if (v_result->>v_key)::numeric <> floor((v_result->>v_key)::numeric) then
          raise exception 'CONFIG_INVALID_NUMBER: % must be an integer', v_key;
        end if;
        if (v_result->>v_key)::numeric < (v_min_values->>v_key)::numeric then
          raise exception 'CONFIG_OUT_OF_RANGE: %', v_key;
        end if;
      end if;
    else
      v_result := jsonb_set(v_result, array[v_key], 'null'::jsonb);
    end if;
  end loop;

  -- G. 기능 조합 차단 없음(의도적으로 비움) — court_assignment_enabled=true+
  -- slot_mode=none, auto_generation_enabled=true+attendance_enabled=false 등
  -- 전부 허용(구조적으로 불가능한 값만 위에서 이미 차단됨)

  return v_result;
end;
$$;

-- ★ 수정 1: service_role은 revoke하지 않는다 — clubs CHECK 평가 문맥이
-- service_role 자신이기 때문(위 배경 설명 참고).
revoke all on function public.normalize_match_config(jsonb) from public, anon, authenticated;
grant execute on function public.normalize_match_config(jsonb) to service_role;

-- ============================================================
-- 2) clubs.match_config_defaults
-- ============================================================
alter table public.clubs
  add column match_config_defaults jsonb not null
  default '{
    "version": 1,
    "attendance_enabled": false,
    "participant_confirmation_required": false,
    "court_assignment_enabled": false,
    "slot_mode": "none",
    "pre_scheduling_enabled": false,
    "live_queue_enabled": false,
    "auto_generation_enabled": false,
    "review_required": false,
    "court_count": null,
    "max_games_per_member": null,
    "rest_gap_minutes": null,
    "partner_repeat_limit": null,
    "opponent_repeat_limit": null
  }'::jsonb;

comment on column public.clubs.match_config_defaults is
  'Event 생성 시 snapshot으로 복사되는 클럽 기본 운영 설정(config v1).
   정상 변경 경로는 set_club_match_config_defaults RPC뿐이나(코드 레벨
   계약, center-court PATCH의 명시적 whitelist로도 보강됨), 이 컬럼
   자체가 DB 권한상 RPC 전용으로 잠겨있는 것은 아니다 — clubs 테이블
   전체가 이미 service_role에 ALL PRIVILEGES를 갖고 있다(0049). 개인정보/
   보안 정보는 이 jsonb에 절대 저장하지 않는다(공개 SELECT 정책 대상).';

alter table public.clubs
  add constraint clubs_match_config_defaults_normalized
  check (public.normalize_match_config(match_config_defaults) = match_config_defaults);

-- ============================================================
-- 3) events
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  title text not null,
  event_date date not null,
  status text not null default 'draft',
  source text not null default 'native',
  match_config jsonb not null,
  attendance_opened_at timestamptz,
  attendance_closed_at timestamptz,
  participants_confirmed_at timestamptz,
  scheduling_confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_title_not_blank check (btrim(title) <> ''),
  constraint events_status_check check (status in ('draft','active','completed','cancelled')),
  constraint events_source_check check (source in ('native','legacy_attendance_session')),
  constraint events_id_club_id_uniq unique (id, club_id),
  constraint events_match_config_normalized
    check (public.normalize_match_config(match_config) = match_config)
);

comment on table public.events is
  'Match System 2.0 최상위 Event. v1은 하루 단위(event_date만 사용,
   starts_at/ends_at/timezone 없음 — 다일 이벤트는 범위 밖). source=native가
   이번 신규-only cutover에서 실제 생성되는 유일한 값이고, legacy_
   attendance_session은 향후 backfill phase를 위한 예약값일 뿐 이번
   phase에서는 사용하지 않는다. attendance_sessions.event_id 브릿지,
   event_courts/event_sessions/event_participants, matches lifecycle
   전부 별도 phase.';

alter table public.events
  add constraint events_created_by_club_fk
  foreign key (club_id, created_by) references public.members(club_id, id);
-- MATCH SIMPLE(기본값) — created_by가 null이면 이 FK는 검사되지 않으므로
-- nullable 그대로 허용된다.

create index idx_events_club_id_event_date on public.events (club_id, event_date desc);

-- ============================================================
-- 4) events 권한 — ★ 수정 2: service_role도 SELECT만, 쓰기는 RPC 전용
-- ============================================================
alter table public.events enable row level security;
-- 정책 0개 — anon/authenticated는 GRANT 자체가 없어 정책 여부와 무관하게 접근 불가.

revoke all on public.events from public, anon, authenticated, service_role;
grant select on public.events to service_role;
-- INSERT/UPDATE/DELETE는 어떤 role에도 부여하지 않는다. create_event/
-- update_event가 SECURITY DEFINER(정의자=테이블 소유자 권한으로 실행)라
-- 이 revoke와 무관하게 정상 동작한다.

-- ============================================================
-- 5) RPC 3종
-- ============================================================
create function public.create_event(
  p_club_id uuid,
  p_title text,
  p_event_date date,
  p_match_config jsonb default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_status text;
  v_club_default_config jsonb;
  v_title text;
  v_config jsonb;
  v_event_id uuid;
begin
  -- ★ 수정 3: 활성 상태 + 기본 config를 단일 SELECT ... FOR SHARE로 함께 읽는다
  -- (중복 SELECT/레이스 제거).
  select status, match_config_defaults
    into v_club_status, v_club_default_config
    from public.clubs
    where id = p_club_id
    for share;

  if not found then
    raise exception 'CLUB_NOT_FOUND';
  end if;
  if v_club_status <> 'active' then
    raise exception 'CLUB_INACTIVE';
  end if;

  v_title := btrim(p_title);
  if v_title is null or v_title = '' then
    raise exception 'INVALID_TITLE';
  end if;
  if p_event_date is null then
    raise exception 'INVALID_EVENT_DATE';
  end if;

  if p_created_by is not null then
    perform 1 from public.members where id = p_created_by and club_id = p_club_id;
    if not found then
      raise exception 'CREATED_BY_CLUB_MISMATCH';
    end if;
  end if;

  if p_match_config is null then
    v_config := v_club_default_config;
  else
    v_config := p_match_config;
  end if;
  v_config := public.normalize_match_config(v_config);

  insert into public.events (club_id, title, event_date, status, source, match_config, created_by)
  values (p_club_id, v_title, p_event_date, 'draft', 'native', v_config, p_created_by)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create function public.update_event(
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
    v_event.match_config := public.normalize_match_config(p_match_config);
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
      v_event.completed_at := null;  -- 재오픈 시 완료 시각 초기화(승인된 권장안)
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

create function public.set_club_match_config_defaults(
  p_club_id uuid,
  p_match_config_defaults jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config jsonb;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  if not found then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  v_config := public.normalize_match_config(p_match_config_defaults);

  update public.clubs set match_config_defaults = v_config where id = p_club_id;

  return v_config;
end;
$$;

-- ============================================================
-- 6) RPC 권한
-- ============================================================
revoke all on function public.create_event(uuid, text, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_event(uuid, text, date, jsonb, uuid) to service_role;

revoke all on function public.update_event(uuid, uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_event(uuid, uuid, text, date, text, jsonb) to service_role;

revoke all on function public.set_club_match_config_defaults(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_club_match_config_defaults(uuid, jsonb) to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop function if exists public.set_club_match_config_defaults(uuid, jsonb);
-- drop function if exists public.update_event(uuid, uuid, text, date, text, jsonb);
-- drop function if exists public.create_event(uuid, text, date, jsonb, uuid);
--
-- drop table if exists public.events;
--
-- alter table public.clubs drop constraint if exists clubs_match_config_defaults_normalized;
-- alter table public.clubs drop column if exists match_config_defaults;
--
-- drop function if exists public.normalize_match_config(jsonb);
--
-- commit;
