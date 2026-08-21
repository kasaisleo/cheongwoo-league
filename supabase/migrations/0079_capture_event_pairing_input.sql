-- ============================================================
-- 0079: capture_event_pairing_input — 자동 대진 입력 capture (Phase 2A-9D-A79-2)
--
-- 이 migration 은 읽기 전용 capture 함수 1개만 만든다. preview API, commit RPC,
-- 알고리즘, run row 생성은 여기서 만들지 않는다. 사용자 데이터 DML 0건,
-- 기존 table/view/type/function 변경 0건이다.
--
-- ------------------------------------------------------------
-- [A] 이 함수의 위치
-- ------------------------------------------------------------
--   capture RPC(이 파일)  → 서버 TypeScript deterministic engine → preview 응답
--   commit 시: 최신 DB input 재capture → 동일 알고리즘 재계산 → row lock 후
--              hash 재검증 → atomic commit RPC (0079-C, 이 파일 범위 아님)
--
--   이 함수는 DB write 가 0건이므로 STABLE 이다. STABLE 함수 내부 SQL 은
--   calling query 시작 시점 snapshot 을 공유하므로, 내부 SELECT 가 여러 개여도
--   서로 다른 snapshot 을 보지 않는다(단일 CTE 로 억지로 합칠 이유가 없다).
--
-- ------------------------------------------------------------
-- [B] SECURITY INVOKER 인 이유
-- ------------------------------------------------------------
--   이 함수는 read-only 이고 service_role 로만 호출된다. service_role 은
--   BYPASSRLS 이므로 RLS 우회 목적으로 DEFINER 가 필요하지 않다. 권한 상승을
--   만들지 않는 쪽이 안전하므로 INVOKER 로 둔다.
--   (BYPASSRLS 는 RLS 만 우회하고 GRANT 를 대체하지 않는다 — 호출 role 에
--    관련 테이블 SELECT 권한이 실제로 있어야 한다. 아래 [0] 에서 검증한다.)
--
-- ------------------------------------------------------------
-- [C] snapshot 정본 (0077 [C] 계약을 그대로 따른다)
-- ------------------------------------------------------------
--   config_snapshot : normalize_match_config 결과 + 알고리즘 고정 파라미터 +
--                     calculation_year
--   input_snapshot  : Event 식별·운영 상태 / participants / target·base Games
--   input_hash      : sha256( {"config": config_snapshot, "input": input_snapshot} )
--
--   0077 은 "input_snapshot 은 전체가 hash 대상이다 — 일부만 제외되는 JSON
--   영역을 만들지 않는다" 를 명시한다. 따라서 알고리즘 결과에 영향이 없는
--   정보(취소된 Game, lineup 이 없는 protected Game)는 "넣고 hash 에서 빼는"
--   방식이 불가능하므로 아예 넣지 않는다. 이렇게 해야 cancelled Game 추가나
--   빈 draft Game 추가처럼 결과에 무관한 변화가 stale 을 만들지 않는다.
--
--   파생값(축소 승률·정규화 경력·가중 전력·coverage·imputed median)은 넣지
--   않는다 — 0077 계약대로 엔진이 algorithm_version 기준으로 재계산한다.
--   실수(float)는 넣지 않는다. 정수·문자열·boolean·null 만 넣는다.
--   표시 이름·전화번호 등 개인 식별값은 넣지 않는다.
--
--   canonical 규칙:
--     · jsonb 는 key 를 "길이 우선 후 바이트순" 으로 정규화하므로 입력 key
--       순서는 hash 에 영향이 없다(측정 확인).
--     · 배열은 전부 명시적 ORDER BY 로 정렬한다(jsonb_agg 는 정렬을 보장하지
--       않는다 — 측정 확인).
--     · timestamptz 는 to_jsonb 를 쓰지 않는다. to_jsonb(timestamptz) 는 서버
--       TimeZone 설정에 따라 문자열이 달라진다(측정 확인). 반드시
--       to_char(x at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') 로 고정한다.
--     · null 과 key 생략을 구분한다. jsonb_strip_nulls 는 쓰지 않는다.
--
-- ------------------------------------------------------------
-- [D] 실력 입력 정본
-- ------------------------------------------------------------
--   wins / draws / losses 는 셋 다 public.matches 에서 같은 방식으로 파생한다.
--   members.wins / guests.wins 같은 캐시 컬럼은 쓰지 않는다(캐시는 무승부를
--   세지 않아 draw-aware 계약과 섞이면 정합성이 깨진다).
--     · mt.club_id = p_club_id
--     · member 는 member 슬롯 4개, guest 는 guest 슬롯 4개
--     · winner_team = 'D'            → draw
--     · winner_team = 참가 팀        → win
--     · winner_team <> 참가 팀       → loss
--     · Match 당 최대 1회 (count(distinct mt.id))
--     · legacy Match 와 event_game_id 연결 Match 를 모두 포함한다
--       (matches 에는 status/deleted 컬럼이 없어 "무효" 개념이 존재하지 않는다)
--   members.rating / members.grade / guests.skill_grade / guests.years_playing 은
--   쓰지 않는다.
--
--   profile fallback:
--     · participant snapshot 이 non-null 이면 그것을 쓰고 source='snapshot'
--     · member 의 snapshot 이 null 이면 members master, source='member'
--     · guest 의 snapshot 이 null 이면 중립, source='none'
--     · 명시적 'unspecified' 는 fallback 하지 않는다(0076 정본과 동일)
--   guests 에는 gender / dominant_hand / tennis_start_year / mapo_score 컬럼이
--   없다 — guest 의 이 값들은 participant snapshot 에만 존재할 수 있다.
--
-- 건드리지 않는 것: 기존 table/view/type/function/RLS/policy/ACL, 사용자 데이터,
--   Public RPC, member_stats, match_config, 기존 migration 원문.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ------------------------------------------------------------
-- [0] 사전 조건 검증
-- ------------------------------------------------------------
do $pre$
declare
  v_missing text;
  v_tbl     text;
begin
  if to_regprocedure('public.capture_event_pairing_input(uuid, uuid, uuid[])') is not null then
    raise exception 'M0079_PRE_FUNCTION_EXISTS: capture_event_pairing_input';
  end if;

  -- pgcrypto digest 가 extensions 스키마에 있어야 한다(0043/0048 과 동일 전제).
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'M0079_PRE_PGCRYPTO_MISSING';
  end if;
  if to_regprocedure('extensions.digest(bytea, text)') is null then
    raise exception 'M0079_PRE_DIGEST_NOT_IN_EXTENSIONS: expected extensions.digest(bytea, text)';
  end if;

  -- SECURITY INVOKER 는 호출 role 권한으로 실행된다. relation SELECT 뿐 아니라
  -- schema USAGE 와 digest EXECUTE 도 호출 role 에 있어야 한다.
  -- 이 migration 은 부족한 권한을 확대하지 않는다 — 즉시 중단한다.
  if not has_schema_privilege('service_role', 'public', 'USAGE') then
    raise exception 'M0079_PRE_PUBLIC_SCHEMA_USAGE_MISSING';
  end if;
  if not has_schema_privilege('service_role', 'extensions', 'USAGE') then
    raise exception 'M0079_PRE_EXTENSIONS_SCHEMA_USAGE_MISSING';
  end if;
  if not has_function_privilege('service_role', 'extensions.digest(bytea, text)', 'EXECUTE') then
    raise exception 'M0079_PRE_DIGEST_EXECUTE_MISSING';
  end if;

  -- 0077/0076 이 만든 컬럼이 있어야 한다(적용 순서 보증).
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_games'::regclass
      and attname = 'pairing_run_id' and not attisdropped
  ) then
    raise exception 'M0079_PRE_0077_MISSING: event_games.pairing_run_id';
  end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_games'::regclass
      and attname = 'gender_category_source' and not attisdropped
  ) then
    raise exception 'M0079_PRE_0076_MISSING: event_games.gender_category_source';
  end if;

  -- normalize_match_config 가 있어야 한다.
  if to_regprocedure('public.normalize_match_config(jsonb)') is null then
    raise exception 'M0079_PRE_NORMALIZE_MISSING';
  end if;

  -- SECURITY INVOKER 로 동작하려면 호출 role(service_role)에 SELECT 가 있어야 한다.
  v_missing := '';
  foreach v_tbl in array array[
    'public.events', 'public.event_participants', 'public.event_games',
    'public.event_game_players', 'public.event_courts', 'public.event_sessions',
    'public.members', 'public.guests', 'public.matches'
  ] loop
    if not has_table_privilege('service_role', v_tbl, 'SELECT') then
      v_missing := v_missing || v_tbl || ' ';
    end if;
  end loop;
  if v_missing <> '' then
    raise exception 'M0079_PRE_SERVICE_ROLE_SELECT_MISSING: %', v_missing;
  end if;
