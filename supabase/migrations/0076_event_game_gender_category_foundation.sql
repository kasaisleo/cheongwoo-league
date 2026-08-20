-- ============================================================
-- 0076: Game 종류(gender_category) 정본 + ordered 동시 출전 가드
--       (Phase 2A-9D-A)
--
-- 이 migration 은 자동 대진의 "기반"만 만든다. 자동 대진 알고리즘,
-- pairing run, seed/input snapshot, preview/commit, Game 수 감소,
-- 단계형 UI 는 여기서 만들지 않는다. source='auto' Game 도 만들지 않는다.
--
-- ------------------------------------------------------------
-- [A] Game 종류
-- ------------------------------------------------------------
--   event_games.gender_category        mens | womens | mixed | open | NULL
--   event_games.gender_category_source configured | inferred | NULL
--   두 컬럼은 항상 함께 NULL 이거나 함께 값이 있다(paired CHECK).
--   기존 Game 은 backfill 하지 않고 둘 다 NULL(=미분류)로 남는다.
--
--   configured : 관리자(또는 후속 자동 대진 엔진)가 먼저 지정한 상태.
--                lineup 이 조건을 어기면 자동으로 open 으로 완화하지 않고
--                EVENT_GAME_CATEGORY_MISMATCH 로 거부한다.
--   inferred   : 종류를 지정하지 않은 Game 의 lineup 을 저장할 때
--                team/slot + 선수 성별로 같은 트랜잭션에서 판정한 값.
--
--   성별 판정값은 event_participants.gender_snapshot 이 정본이고,
--   회원 participant 의 snapshot 이 NULL 이면 members.gender 로 fallback 한다.
--   명시적으로 저장된 'unspecified' 는 fallback 하지 않는다(coalesce 가
--   snapshot 을 우선하므로 구조적으로 보장된다). 게스트 NULL 은 미설정이다.
--
--   snapshot 이 NULL 인 회원 participant 는 lineup 을 실제로 저장하는 같은
--   트랜잭션에서 master 값을 그대로 snapshot 으로 굳힌다(materialize) —
--   'unspecified' 도 포함한다. NULL 은 "회원 master 를 따라간다"는 이행 상태이고
--   'unspecified' 는 "그 시점의 회원 Profile 이 명시적으로 미지정"이라는 확정
--   snapshot 이라 의미가 다르다. 0074 이후 새로 만들어지는 회원 participant 는
--   이미 'unspecified' 를 그대로 복사받으므로, legacy NULL 만 lineup 확정 시점에
--   같은 계약으로 수렴시킨다. 이렇게 해야 Game 생성 뒤 회원 master 가 바뀌어도
--   그때의 판정 입력이 변하지 않는다.
--   게스트 participant 의 NULL 은 그대로 NULL 로 남고, 이미 명시적으로 저장된
--   snapshot 값은 어떤 경우에도 덮어쓰지 않는다.
--
-- ------------------------------------------------------------
-- [B] ordered 동시 출전 가드
-- ------------------------------------------------------------
--   기존 _event_game_check_time_conflict 는 starts_at/ends_at 이 둘 다 있는
--   세션끼리만 비교하고(0054), 호출 자체가 slot_mode='timed' 조건부다(0062).
--   그래서 ordered 모드에서 같은 position 의 다른 Court 에 같은 선수를
--   동시에 넣을 수 있었다. 이 migration 이 그 구멍을 막는다.
--
--     slot_mode='ordered' + 같은 Event + event_sessions.position 동일
--     + Court 가 달라도 + cancelled 가 아닌 다른 Game
--     → 같은 participant 동시 배정 거부 (EVENT_GAME_PLAYER_SLOT_CONFLICT)
--
--   timed 는 기존 시간 겹침 규칙 그대로, none 은 이 규칙을 적용하지 않는다.
--
-- ------------------------------------------------------------
-- [C] 수동 변경 보호
-- ------------------------------------------------------------
--   event_games.manually_modified_at timestamptz NULL
--     NULL     = 자동 생성 후 사람이 수정한 증거 없음
--     NOT NULL = source='auto' Game 을 관리자가 실제로 수정함
--   source='manual' Game 은 선수 배정만으로 이 값을 채우지 않는다.
--   동일 payload no-op 은 값을 바꾸지 않는다.
--   inferred category 의 원자적 재계산 자체는 수동 변경으로 기록하지 않는다.
--   Court/Session 배치는 이 timestamp 가 아니라 event_court_id/
--   event_session_id 자체로 보호한다(place_event_game 은 값을 건드리지 않는다).
--   CHECK(manually_modified_at is null or source='auto') 로 의미를 DB 가 강제한다.
--
-- ------------------------------------------------------------
-- [D] no-op 과 충돌 검증의 순서 (2A-9D-A 승인)
-- ------------------------------------------------------------
--   set_event_game_players 는
--     category 검증 → diff 계산 → no-op return → ordered/timed 충돌 검증
--   순서를 쓴다.
--     · category 검증은 반드시 no-op 앞이다 — 같은 payload 라도 configured
--       조건을 어기면 통과시키지 않는다.
--     · 충돌 검증은 no-op 뒤다 — 동일 payload 는 누가 어디에 배정됐는지를
--       바꾸지 않아 새 충돌을 만들지 않고, 여기서 막아도 이미 존재하는 충돌을
--       해소할 수 없다. 원본(0062)의 "동일 payload no-op" 계약도 보존된다.
--     · 실제 lineup 저장은 언제나 충돌 검증을 통과한 뒤에만 일어난다.
--     · place_event_game 은 반대로 배치 변경 "전에" 충돌을 검사한다 —
--       배치 이동은 그 자체로 새 충돌을 만들기 때문이다(원본 timed 위치와 동일).
--   전제: Production 기존 데이터에 ordered 충돌이 0건임을 적용 전에 확인한다.
--
-- ------------------------------------------------------------
-- 이 파일이 바꾸는 것 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] event_games 컬럼 3개 + CHECK 4개 + COMMENT
--   [2] _event_game_gender_stats        (신규 private helper)
--   [3] _event_game_infer_category      (신규 private helper)
--   [4] _event_game_validate_category   (신규 private helper)
--   [5] _event_game_check_slot_conflict (신규 private helper)
--   [6] _event_game_materialize_gender  (신규 private helper)
--   [7] create_event_game       재정의 (signature 불변)
--   [8] update_event_game       재정의 (signature 불변)
--   [9] set_event_game_players  재정의 (signature 불변)
--  [10] place_event_game        재정의 (signature 불변)
--  [11] set_event_game_gender_category (신규 공개 RPC, service_role 전용)
--
-- 라인업을 쓰는 경로는 셋(create/update/set_players)이고 배치를 바꾸는 경로는
-- 하나(place)다. 셋 중 하나라도 빠지면 "lineup 을 저장하면 판정한다"와
-- "configured 는 완화하지 않는다"가 그 경로에서 무너지고, place 가 빠지면
-- ordered 가드를 배치 이동으로 우회할 수 있다. 그래서 넷을 모두 재정의한다.
--
-- 건드리지 않는 것: 기존 signature/반환 계약, full replace 계약,
--   partial assignment 금지, draft lock, Club scope, 동일 payload no-op,
--   RLS/policy/relation ACL, Public RPC, member_stats, 사용자 데이터 backfill,
--   members.rating / members.grade / guests.skill_grade,
--   기존 migration 원문.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ------------------------------------------------------------
-- [0] 사전 조건 검증 — 기대한 구조가 아니면 아무것도 바꾸지 않고 중단한다.
--     signature 비교는 format_type 타입 배열로 한다
--     (pg_get_function_identity_arguments 는 인자 "이름"까지 포함한다).
-- ------------------------------------------------------------
do $pre$
declare
  v_cnt integer;
  v_types text[];
begin
  if to_regclass('public.event_games') is null then
    raise exception 'M0076_PRE_TABLE_MISSING: public.event_games';
  end if;

  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_games'::regclass
      and attname in ('gender_category', 'gender_category_source', 'manually_modified_at')
      and not attisdropped
  ) then
    raise exception 'M0076_PRE_COLUMN_EXISTS: gender_category columns already present';
  end if;

  -- 재정의 대상 4종의 현재 signature 확인.
  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_event_game', 'update_event_game', 'set_event_game_players', 'place_event_game');
  if v_cnt <> 4 then
    raise exception 'M0076_PRE_TARGET_FN_COUNT: expected 4, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_game_players';
  if v_types is distinct from array['uuid', 'uuid', 'uuid', 'uuid[]', 'text[]', 'integer[]']::text[] then
    raise exception 'M0076_PRE_SET_PLAYERS_SIGNATURE: %', v_types;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'place_event_game';
  if v_types is distinct from array['uuid', 'uuid', 'uuid', 'uuid', 'uuid']::text[] then
    raise exception 'M0076_PRE_PLACE_SIGNATURE: %', v_types;
  end if;

  -- 이번 migration 이 의존하는 기존 helper 3종이 있어야 한다.
  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('_event_game_validate_players', '_event_game_validate_placement', '_event_game_check_time_conflict');
  if v_cnt <> 3 then
    raise exception 'M0076_PRE_HELPER_COUNT: expected 3, found %', v_cnt;
  end if;

  -- 신규 RPC 이름이 이미 있으면 중단한다.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_event_game_gender_category'
  ) then
    raise exception 'M0076_PRE_RPC_EXISTS: set_event_game_gender_category';
  end if;
end
$pre$;

-- ------------------------------------------------------------
-- [1] event_games 컬럼
-- ------------------------------------------------------------
alter table public.event_games
  add column gender_category text,
  add column gender_category_source text,
  add column manually_modified_at timestamptz;

alter table public.event_games
  add constraint event_games_gender_category_check
  check (gender_category is null or gender_category in ('mens', 'womens', 'mixed', 'open'));

alter table public.event_games
  add constraint event_games_gender_category_source_check
  check (gender_category_source is null or gender_category_source in ('configured', 'inferred'));

alter table public.event_games
  add constraint event_games_gender_category_paired_check
  check ((gender_category is null) = (gender_category_source is null));

-- 컬럼의 의미를 DB 에서도 강제한다: manual Game 은 이 timestamp 를 가질 수 없고,
-- auto Game 만 수동 수정 시 값을 가진다(auto 라고 반드시 필요한 것은 아니다).
-- 기존 Game 은 전부 source='manual' + timestamp NULL 이므로 backfill 없이 통과한다.
alter table public.event_games
  add constraint event_games_manually_modified_source_check
  check (manually_modified_at is null or source = 'auto');