end
$pre$;

-- ------------------------------------------------------------
-- [1] capture_event_pairing_input
-- ------------------------------------------------------------
create function public.capture_event_pairing_input(
  p_event_id        uuid,
  p_club_id         uuid,
  p_target_game_ids uuid[]
) returns table (
  config_snapshot jsonb,
  input_snapshot  jsonb,
  input_hash      text
)
language plpgsql
stable
security invoker
set search_path = ''
as $fn$
declare
  v_raw_len      integer;
  v_targets      uuid[];
  v_target_len   integer;

  v_event_status text;
  v_match_config jsonb;
  v_calc_year    integer;

  v_config       jsonb;
  v_slot_mode    text;

  v_cfg_snapshot jsonb;
  v_in_snapshot  jsonb;
  v_participants jsonb;
  v_target_games jsonb;
  v_base_games   jsonb;

  v_bad          record;
  v_amb          record;
  v_key          text;
begin
  -- ----------------------------------------------------------
  -- 1) 인자 검증
  -- ----------------------------------------------------------
  if p_event_id is null or p_club_id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if p_target_game_ids is null then
    raise exception 'TARGET_GAME_IDS_REQUIRED';
  end if;

  v_raw_len := coalesce(array_length(p_target_game_ids, 1), 0);
  if v_raw_len = 0 then
    raise exception 'TARGET_GAME_IDS_REQUIRED';
  end if;

  -- raw 길이를 먼저 본다 — dedupe 로 상한을 우회하지 못하게 한다.
  if v_raw_len > 32 then
    raise exception 'TARGET_GAME_IDS_LIMIT_EXCEEDED: raw %, max 32', v_raw_len;
  end if;

  if exists (select 1 from unnest(p_target_game_ids) as t(id) where t.id is null) then
    raise exception 'TARGET_GAME_IDS_INVALID: null element';
  end if;

  -- dedupe + UUID canonical 정렬 (입력 순서가 결과·hash 에 영향을 주지 않는다)
  select array_agg(t.id order by t.id)
    into v_targets
  from (select distinct u.id from unnest(p_target_game_ids) as u(id)) as t;

  v_target_len := coalesce(array_length(v_targets, 1), 0);
  if v_target_len < 1 then
    raise exception 'TARGET_GAME_IDS_REQUIRED';
  end if;
  if v_target_len > 32 then
    raise exception 'TARGET_GAME_IDS_LIMIT_EXCEEDED: deduped %, max 32', v_target_len;
  end if;

  -- ----------------------------------------------------------
  -- 2) Event / lifecycle
  -- ----------------------------------------------------------
  select e.status, e.match_config, extract(year from e.event_date)::integer
    into v_event_status, v_match_config, v_calc_year
  from public.events e
  where e.id = p_event_id and e.club_id = p_club_id;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is cancelled';
  end if;
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
  end if;

  -- ----------------------------------------------------------
  -- 3) config gate
  -- ----------------------------------------------------------
  v_config := public.normalize_match_config(v_match_config);

  -- normalize 는 auto_generation_enabled 를 항상 boolean 으로 채운다.
  -- null / false 를 조용히 true 로 해석하지 않는다.
  if coalesce((v_config ->> 'auto_generation_enabled')::boolean, false) is not true then
    raise exception 'AUTO_GENERATION_DISABLED';
  end if;

  v_slot_mode := v_config ->> 'slot_mode';

  -- consecutive_games_limit 는 v_numeric_keys 에 없어 정규화 후에도 키가 없을
  -- 수 있다. hash 계약을 고정하기 위해 없으면 명시적 null 을 넣는다.
  if not (v_config ? 'consecutive_games_limit') then
    v_config := v_config || jsonb_build_object('consecutive_games_limit', null);
  end if;

  -- normalize 정본 15키(위 보정 포함)가 전부 있어야 한다. 키 수만 믿지 않고
  -- 각 키의 존재를 개별 확인한다.
  foreach v_key in array array[
    'version', 'slot_mode', 'court_count', 'rest_gap_minutes',
    'max_games_per_member', 'partner_repeat_limit', 'opponent_repeat_limit',
    'consecutive_games_limit', 'review_required', 'attendance_enabled',
    'live_queue_enabled', 'pre_scheduling_enabled', 'auto_generation_enabled',
    'court_assignment_enabled', 'participant_confirmation_required'
  ] loop
    if not (v_config ? v_key) then
      raise exception 'CONFIG_SNAPSHOT_KEY_MISSING: %', v_key;
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(v_config)) <> 15 then
    raise exception 'CONFIG_SNAPSHOT_KEY_COUNT: expected 15, found %',
      (select count(*) from jsonb_object_keys(v_config));
  end if;

  v_cfg_snapshot := v_config || jsonb_build_object(
    'algorithmVersion', 'v1',
    'powerEpsilonBp',   2000,
    'candidateTopK',    8,
    'beamWidth',        32,
    'lookaheadDepth',   2,
    'doublesOnly',      true,
    'calculationYear',  v_calc_year
  );

  -- 알고리즘 상수 7종(6 + calculationYear)의 존재와 값 계약을 개별 확인한다.
  if v_cfg_snapshot ->> 'algorithmVersion' is distinct from 'v1'
     or (v_cfg_snapshot ->> 'powerEpsilonBp')::integer is distinct from 2000
     or (v_cfg_snapshot ->> 'candidateTopK')::integer is distinct from 8
     or (v_cfg_snapshot ->> 'beamWidth')::integer is distinct from 32
     or (v_cfg_snapshot ->> 'lookaheadDepth')::integer is distinct from 2
     or (v_cfg_snapshot ->> 'doublesOnly')::boolean is distinct from true
     or (v_cfg_snapshot ->> 'calculationYear')::integer is null then
    raise exception 'CONFIG_SNAPSHOT_ALGORITHM_CONSTANTS';
  end if;
  if (select count(*) from jsonb_object_keys(v_cfg_snapshot)) <> 22 then
    raise exception 'CONFIG_SNAPSHOT_TOTAL_KEY_COUNT: expected 22, found %',
      (select count(*) from jsonb_object_keys(v_cfg_snapshot));
  end if;

  -- ----------------------------------------------------------
  -- 4) target Game 검증
  --    (오류에 gameId 를 담기 위해 조건별로 첫 위반 1건을 찾는다)
  -- ----------------------------------------------------------
  -- 4-1) 존재 + Event/Club 소속
  select t.id into v_bad
  from unnest(v_targets) as t(id)
  where not exists (select 1 from public.event_games g where g.id = t.id)
  order by t.id limit 1;
  if found then
    raise exception 'TARGET_NOT_FOUND: %', v_bad.id;
  end if;

  select t.id into v_bad
  from unnest(v_targets) as t(id)
  join public.event_games g on g.id = t.id
  where g.event_id <> p_event_id or g.club_id <> p_club_id
  order by t.id limit 1;
  if found then
    raise exception 'TARGET_EVENT_CLUB_MISMATCH: %', v_bad.id;
  end if;

  -- 4-2) 상태 / lineup / provenance / format / category
  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets) and g.status <> 'draft'
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_NOT_DRAFT: %', v_bad.id;
  end if;

  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets)
    and exists (select 1 from public.event_game_players p where p.event_game_id = g.id)
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_LINEUP_NOT_EMPTY: %', v_bad.id;
  end if;

  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets)
    and (g.source <> 'manual' or g.pairing_run_id is not null)
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_ALREADY_AUTO: %', v_bad.id;
  end if;

  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets) and g.format <> 'doubles'
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_FORMAT_UNSUPPORTED: %', v_bad.id;
  end if;

  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets) and g.gender_category is null
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_CATEGORY_NULL: %', v_bad.id;
  end if;

  select g.id into v_bad
  from public.event_games g
  where g.id = any(v_targets)
    and g.gender_category_source is distinct from 'configured'
  order by g.id limit 1;
  if found then
    raise exception 'TARGET_CATEGORY_NOT_CONFIGURED: %', v_bad.id;
  end if;

  -- 4-3) placement gate (slot_mode 별)
  if v_slot_mode in ('ordered', 'timed') then
    select g.id into v_bad
    from public.event_games g
    where g.id = any(v_targets) and g.event_court_id is null
    order by g.id limit 1;
    if found then
      raise exception 'TARGET_COURT_REQUIRED: %', v_bad.id;
    end if;

    select g.id into v_bad
    from public.event_games g
    where g.id = any(v_targets) and g.event_session_id is null
    order by g.id limit 1;
    if found then
      raise exception 'TARGET_SESSION_REQUIRED: %', v_bad.id;
    end if;
  end if;

  if v_slot_mode = 'ordered' then
    select g.id into v_bad
    from public.event_games g
    join public.event_sessions s on s.id = g.event_session_id
    where g.id = any(v_targets) and s.position is null
    order by g.id limit 1;
    if found then
      raise exception 'TARGET_SESSION_REQUIRED: % (session position missing)', v_bad.id;
    end if;
  end if;

  if v_slot_mode = 'timed' then
    select g.id into v_bad
    from public.event_games g
    join public.event_sessions s on s.id = g.event_session_id
    where g.id = any(v_targets)
      and (s.starts_at is null or s.ends_at is null or s.ends_at <= s.starts_at)
    order by g.id limit 1;
    if found then
      raise exception 'TARGET_SESSION_TIME_INCOMPLETE: %', v_bad.id;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 5) base Game 검증
  --    base = target 밖 + non-cancelled + lineup 있음
  -- ----------------------------------------------------------
  -- 5-1) lineup shape (doubles=4, singles=2, team/slot 조합 유일)
  select g.id into v_bad
  from public.event_games g
  where g.event_id = p_event_id and g.club_id = p_club_id
    and not (g.id = any(v_targets))
    and g.status <> 'cancelled'
    and exists (select 1 from public.event_game_players p where p.event_game_id = g.id)
    and (
      (select count(*) from public.event_game_players p where p.event_game_id = g.id)
        <> (case g.format when 'singles' then 2 else 4 end)
      or (select count(distinct (p.team, p.slot)) from public.event_game_players p where p.event_game_id = g.id)
        <> (select count(*) from public.event_game_players p where p.event_game_id = g.id)
      or (select count(distinct p.event_participant_id) from public.event_game_players p where p.event_game_id = g.id)
        <> (select count(*) from public.event_game_players p where p.event_game_id = g.id)
    )
  order by g.id limit 1;
  if found then
    raise exception 'BASE_LINEUP_INVALID: %', v_bad.id;
  end if;

  -- 5-2) scheduling completeness (lineup 있는 non-cancelled base 만)
  if v_slot_mode = 'ordered' then
    select g.id into v_bad
    from public.event_games g
    left join public.event_sessions s on s.id = g.event_session_id
    where g.event_id = p_event_id and g.club_id = p_club_id
      and not (g.id = any(v_targets))
      and g.status <> 'cancelled'
      and exists (select 1 from public.event_game_players p where p.event_game_id = g.id)
      and (g.event_court_id is null or g.event_session_id is null or s.position is null)
    order by g.id limit 1;
    if found then
      raise exception 'BASE_SESSION_INCOMPLETE: %', v_bad.id;
    end if;
  end if;

  if v_slot_mode = 'timed' then
    select g.id into v_bad
    from public.event_games g
    left join public.event_sessions s on s.id = g.event_session_id
    where g.event_id = p_event_id and g.club_id = p_club_id
      and not (g.id = any(v_targets))
      and g.status <> 'cancelled'
      and exists (select 1 from public.event_game_players p where p.event_game_id = g.id)
      and (g.event_court_id is null or g.event_session_id is null
           or s.starts_at is null or s.ends_at is null or s.ends_at <= s.starts_at)
    order by g.id limit 1;
    if found then
      raise exception 'BASE_SESSION_TIME_INCOMPLETE: %', v_bad.id;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 5-3) 같은 Match 의 A/B 양 팀에 동시에 존재하는 참가자 방어
  --
  --   matches 에는 동일 선수 중복을 막는 CHECK 가 없다(0003 에서 원본 컬럼이
  --   제거되며 chk_no_duplicate_players 도 사라졌다). 같은 팀 두 슬롯 중복은
  --   count(distinct match_id) 로 1회만 세면 되지만, A팀과 B팀 양쪽에 같은
  --   선수가 있으면 승/패를 판정할 수 없다. 임의 선택·draw 간주·조용한 제외를
  --   모두 하지 않고 명시적으로 거부한다.
  --
  --   검사 범위: p_club_id 의 Match, 이번 capture 의 eligible participant 만.
  --   member identity 와 guest identity 를 분리해 본다.
  --   오류에는 이름·전화번호를 넣지 않고 match id 와 participant id 만 넣는다.
  -- ----------------------------------------------------------
  select mt.id as match_id, p.id as participant_id
    into v_amb
  from public.event_participants p
  join public.matches mt on mt.club_id = p_club_id
  where p.event_id = p_event_id and p.club_id = p_club_id
    and p.status = 'confirmed' and p.is_active = true
    and (
      (p.member_id is not null
       and p.member_id in (mt.team_a_player1_member, mt.team_a_player2_member)
       and p.member_id in (mt.team_b_player1_member, mt.team_b_player2_member))
      or
      (p.guest_id is not null
       and p.guest_id in (mt.team_a_player1_guest, mt.team_a_player2_guest)
       and p.guest_id in (mt.team_b_player1_guest, mt.team_b_player2_guest))
    )
  order by mt.id, p.id
  limit 1;
  if found then
    raise exception 'MATCH_PARTICIPANT_TEAM_AMBIGUOUS: match % participant %',
      v_amb.match_id, v_amb.participant_id;
  end if;

  -- ----------------------------------------------------------
  -- 6) participants snapshot
  --    confirmed + is_active 만. 개인 식별값은 넣지 않는다.
  --    W/D/L 은 전부 public.matches 파생(캐시 컬럼 미사용).
  -- ----------------------------------------------------------
  with pool as (
    select ep.id, ep.participant_type, ep.member_id, ep.guest_id,
           ep.gender_snapshot, ep.tennis_start_year_snapshot, ep.dominant_hand_snapshot
    from public.event_participants ep
    where ep.event_id = p_event_id and ep.club_id = p_club_id
      and ep.status = 'confirmed' and ep.is_active = true
  ),
  -- member 슬롯 4개를 팀과 함께 펼친다.
  member_slots as (
    select mt.id as match_id, u.member_id, u.team
    from public.matches mt
    cross join lateral (values
      (mt.team_a_player1_member, 'A'), (mt.team_a_player2_member, 'A'),
      (mt.team_b_player1_member, 'B'), (mt.team_b_player2_member, 'B')
    ) as u(member_id, team)
    where mt.club_id = p_club_id and u.member_id is not null
  ),
  guest_slots as (
    select mt.id as match_id, u.guest_id, u.team
    from public.matches mt
    cross join lateral (values
      (mt.team_a_player1_guest, 'A'), (mt.team_a_player2_guest, 'A'),
      (mt.team_b_player1_guest, 'B'), (mt.team_b_player2_guest, 'B')
    ) as u(guest_id, team)
    where mt.club_id = p_club_id and u.guest_id is not null
  ),
  member_rec as (
    select s.member_id,
           count(distinct s.match_id) filter (where mt.winner_team::text = s.team)  as wins,
           count(distinct s.match_id) filter (where mt.winner_team::text = 'D')     as draws,
           count(distinct s.match_id) filter (where mt.winner_team::text <> 'D'
                                                and mt.winner_team::text <> s.team) as losses
    from member_slots s
    join public.matches mt on mt.id = s.match_id
    group by s.member_id
  ),
  guest_rec as (
    select s.guest_id,
           count(distinct s.match_id) filter (where mt.winner_team::text = s.team)  as wins,
           count(distinct s.match_id) filter (where mt.winner_team::text = 'D')     as draws,
           count(distinct s.match_id) filter (where mt.winner_team::text <> 'D'
                                                and mt.winner_team::text <> s.team) as losses
    from guest_slots s
    join public.matches mt on mt.id = s.match_id
    group by s.guest_id
  ),
  resolved as (
    select
      p.id,
      p.participant_type,
      p.member_id,
      p.guest_id,
      -- gender: snapshot 우선(명시적 'unspecified' 도 snapshot), 없으면 member master
      case
        when p.gender_snapshot is not null then p.gender_snapshot
        when p.member_id is not null and m.gender is not null then m.gender
        else 'unspecified'
      end as gender,
      case
        when p.gender_snapshot is not null then 'snapshot'
        when p.member_id is not null and m.gender is not null then 'member'
        else 'none'
      end as gender_source,
      case
        when p.tennis_start_year_snapshot is not null then p.tennis_start_year_snapshot::integer
        when p.member_id is not null then m.tennis_start_year::integer
        else null
      end as tennis_start_year,
      case
        when p.tennis_start_year_snapshot is not null then 'snapshot'
        when p.member_id is not null and m.tennis_start_year is not null then 'member'
        else 'none'
      end as tennis_start_year_source,
      case
        when p.dominant_hand_snapshot is not null then p.dominant_hand_snapshot
        when p.member_id is not null and m.dominant_hand is not null then m.dominant_hand
        else 'unspecified'
      end as dominant_hand,
      case
        when p.dominant_hand_snapshot is not null then 'snapshot'
        when p.member_id is not null and m.dominant_hand is not null then 'member'
        else 'none'
      end as dominant_hand_source,
      -- mapo: participant snapshot 컬럼이 없다. member master 만 존재하고
      -- guest 는 컬럼 자체가 없으므로 항상 null/none 이다.
      case when p.member_id is not null then m.mapo_score::integer else null end as mapo_score,
      case when p.member_id is not null and m.mapo_score is not null then 'member' else 'none' end as mapo_score_source,
      coalesce(mr.wins,  gr.wins,  0)::integer as wins,
      coalesce(mr.losses, gr.losses, 0)::integer as losses,
      coalesce(mr.draws, gr.draws, 0)::integer as draws
    from pool p
    left join public.members m on m.id = p.member_id and m.club_id = p_club_id
    left join member_rec mr on mr.member_id = p.member_id
    left join guest_rec  gr on gr.guest_id  = p.guest_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',                     r.id,
             'participantType',        r.participant_type,
             'memberId',               r.member_id,
             'guestId',                r.guest_id,
             'gender',                 r.gender,
             'genderSource',           r.gender_source,
             'tennisStartYear',        r.tennis_start_year,
             'tennisStartYearSource',  r.tennis_start_year_source,
             'dominantHand',           r.dominant_hand,
             'dominantHandSource',     r.dominant_hand_source,
             'mapoScore',              r.mapo_score,
             'mapoScoreSource',        r.mapo_score_source,
             'wins',                   r.wins,
             'losses',                 r.losses,
             'draws',                  r.draws
           ) order by r.id
         ), '[]'::jsonb)
    into v_participants
  from resolved r;

  -- ----------------------------------------------------------
  -- 7) target Games snapshot
  -- ----------------------------------------------------------
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',              g.id,
             'position',        g.position,
             'format',          g.format,
             'genderCategory',  g.gender_category,
             'courtId',         g.event_court_id,
             'courtPosition',   c.position,
             'sessionId',       g.event_session_id,
             'sessionPosition', s.position,
             'sessionStartsAt', to_char(s.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'sessionEndsAt',   to_char(s.ends_at   at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           ) order by g.id
         ), '[]'::jsonb)
    into v_target_games
  from public.event_games g
  left join public.event_courts   c on c.id = g.event_court_id
  left join public.event_sessions s on s.id = g.event_session_id
  where g.id = any(v_targets);

  -- ----------------------------------------------------------
  -- 8) base Games snapshot (lineup 있는 non-cancelled, target 밖)
  --    lineup 은 participantId 만 담는다 — eligible pool 밖 참가자도
  --    이력에는 반영되어야 하므로 ID 로만 표현한다.
  -- ----------------------------------------------------------
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',              g.id,
             'position',        g.position,
             'format',          g.format,
             'status',          g.status,
             'source',          g.source,
             'genderCategory',  g.gender_category,
             'pairingRunId',    g.pairing_run_id,
             'courtId',         g.event_court_id,
             'courtPosition',   c.position,
             'sessionId',       g.event_session_id,
             'sessionPosition', s.position,
             'sessionStartsAt', to_char(s.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'sessionEndsAt',   to_char(s.ends_at   at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'lineup',          (
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'participantId', p.event_participant_id,
                          'team',          lower(p.team),
                          'slot',          p.slot
                        ) order by p.team, p.slot
                      ), '[]'::jsonb)
               from public.event_game_players p
               where p.event_game_id = g.id
             )
           ) order by g.id
         ), '[]'::jsonb)
    into v_base_games
  from public.event_games g
  left join public.event_courts   c on c.id = g.event_court_id
  left join public.event_sessions s on s.id = g.event_session_id
  where g.event_id = p_event_id and g.club_id = p_club_id
    and not (g.id = any(v_targets))
    and g.status <> 'cancelled'
    and exists (select 1 from public.event_game_players p where p.event_game_id = g.id);

  -- ----------------------------------------------------------
  -- 9) envelope + hash
  -- ----------------------------------------------------------
  v_in_snapshot := jsonb_build_object(
    'event', jsonb_build_object(
      'id',     p_event_id,
      'clubId', p_club_id,
      'status', v_event_status
    ),
    'participants', v_participants,
    'targetGames',  v_target_games,
    'baseGames',    v_base_games
  );

  return query
  select
    v_cfg_snapshot,
    v_in_snapshot,
    encode(
      extensions.digest(
        convert_to(
          jsonb_build_object('config', v_cfg_snapshot, 'input', v_in_snapshot)::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
end
$fn$;

comment on function public.capture_event_pairing_input(uuid, uuid, uuid[]) is
  '자동 대진 입력 capture(0079). DB write 0건인 STABLE 읽기 전용 함수다.
   config_snapshot = normalize_match_config 결과 + 알고리즘 고정 파라미터 + calculationYear,
   input_snapshot = Event 식별·상태 / confirmed+active participants / target·base Games,
   input_hash = sha256({"config":config_snapshot,"input":input_snapshot}) 의 소문자 hex.
   wins/draws/losses 는 전부 public.matches 파생이며 members/guests 캐시 컬럼을 쓰지 않는다.
   표시 이름 등 개인 식별값과 파생 점수는 담지 않는다 — 엔진이 algorithm_version 기준으로 재계산한다.
   cancelled Game 과 lineup 없는 Game 은 알고리즘 결과에 영향이 없으므로 담지 않는다
   (0077 계약상 input_snapshot 은 전체가 hash 대상이라 "담고 hash 에서 제외" 가 불가능하다).';

-- ------------------------------------------------------------
-- [2] ACL — service_role 전용
-- ------------------------------------------------------------
revoke all on function public.capture_event_pairing_input(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.capture_event_pairing_input(uuid, uuid, uuid[])
  to service_role;

-- ------------------------------------------------------------
-- [3] 사후 검증
-- ------------------------------------------------------------
do $post$
declare
  v_oid   oid;
  v_cnt   integer;
  v_prosecdef boolean;
  v_provolatile "char";
  v_config text[];
begin
  v_oid := to_regprocedure('public.capture_event_pairing_input(uuid, uuid, uuid[])');
  if v_oid is null then
    raise exception 'M0079_POST_FUNCTION_MISSING';
  end if;

  select p.prosecdef, p.provolatile, p.proconfig
    into v_prosecdef, v_provolatile, v_config
  from pg_proc p where p.oid = v_oid;

  if v_prosecdef then
    raise exception 'M0079_POST_EXPECTED_SECURITY_INVOKER';
  end if;
  if v_provolatile <> 's' then
    raise exception 'M0079_POST_EXPECTED_STABLE: %', v_provolatile;
  end if;
  -- proconfig 는 빈 search_path 를 'search_path=""' 로 저장한다(따옴표 포함).
  if v_config is null
     or not ('search_path=""' = any(v_config) or 'search_path=' = any(v_config)) then
    raise exception 'M0079_POST_SEARCH_PATH_NOT_EMPTY: %', coalesce(array_to_string(v_config, ','), '<null>');
  end if;

  -- 반환 컬럼 3개 확인
  select count(*) into v_cnt
  from unnest((select p.proargmodes from pg_proc p where p.oid = v_oid)) as m
  where m = 't';
  if v_cnt <> 3 then
    raise exception 'M0079_POST_RETURN_COLUMNS: expected 3, found %', v_cnt;
  end if;

  -- ACL: PUBLIC/anon/authenticated EXECUTE 0건, service_role EXECUTE 1건
  if has_function_privilege('anon', v_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'M0079_POST_PUBLIC_EXECUTE_PRESENT';
  end if;
  if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception 'M0079_POST_SERVICE_ROLE_EXECUTE_MISSING';
  end if;

  -- 신규 함수 1개만 추가되었는지(같은 이름의 다른 시그니처가 없어야 한다)
  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'capture_event_pairing_input';
  if v_cnt <> 1 then
    raise exception 'M0079_POST_UNEXPECTED_OVERLOAD: %', v_cnt;
  end if;
end
$post$;

notify pgrst, 'reload schema';

commit;