comment on column public.event_games.gender_category is
  'Game 종류. mens(남복) | womens(여복) | mixed(혼복) | open(잡복) | NULL(미분류).
   Court/Session 이 아니라 Game 이 소유한다. 기존 Game 은 NULL 로 남는다.';
comment on column public.event_games.gender_category_source is
  'gender_category 를 누가 정했는지. configured(먼저 지정) | inferred(lineup 에서 판정) | NULL.
   gender_category 와 항상 함께 NULL 이거나 함께 값이 있다.';
comment on column public.event_games.manually_modified_at is
  'source=''auto'' Game 을 관리자가 실제로 수정한 시각. NULL 이면 수정 증거 없음.
   manual Game 은 선수 배정만으로 채워지지 않고, 동일 payload no-op 도 값을 바꾸지 않는다.';

-- ------------------------------------------------------------
-- [2] _event_game_gender_stats — 성별 집계(정본 + fallback)
--
-- SECURITY DEFINER 가 아니다. 소유자(postgres)가 SECURITY DEFINER 외부 함수
-- 안에서 호출하므로 EXECUTE 회수와 무관하게 동작한다(0054 private helper 관례).
-- gender_snapshot 이 우선이므로 명시적 'unspecified' 는 fallback 되지 않는다.
-- ------------------------------------------------------------
create function public._event_game_gender_stats(
  p_event_id uuid,
  p_club_id uuid,
  p_participant_ids uuid[],
  p_teams text[]
) returns table(
  total_count integer,
  male_count integer,
  female_count integer,
  unknown_count integer,
  team_a_male integer,
  team_a_female integer,
  team_b_male integer,
  team_b_female integer
)
language sql
stable
set search_path = ''
as $$
  with g as (
    select
      u.team as team,
      coalesce(ep.gender_snapshot, case when ep.member_id is not null then m.gender end) as gender
    from unnest(p_participant_ids, p_teams) as u(pid, team)
    join public.event_participants ep
      on ep.id = u.pid and ep.event_id = p_event_id and ep.club_id = p_club_id
    left join public.members m
      on m.id = ep.member_id and m.club_id = ep.club_id
  )
  select
    count(*)::integer,
    count(*) filter (where gender = 'male')::integer,
    count(*) filter (where gender = 'female')::integer,
    count(*) filter (where gender is null or gender = 'unspecified')::integer,
    count(*) filter (where team = 'A' and gender = 'male')::integer,
    count(*) filter (where team = 'A' and gender = 'female')::integer,
    count(*) filter (where team = 'B' and gender = 'male')::integer,
    count(*) filter (where team = 'B' and gender = 'female')::integer
  from g;
$$;

revoke all on function public._event_game_gender_stats(uuid, uuid, uuid[], text[])
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [3] _event_game_infer_category — lineup 에서 종류를 판정한다.
--
--   doubles: 남4 → mens / 여4 → womens
--            남2+여2 이고 각 팀이 남1+여1 → mixed
--            그 밖(남+남 vs 여+여, 3남1여, unspecified/NULL 포함) → open
--   singles: 남2 → mens / 여2 → womens / 그 밖 → open (mixed 없음)
-- ------------------------------------------------------------
create function public._event_game_infer_category(
  p_event_id uuid,
  p_club_id uuid,
  p_format text,
  p_participant_ids uuid[],
  p_teams text[]
) returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  s record;
  v_required integer;
begin
  if p_participant_ids is null or p_teams is null then
    return null;
  end if;

  v_required := case p_format when 'singles' then 2 else 4 end;

  select * into s
  from public._event_game_gender_stats(p_event_id, p_club_id, p_participant_ids, p_teams);

  if s.total_count <> v_required then
    return null;
  end if;

  if s.male_count = v_required then
    return 'mens';
  end if;
  if s.female_count = v_required then
    return 'womens';
  end if;
  if p_format = 'doubles'
     and s.male_count = 2 and s.female_count = 2
     and s.team_a_male = 1 and s.team_a_female = 1
     and s.team_b_male = 1 and s.team_b_female = 1
  then
    return 'mixed';
  end if;

  return 'open';
end;
$$;

revoke all on function public._event_game_infer_category(uuid, uuid, text, uuid[], text[])
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [4] _event_game_validate_category — configured 조건 강제
--
-- 값 자체가 틀리면 EVENT_GAME_CATEGORY_INVALID(400),
-- lineup 이 조건을 어기면 EVENT_GAME_CATEGORY_MISMATCH(409).
-- 부족한 인원을 open 으로 자동 완화하지 않는다.
-- ------------------------------------------------------------
create function public._event_game_validate_category(
  p_event_id uuid,
  p_club_id uuid,
  p_category text,
  p_format text,
  p_participant_ids uuid[],
  p_teams text[]
) returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  s record;
  v_required integer;
begin
  if p_category is null then
    return;
  end if;
  if p_category not in ('mens', 'womens', 'mixed', 'open') then
    raise exception 'EVENT_GAME_CATEGORY_INVALID: %', p_category;
  end if;
  if p_category = 'mixed' and p_format <> 'doubles' then
    raise exception 'EVENT_GAME_CATEGORY_MISMATCH: mixed requires doubles';
  end if;
  -- open 은 성별 제한이 없다. 값 검증만 하고 통과시킨다.
  if p_category = 'open' then
    return;
  end if;
  -- lineup 이 아직 없으면 조건을 걸 대상이 없다(빈 Game 에 미리 지정하는 경로).
  if p_participant_ids is null or p_teams is null then
    return;
  end if;

  v_required := case p_format when 'singles' then 2 else 4 end;

  select * into s
  from public._event_game_gender_stats(p_event_id, p_club_id, p_participant_ids, p_teams);

  if p_category = 'mens' and s.male_count <> v_required then
    raise exception 'EVENT_GAME_CATEGORY_MISMATCH: mens requires % male players', v_required;
  end if;
  if p_category = 'womens' and s.female_count <> v_required then
    raise exception 'EVENT_GAME_CATEGORY_MISMATCH: womens requires % female players', v_required;
  end if;
  if p_category = 'mixed'
     and not (s.male_count = 2 and s.female_count = 2
              and s.team_a_male = 1 and s.team_a_female = 1
              and s.team_b_male = 1 and s.team_b_female = 1)
  then
    raise exception 'EVENT_GAME_CATEGORY_MISMATCH: mixed requires one male and one female per team';
  end if;
end;
$$;

revoke all on function public._event_game_validate_category(uuid, uuid, text, text, uuid[], text[])
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [5] _event_game_check_slot_conflict — ordered 동시 출전 가드
--
-- 호출부가 slot_mode='ordered' 일 때만 부른다. 같은 Event 안에서 같은
-- event_sessions.position 을 쓰는 다른 Court 의 non-cancelled Game 과
-- participant 가 겹치면 거부한다. 자기 Game 은 제외하고, Club/Event 경계를
-- 넘는 조회를 하지 않는다(세션도 같은 Event 로 한정).
-- 후속 자동 대진 commit RPC 도 이 helper 를 그대로 재사용한다.
-- ------------------------------------------------------------
create function public._event_game_check_slot_conflict(
  p_event_id uuid,
  p_exclude_game_id uuid,
  p_participant_ids uuid[],
  p_event_session_id uuid
) returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_position integer;
begin
  if p_event_session_id is null or p_participant_ids is null then
    return;
  end if;

  select es.position into v_position
  from public.event_sessions es
  where es.id = p_event_session_id and es.event_id = p_event_id;

  if v_position is null then
    return;
  end if;

  perform 1
  from public.event_game_players egp
  join public.event_games eg on eg.id = egp.event_game_id
  join public.event_sessions es on es.id = eg.event_session_id
  where eg.event_id = p_event_id
    and (p_exclude_game_id is null or eg.id <> p_exclude_game_id)
    and eg.status <> 'cancelled'
    and eg.event_session_id is not null
    and es.event_id = p_event_id
    and es.position = v_position
    and egp.event_participant_id = any(p_participant_ids);

  if found then
    raise exception 'EVENT_GAME_PLAYER_SLOT_CONFLICT: participant already scheduled in the same ordered position';
  end if;
end;
$$;

revoke all on function public._event_game_check_slot_conflict(uuid, uuid, uuid[], uuid)
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [6] _event_game_materialize_gender — fallback 성별을 snapshot 으로 고정
--
-- lineup 을 실제로 저장하는 트랜잭션에서만 호출한다(no-op 경로에서는 부르지
-- 않는다). 회원 participant 이면서 snapshot 이 NULL 인 경우 master 값을 그대로
-- 굳힌다 — 'unspecified' 도 포함한다(NULL 은 fallback 이행 상태, 'unspecified'
-- 는 "그 시점에 명시적으로 미지정"이라는 확정 snapshot 이다).
-- 게스트(member_id is null)는 대상이 아니고, 이미 값이 있는 snapshot 은
-- 덮어쓰지 않는다(where 절의 gender_snapshot is null 이 그것을 보장한다).
-- members.gender 는 NOT NULL + CHECK(male|female|unspecified) 이므로
-- 별도 값 필터가 필요 없다.
-- ------------------------------------------------------------
create function public._event_game_materialize_gender(
  p_event_id uuid,
  p_club_id uuid,
  p_participant_ids uuid[]
) returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_participant_ids is null then
    return;
  end if;

  update public.event_participants ep
  set gender_snapshot = m.gender,
      updated_at = now()
  from public.members m
  where ep.id = any(p_participant_ids)
    and ep.event_id = p_event_id
    and ep.club_id = p_club_id
    and ep.gender_snapshot is null
    and ep.member_id is not null
    and m.id = ep.member_id
    and m.club_id = ep.club_id;
end;
$$;

revoke all on function public._event_game_materialize_gender(uuid, uuid, uuid[])
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [7] create_event_game  (원본: 0062 — 아래 표시한 곳만 추가)
--
-- 추가: ordered 충돌 검증 / 성별 materialize / inferred category 기록.
-- 신규 Game 은 source='manual' 로 만들어지므로 manually_modified_at 은
-- 건드리지 않는다.
-- ------------------------------------------------------------
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
  v_category text;
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

  -- ★ 0076: ordered 는 같은 position 의 다른 Court 와 동시 출전을 막는다.
  if p_event_session_id is not null and v_slot_mode = 'ordered' then
    perform public._event_game_check_slot_conflict(
      p_event_id, null, p_participant_ids, p_event_session_id
    );
  end if;

  -- ★ 0076: 저장 직전에 회원 성별 fallback 을 snapshot 으로 굳힌 뒤 판정한다.
  perform public._event_game_materialize_gender(p_event_id, p_club_id, p_participant_ids);
  v_category := public._event_game_infer_category(
    p_event_id, p_club_id, p_format, p_participant_ids, p_teams
  );

  select coalesce(max(position), 0) + 1 into v_position
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id;

  begin
    insert into public.event_games (
      event_id, club_id, event_court_id, event_session_id,
      format, status, source, position, created_by,
      gender_category, gender_category_source
    ) values (
      p_event_id, p_club_id, p_event_court_id, p_event_session_id,
      p_format, 'draft', 'manual', v_position, p_created_by,
      v_category, case when v_category is null then null else 'inferred' end
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

-- ------------------------------------------------------------
-- [8] update_event_game  (원본: 0062 — format 변경 + 라인업 전체 교체)
--
-- 추가: configured 검증 / ordered 충돌 / materialize / category 재계산 /
--       source='auto' 의 실제 변경만 manually_modified_at 기록.
-- 분기 1~7 의 판정 순서와 오류 문구는 원본 그대로다.
-- ------------------------------------------------------------
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
  v_category text;
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
    if p_format is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: p_format must be null when p_format_supplied is false';
    end if;
    if p_participant_ids is not null or p_teams is not null or p_slots is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: use set_event_game_players to replace players without a format change';
    end if;
    return;
  end if;

  if p_format is null then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: format cannot be set to null';
  end if;

  if p_format = v_game.format then
    if p_participant_ids is not null or p_teams is not null or p_slots is not null then
      raise exception 'EVENT_GAME_INVALID_PLAYERS: use set_event_game_players to replace players without a format change';
    end if;
    return;
  end if;

  if p_participant_ids is null or p_teams is null or p_slots is null then
    raise exception 'EVENT_GAME_INVALID_PLAYERS: players are required when changing format';
  end if;

  perform public._event_game_validate_players(
    p_event_id, p_club_id, p_format, p_participant_ids, p_teams, p_slots
  );

  -- ★ 0076: configured 는 새 format/lineup 에서도 조건을 지켜야 한다.
  --   (예: configured='mixed' 인 Game 을 singles 로 바꾸면 여기서 거부된다.)
  if v_game.gender_category_source = 'configured' then
    perform public._event_game_validate_category(
      p_event_id, p_club_id, v_game.gender_category, p_format, p_participant_ids, p_teams
    );
  end if;

  if v_game.event_session_id is not null and v_slot_mode = 'timed' then
    select starts_at, ends_at into v_session_starts_at, v_session_ends_at
    from public.event_sessions
    where id = v_game.event_session_id and event_id = p_event_id and club_id = p_club_id;

    perform public._event_game_check_time_conflict(
      p_event_id, p_game_id, p_participant_ids, v_session_starts_at, v_session_ends_at
    );
  end if;

  -- ★ 0076: ordered 동시 출전 가드.
  if v_game.event_session_id is not null and v_slot_mode = 'ordered' then
    perform public._event_game_check_slot_conflict(
      p_event_id, p_game_id, p_participant_ids, v_game.event_session_id
    );
  end if;

  -- ★ 0076: 실제 저장 경로이므로 성별을 굳히고 category 를 다시 정한다.
  perform public._event_game_materialize_gender(p_event_id, p_club_id, p_participant_ids);

  if v_game.gender_category_source = 'configured' then
    v_category := v_game.gender_category;
  else
    v_category := public._event_game_infer_category(
      p_event_id, p_club_id, p_format, p_participant_ids, p_teams
    );
  end if;

  update public.event_games
  set format = p_format,
      gender_category = v_category,
      gender_category_source = case
        when v_category is null then null
        when v_game.gender_category_source = 'configured' then 'configured'
        else 'inferred'
      end,
      -- source='auto' Game 의 실제 변경만 수동 수정으로 기록한다.
      manually_modified_at = case
        when v_game.source = 'auto' then now()
        else v_game.manually_modified_at
      end,
      updated_at = now()
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

-- ------------------------------------------------------------
-- [9] set_event_game_players  (원본: 0062)
--
-- ★ 순서가 중요하다: configured category 검증은 no-op 조기 return 보다
--   반드시 먼저 실행된다. 이미 저장된 lineup 과 같은 payload 라도
--   configured 조건을 위반하면 통과시키지 않는다.
--
-- 시간/순번 충돌 검증은 원본과 같이 no-op 판정 "뒤"에 둔다 — 동일 payload
-- 는 누가 어디에 배정됐는지를 바꾸지 않으므로 충돌 상태를 새로 만들지
-- 않고, 여기서 막아도 이미 존재하는 충돌을 해소할 수 없기 때문이다.
-- (원본의 no-op 계약을 보존한다. 자세한 근거는 파일 머리의 [D] 참고.)
--
-- no-op 경로에서는 어떤 데이터도 바뀌지 않는다: lineup DML 없음,
-- materialize 호출 없음, category 갱신 없음, manually_modified_at 갱신 없음,
-- event_games.updated_at 갱신 없음.
-- ------------------------------------------------------------
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
  v_category text;
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

  -- ★ 0076: configured 조건은 no-op 판정보다 먼저 강제한다.
  if v_game.gender_category_source = 'configured' then
    perform public._event_game_validate_category(
      p_event_id, p_club_id, v_game.gender_category, v_game.format, p_participant_ids, p_teams
    );
  end if;

  -- no-op 판정: (participant, team, slot) 집합이 현재와 완전히 동일하면 대칭차 0.
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

  -- ★ 0076: ordered 동시 출전 가드.
  if v_game.event_session_id is not null and v_slot_mode = 'ordered' then
    perform public._event_game_check_slot_conflict(
      p_event_id, p_game_id, p_participant_ids, v_game.event_session_id
    );
  end if;

  -- ★ 0076: 실제 저장 경로 — 성별 확정 후 category 를 유지/재계산한다.
  perform public._event_game_materialize_gender(p_event_id, p_club_id, p_participant_ids);

  if v_game.gender_category_source = 'configured' then
    v_category := v_game.gender_category;
  else
    v_category := public._event_game_infer_category(
      p_event_id, p_club_id, v_game.format, p_participant_ids, p_teams
    );
  end if;

  delete from public.event_game_players where event_game_id = p_game_id;

  insert into public.event_game_players (event_game_id, event_id, club_id, event_participant_id, team, slot)
  select p_game_id, p_event_id, p_club_id, pid, team, slot
  from unnest(p_participant_ids, p_teams, p_slots) as u(pid, team, slot);

  update public.event_games
  set gender_category = v_category,
      gender_category_source = case
        when v_category is null then null
        when v_game.gender_category_source = 'configured' then 'configured'
        else 'inferred'
      end,
      manually_modified_at = case
        when v_game.source = 'auto' then now()
        else v_game.manually_modified_at
      end,
      updated_at = now()
  where id = p_game_id;
end;
$$;

revoke all on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
from public, anon, authenticated;
grant execute on function public.set_event_game_players(uuid, uuid, uuid, uuid[], text[], integer[])
to service_role;

-- ------------------------------------------------------------
-- [10] place_event_game  (원본: 0062)
--
-- 추가: ordered 동시 출전 가드. 원본이 timed 충돌을 no-op 판정 "앞"에서
-- 검사하므로 ordered 도 같은 위치에 둔다(배치 이동은 충돌을 새로 만든다).
-- manually_modified_at 은 건드리지 않는다 — 배치는 event_court_id /
-- event_session_id 자체로 보호한다.
-- ------------------------------------------------------------
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

  perform public._event_game_validate_placement(
    p_event_id, p_club_id, v_slot_mode, p_event_court_id, p_event_session_id
  );

  if p_event_session_id is not null and v_slot_mode in ('timed', 'ordered') then
    select array_agg(event_participant_id) into v_participant_ids
    from public.event_game_players
    where event_game_id = p_game_id;

    if v_participant_ids is not null then
      if v_slot_mode = 'timed' then
        select starts_at, ends_at into v_session_starts_at, v_session_ends_at
        from public.event_sessions
        where id = p_event_session_id and event_id = p_event_id and club_id = p_club_id;

        -- 자기 게임은 충돌 대상에서 제외(p_exclude_game_id = p_game_id).
        perform public._event_game_check_time_conflict(
          p_event_id, p_game_id, v_participant_ids, v_session_starts_at, v_session_ends_at
        );
      else
        -- ★ 0076: ordered 는 같은 position 의 다른 Court 와 겹칠 수 없다.
        perform public._event_game_check_slot_conflict(
          p_event_id, p_game_id, v_participant_ids, p_event_session_id
        );
      end if;
    end if;
  end if;

  -- no-op 판정은 위 검증을 모두 통과한 뒤에만 수행한다.
  if v_game.event_court_id is not distinct from p_event_court_id
     and v_game.event_session_id is not distinct from p_event_session_id
  then
    return;
  end if;

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

-- ------------------------------------------------------------
-- [11] set_event_game_gender_category — Game 종류 지정/해제 (신규 공개 RPC)
--
--   p_gender_category = 'mens'|'womens'|'mixed'|'open' → configured
--   p_gender_category = null
--     · lineup 이 완성돼 있으면 현재 lineup 으로 즉시 재판정 → inferred
--     · lineup 이 없으면 category/source 모두 NULL
--
--   draft Game 만 변경할 수 있고 completed/cancelled Event 는 잠긴다.
--   기존 lineup 이 있는 Game 을 configured 로 바꿀 때는 그 lineup 으로
--   조건을 먼저 검증한다(자동 완화 없음).
--   동일 값이면 no-op 이며 어떤 컬럼도 바뀌지 않는다.
--   source='auto' Game 의 실제 변경만 manually_modified_at 을 기록한다.
-- ------------------------------------------------------------
create function public.set_event_game_gender_category(
  p_game_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_gender_category text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_game public.event_games%rowtype;
  v_ids uuid[];
  v_teams text[];
  v_required integer;
  v_category text;
  v_source text;
begin
  if p_gender_category is not null
     and p_gender_category not in ('mens', 'womens', 'mixed', 'open')
  then
    raise exception 'EVENT_GAME_CATEGORY_INVALID: %', p_gender_category;
  end if;

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

  -- 현재 lineup 을 team 순서로 모은다(완성된 경우에만 판정/검증에 쓴다).
  select array_agg(egp.event_participant_id order by egp.team, egp.slot),
         array_agg(egp.team order by egp.team, egp.slot)
    into v_ids, v_teams
  from public.event_game_players egp
  where egp.event_game_id = p_game_id;

  v_required := case v_game.format when 'singles' then 2 else 4 end;
  if coalesce(array_length(v_ids, 1), 0) <> v_required then
    v_ids := null;
    v_teams := null;
  end if;

  if p_gender_category is null then
    if v_ids is null then
      v_category := null;
      v_source := null;
    else
      v_category := public._event_game_infer_category(
        p_event_id, p_club_id, v_game.format, v_ids, v_teams
      );
      v_source := case when v_category is null then null else 'inferred' end;
    end if;
  else
    -- lineup 이 있으면 즉시 검증한다. 없으면 빈 Game 에 미리 지정하는 경로다.
    perform public._event_game_validate_category(
      p_event_id, p_club_id, p_gender_category, v_game.format, v_ids, v_teams
    );
    v_category := p_gender_category;
    v_source := 'configured';
  end if;

  if v_game.gender_category is not distinct from v_category
     and v_game.gender_category_source is not distinct from v_source
  then
    return;
  end if;

  update public.event_games
  set gender_category = v_category,
      gender_category_source = v_source,
      manually_modified_at = case
        when v_game.source = 'auto' then now()
        else v_game.manually_modified_at
      end,
      updated_at = now()
  where id = p_game_id and event_id = p_event_id and club_id = p_club_id;
end;
$$;

revoke all privileges on function public.set_event_game_gender_category(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.set_event_game_gender_category(uuid, uuid, uuid, text)
to service_role;

comment on function public.set_event_game_gender_category(uuid, uuid, uuid, text) is
'Game 종류를 지정하거나(configured) 해제한다(0076). NULL 을 넘기면 완성된
lineup 이 있을 때 즉시 재판정해 inferred 로 두고, lineup 이 없으면 종류와
source 를 모두 NULL 로 되돌린다. draft Game 만 바꿀 수 있고 조건을 어기는
lineup 은 자동으로 open 으로 완화하지 않는다.';

-- ------------------------------------------------------------
-- [12] 사후 조건 검증
-- ------------------------------------------------------------
do $post$
declare
  v_cnt integer;
  v_types text[];
  v_acl aclitem[];
  v_owner oid;
  r record;
begin
  -- 12-1) 컬럼 3개와 타입/nullability/default.
  select count(*) into v_cnt
  from pg_attribute a
  where a.attrelid = 'public.event_games'::regclass
    and not a.attisdropped
    and ((a.attname = 'gender_category' and a.atttypid = 'text'::regtype and not a.attnotnull)
      or (a.attname = 'gender_category_source' and a.atttypid = 'text'::regtype and not a.attnotnull)
      or (a.attname = 'manually_modified_at' and a.atttypid = 'timestamptz'::regtype and not a.attnotnull));
  if v_cnt <> 3 then
    raise exception 'M0076_POST_COLUMNS: expected 3, found %', v_cnt;
  end if;

  if exists (
    select 1 from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.event_games'::regclass
      and a.attname in ('gender_category', 'gender_category_source', 'manually_modified_at')
  ) then
    raise exception 'M0076_POST_UNEXPECTED_DEFAULT';
  end if;

  -- 12-2) CHECK 4종.
  select count(*) into v_cnt
  from pg_constraint c
  where c.conrelid = 'public.event_games'::regclass and c.contype = 'c'
    and c.conname in (
      'event_games_gender_category_check',
      'event_games_gender_category_source_check',
      'event_games_gender_category_paired_check',
      'event_games_manually_modified_source_check'
    );
  if v_cnt <> 4 then
    raise exception 'M0076_POST_CHECKS: expected 4, found %', v_cnt;
  end if;

  -- 12-3) 기존 Game 은 backfill 되지 않았다.
  select count(*) into v_cnt
  from public.event_games
  where gender_category is not null
     or gender_category_source is not null
     or manually_modified_at is not null;
  if v_cnt <> 0 then
    raise exception 'M0076_POST_UNEXPECTED_BACKFILL: % row(s)', v_cnt;
  end if;

  -- 12-4) 재정의된 4종의 signature 가 그대로다.
  for r in
    select * from (values
      ('create_event_game', array['uuid','uuid','text','uuid[]','text[]','integer[]','uuid','uuid','uuid']),
      ('update_event_game', array['uuid','uuid','uuid','boolean','text','uuid[]','text[]','integer[]']),
      ('set_event_game_players', array['uuid','uuid','uuid','uuid[]','text[]','integer[]']),
      ('place_event_game', array['uuid','uuid','uuid','uuid','uuid'])
    ) as t(fn, expected)
  loop
    select count(*) into v_cnt
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = r.fn;
    if v_cnt <> 1 then
      raise exception 'M0076_POST_FN_COUNT: % expected 1, found %', r.fn, v_cnt;
    end if;

    select (
      select array_agg(pg_catalog.format_type(t, null) order by ord)
      from unnest(p.proargtypes) with ordinality as u(t, ord)
    ) into v_types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = r.fn;

    if v_types is distinct from r.expected::text[] then
      raise exception 'M0076_POST_FN_SIGNATURE: % is %', r.fn, v_types;
    end if;
  end loop;

  -- 12-5) 신규 helper 5종은 외부 실행 권한이 없어야 한다(소유자 제외).
  for r in
    select p.proname, p.proacl, p.proowner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_event_game_gender_stats', '_event_game_infer_category',
        '_event_game_validate_category', '_event_game_check_slot_conflict',
        '_event_game_materialize_gender'
      )
  loop
    if r.proacl is null then
      raise exception 'M0076_POST_HELPER_ACL_IS_DEFAULT: %', r.proname;
    end if;
    if exists (
      select 1 from aclexplode(r.proacl) a
      where a.privilege_type = 'EXECUTE' and a.grantee <> r.proowner
    ) then
      raise exception 'M0076_POST_HELPER_EXECUTE_REMAINS: %', r.proname;
    end if;
  end loop;

  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      '_event_game_gender_stats', '_event_game_infer_category',
      '_event_game_validate_category', '_event_game_check_slot_conflict',
      '_event_game_materialize_gender'
    );
  if v_cnt <> 5 then
    raise exception 'M0076_POST_HELPER_COUNT: expected 5, found %', v_cnt;
  end if;

  -- 12-6) 신규 공개 RPC — SECURITY DEFINER, 빈 search_path, service_role 전용.
  select p.proacl, p.proowner into v_acl, v_owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_game_gender_category';

  if v_acl is null then
    raise exception 'M0076_POST_RPC_ACL_IS_DEFAULT';
  end if;
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee = 'anon'::regrole or a.grantee = 'authenticated'::regrole)
  ) then
    raise exception 'M0076_POST_RPC_CLIENT_EXECUTE_REMAINS';
  end if;
  if not exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE' and a.grantee = 'service_role'::regrole
  ) then
    raise exception 'M0076_POST_RPC_SERVICE_ROLE_MISSING';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_event_game_gender_category'
      and p.prosecdef
      and p.proconfig is not null
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
  ) then
    raise exception 'M0076_POST_RPC_DEFINER_OR_PATH';
  end if;

  -- 12-7) 재정의한 4종의 SECURITY DEFINER/search_path/ACL 계약도 그대로다.
  for r in
    select p.proname, p.prosecdef, p.proconfig, p.proacl, p.proowner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_event_game', 'update_event_game', 'set_event_game_players', 'place_event_game')
  loop
    if not r.prosecdef then
      raise exception 'M0076_POST_TARGET_NOT_DEFINER: %', r.proname;
    end if;
    if r.proconfig is null or not exists (select 1 from unnest(r.proconfig) c where c like 'search_path=%') then
      raise exception 'M0076_POST_TARGET_SEARCH_PATH: %', r.proname;
    end if;
    if r.proacl is null then
      raise exception 'M0076_POST_TARGET_ACL_IS_DEFAULT: %', r.proname;
    end if;
    if exists (
      select 1 from aclexplode(r.proacl) a
      where a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee = 'anon'::regrole or a.grantee = 'authenticated'::regrole)
    ) then
      raise exception 'M0076_POST_TARGET_CLIENT_EXECUTE: %', r.proname;
    end if;
    if not exists (
      select 1 from aclexplode(r.proacl) a
      where a.privilege_type = 'EXECUTE' and a.grantee = 'service_role'::regrole
    ) then
      raise exception 'M0076_POST_TARGET_SERVICE_ROLE_MISSING: %', r.proname;
    end if;
  end loop;

  -- 12-8) event_games 의 RLS/소유자/정책 수는 그대로여야 한다.
  if not (select relrowsecurity from pg_class where oid = 'public.event_games'::regclass) then
    raise exception 'M0076_POST_RLS_DISABLED';
  end if;
  select count(*) into v_cnt from pg_policies where schemaname = 'public' and tablename = 'event_games';
  if v_cnt <> 0 then
    raise exception 'M0076_POST_UNEXPECTED_POLICY: %', v_cnt;
  end if;
end
$post$;

-- 컬럼·함수 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
--   begin;
--   drop function if exists public.set_event_game_gender_category(uuid, uuid, uuid, text);
--   -- 아래 4종은 0062 원문 정의를 그대로 다시 적용한다(revoke/grant 포함):
--   --   create_event_game / update_event_game / set_event_game_players / place_event_game
--   drop function if exists public._event_game_materialize_gender(uuid, uuid, uuid[]);
--   drop function if exists public._event_game_check_slot_conflict(uuid, uuid, uuid[], uuid);
--   drop function if exists public._event_game_validate_category(uuid, uuid, text, text, uuid[], text[]);
--   drop function if exists public._event_game_infer_category(uuid, uuid, text, uuid[], text[]);
--   drop function if exists public._event_game_gender_stats(uuid, uuid, uuid[], text[]);
--   alter table public.event_games
--     drop column manually_modified_at,
--     drop column gender_category_source,
--     drop column gender_category;
--   notify pgrst, 'reload schema';
--   commit;
--
-- 되돌리면 ordered 동시 출전 가드가 사라지고, materialize 로 굳어진
-- event_participants.gender_snapshot 값은 되돌아가지 않는다.
-- ============================================================
