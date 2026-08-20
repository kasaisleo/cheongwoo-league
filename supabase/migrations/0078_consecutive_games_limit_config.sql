-- ============================================================
-- 0078: match_config 에 consecutive_games_limit 허용 (Phase 2A-9D-B-2)
--
-- 자동 대진의 "연속 출전 상한"을 Event 운영 constraint 로 받을 수 있게 한다.
-- 알고리즘·preview·commit 은 여기서 만들지 않는다.
--
-- ------------------------------------------------------------
-- 왜 "주입하지 않고 있을 때만 검증"(B안) 인가
-- ------------------------------------------------------------
-- normalize_match_config 는 두 테이블 CHECK 에 직접 묶여 있다:
--     clubs  : check (normalize_match_config(match_config_defaults) = match_config_defaults)
--     events : check (normalize_match_config(match_config) = match_config)
-- 그리고 update_event_slot_mode(0063) 는 전체 config 를 재정규화하지 않고
-- jsonb_set 으로 slot_mode 키 하나만 교체한다 — 저장된 키 집합을 그대로 둔다.
--
-- 그래서 "없으면 null 로 주입" 방식을 쓰면 저장된 14키 config 에 대해
-- normalize(stored) 가 15키를 돌려주어 normalize(stored) <> stored 가 되고,
-- 기존 Event 의 slot_mode 변경과 clubs 기본값 복사 INSERT 가 즉시
-- events_match_config_normalized 위반으로 깨진다(격리 DB 실측 확인).
-- 그것을 피하려면 events 12행 + clubs 3행 config backfill 이 필요하다.
--
-- 이 migration 은 backfill 을 하지 않는다. 대신 consecutive_games_limit 을
-- "있을 때만 검증하고 없으면 그대로 둔다". 결과:
--     · 기존 14키 config 는 normalize 결과가 byte 동일 → CHECK 그대로 통과
--     · 기존 Event/Club fingerprint 불변, DML 0건
--     · 키를 명시하면 검증되고 저장된다
--
-- 엔진 해석(9D-C 에서 구현):
--     키 누락      → algorithm v1 기본값 2
--     명시적 null  → algorithm v1 기본값 2
--     1~10        → 그 값
--
-- ------------------------------------------------------------
-- 보존하는 계약
-- ------------------------------------------------------------
--   signature (jsonb) returns jsonb / language plpgsql / immutable /
--   set search_path = '' / SECURITY DEFINER 아님 / 기존 ACL /
--   unknown-key fail-fast / 기존 14키의 입력·출력 동작 /
--   version = 1 유지 / update_event_slot_mode / clubs 기본값 복사 / 기존 CHECK
--
-- pairing_seed 와 pairing_algorithm_version 은 실행 데이터이므로
-- match_config 에 추가하지 않는다(0077 event_pairing_runs 가 정본).
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ------------------------------------------------------------
-- [0] 사전 조건 검증
-- ------------------------------------------------------------
do $pre$
declare
  v_cnt integer;
  v_types text[];
begin
  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_match_config';
  if v_cnt <> 1 then
    raise exception 'M0078_PRE_FN_COUNT: expected 1, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_match_config';
  if v_types is distinct from array['jsonb']::text[] then
    raise exception 'M0078_PRE_FN_SIGNATURE: %', v_types;
  end if;

  -- 이미 이 키를 아는 판본이면 중단한다(중복 적용 방지).
  begin
    perform public.normalize_match_config('{"version":1,"consecutive_games_limit":2}'::jsonb);
    raise exception 'M0078_PRE_KEY_ALREADY_ALLOWED';
  exception
    when others then
      if sqlerrm like 'M0078_PRE_KEY_ALREADY_ALLOWED%' then
        raise;
      end if;
      if sqlerrm not like 'CONFIG_UNKNOWN_KEY%' then
        raise exception 'M0078_PRE_UNEXPECTED_ERROR: %', sqlerrm;
      end if;
  end;

  -- 기존 두 CHECK 가 살아 있어야 한다.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass and conname = 'events_match_config_normalized'
  ) then
    raise exception 'M0078_PRE_EVENTS_CHECK_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clubs'::regclass and conname = 'clubs_match_config_defaults_normalized'
  ) then
    raise exception 'M0078_PRE_CLUBS_CHECK_MISSING';
  end if;
end
$pre$;

-- ------------------------------------------------------------
-- [1] normalize_match_config 재정의
--
-- 0050 원문에서 바뀌는 곳은 두 군데뿐이다:
--   · v_allowed_keys 에 'consecutive_games_limit' 추가
--   · 섹션 E 뒤에 "있을 때만 검증" 블록(E-2) 추가
-- v_numeric_keys 에는 넣지 않는다 — 그 배열은 "누락 시 null 주입" 대상이다.
-- ------------------------------------------------------------
create or replace function public.normalize_match_config(p_config jsonb)
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
    'partner_repeat_limit','opponent_repeat_limit','consecutive_games_limit'
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

  -- E-2. consecutive_games_limit (0078) — "있을 때만" 검증하고 주입하지 않는다.
  --      누락 시 키를 만들지 않으므로 기존 14키 config 의 normalize 결과가
  --      입력과 byte 동일하게 유지되고, 두 테이블 CHECK 도 그대로 통과한다.
  --      null 은 "미설정"으로 보존한다 — 엔진이 v1 기본값 2 를 적용한다.
  if v_result ? 'consecutive_games_limit' then
    if jsonb_typeof(v_result->'consecutive_games_limit') <> 'null' then
      if jsonb_typeof(v_result->'consecutive_games_limit') <> 'number' then
        raise exception 'CONFIG_INVALID_NUMBER: consecutive_games_limit';
      end if;
      if (v_result->>'consecutive_games_limit')::numeric
         <> floor((v_result->>'consecutive_games_limit')::numeric) then
        raise exception 'CONFIG_INVALID_NUMBER: consecutive_games_limit must be an integer';
      end if;
      if (v_result->>'consecutive_games_limit')::numeric < 1
         or (v_result->>'consecutive_games_limit')::numeric > 10 then
        raise exception 'CONFIG_OUT_OF_RANGE: consecutive_games_limit';
      end if;
    end if;
  end if;

  -- G. 기능 조합 차단 없음(의도적으로 비움) — court_assignment_enabled=true+
  -- slot_mode=none, auto_generation_enabled=true+attendance_enabled=false 등
  -- 전부 허용(구조적으로 불가능한 값만 위에서 이미 차단됨)

  return v_result;
end;
$$;

-- 0050 과 동일 — service_role 은 revoke 하지 않는다(clubs/events CHECK 평가
-- 문맥이 service_role 자신이기 때문).
revoke all on function public.normalize_match_config(jsonb) from public, anon, authenticated;
grant execute on function public.normalize_match_config(jsonb) to service_role;

-- ------------------------------------------------------------
-- [2] 사후 조건 검증
-- ------------------------------------------------------------
do $post$
declare
  v_cnt integer;
  v_types text[];
  v_acl aclitem[];
  v_owner oid;
  v_vol "char";
  v_secdef boolean;
  v_config jsonb;
  v_out jsonb;
begin
  -- 2-1) signature / volatility / search_path / SECURITY DEFINER 여부 불변.
  select count(*) into v_cnt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_match_config';
  if v_cnt <> 1 then
    raise exception 'M0078_POST_FN_COUNT: %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ), p.provolatile, p.prosecdef, p.proacl, p.proowner
  into v_types, v_vol, v_secdef, v_acl, v_owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_match_config';

  if v_types is distinct from array['jsonb']::text[] then
    raise exception 'M0078_POST_FN_SIGNATURE: %', v_types;
  end if;
  if v_vol <> 'i' then
    raise exception 'M0078_POST_NOT_IMMUTABLE: %', v_vol;
  end if;
  if v_secdef then
    raise exception 'M0078_POST_UNEXPECTED_SECURITY_DEFINER';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'normalize_match_config'
      and p.proconfig is not null
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
  ) then
    raise exception 'M0078_POST_SEARCH_PATH_MISSING';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'normalize_match_config'
      and pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
  ) then
    raise exception 'M0078_POST_RETURN_TYPE';
  end if;

  -- 2-2) ACL — client 실행 권한 0, service_role 실행 권한 유지.
  if v_acl is null then
    raise exception 'M0078_POST_ACL_IS_DEFAULT';
  end if;
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee = 'anon'::regrole or a.grantee = 'authenticated'::regrole)
  ) then
    raise exception 'M0078_POST_CLIENT_EXECUTE_REMAINS';
  end if;
  if not exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE' and a.grantee = 'service_role'::regrole
  ) then
    raise exception 'M0078_POST_SERVICE_ROLE_EXECUTE_MISSING';
  end if;

  -- 2-3) 기존 14키 config 는 normalize 결과가 입력과 완전히 동일해야 한다.
  v_config := '{"version":1,"slot_mode":"none","court_count":null,"review_required":false,
                "rest_gap_minutes":null,"attendance_enabled":false,"live_queue_enabled":false,
                "max_games_per_member":null,"partner_repeat_limit":null,"opponent_repeat_limit":null,
                "pre_scheduling_enabled":false,"auto_generation_enabled":false,
                "court_assignment_enabled":false,"participant_confirmation_required":false}'::jsonb;
  v_out := public.normalize_match_config(v_config);
  if v_out <> v_config then
    raise exception 'M0078_POST_14KEY_NOT_IDENTITY';
  end if;
  if v_out ? 'consecutive_games_limit' then
    raise exception 'M0078_POST_UNEXPECTED_KEY_INJECTION';
  end if;

  -- 2-4) 저장된 모든 행이 여전히 CHECK 를 만족한다(위반 행 0건).
  select count(*) into v_cnt from public.events
  where public.normalize_match_config(match_config) <> match_config;
  if v_cnt <> 0 then
    raise exception 'M0078_POST_EVENTS_WOULD_VIOLATE: % row(s)', v_cnt;
  end if;
  select count(*) into v_cnt from public.clubs
  where public.normalize_match_config(match_config_defaults) <> match_config_defaults;
  if v_cnt <> 0 then
    raise exception 'M0078_POST_CLUBS_WOULD_VIOLATE: % row(s)', v_cnt;
  end if;

  -- 2-5) 신규 키 검증 동작.
  if (public.normalize_match_config('{"version":1,"consecutive_games_limit":2}'::jsonb)
        ->>'consecutive_games_limit') <> '2' then
    raise exception 'M0078_POST_VALUE_NOT_PRESERVED';
  end if;
  if jsonb_typeof(public.normalize_match_config('{"version":1,"consecutive_games_limit":null}'::jsonb)
        ->'consecutive_games_limit') <> 'null' then
    raise exception 'M0078_POST_NULL_NOT_PRESERVED';
  end if;

  begin
    perform public.normalize_match_config('{"version":1,"consecutive_games_limit":0}'::jsonb);
    raise exception 'M0078_POST_ZERO_ACCEPTED';
  exception when others then
    if sqlerrm like 'M0078_POST_%' then raise; end if;
    if sqlerrm not like 'CONFIG_OUT_OF_RANGE%' then
      raise exception 'M0078_POST_ZERO_WRONG_ERROR: %', sqlerrm;
    end if;
  end;

  begin
    perform public.normalize_match_config('{"version":1,"consecutive_games_limit":11}'::jsonb);
    raise exception 'M0078_POST_ELEVEN_ACCEPTED';
  exception when others then
    if sqlerrm like 'M0078_POST_%' then raise; end if;
    if sqlerrm not like 'CONFIG_OUT_OF_RANGE%' then
      raise exception 'M0078_POST_ELEVEN_WRONG_ERROR: %', sqlerrm;
    end if;
  end;

  begin
    perform public.normalize_match_config('{"version":1,"consecutive_games_limit":"2"}'::jsonb);
    raise exception 'M0078_POST_STRING_ACCEPTED';
  exception when others then
    if sqlerrm like 'M0078_POST_%' then raise; end if;
    if sqlerrm not like 'CONFIG_INVALID_NUMBER%' then
      raise exception 'M0078_POST_STRING_WRONG_ERROR: %', sqlerrm;
    end if;
  end;

  -- 2-6) unknown-key fail-fast 유지.
  begin
    perform public.normalize_match_config('{"version":1,"pairing_seed":"x"}'::jsonb);
    raise exception 'M0078_POST_UNKNOWN_KEY_ACCEPTED';
  exception when others then
    if sqlerrm like 'M0078_POST_%' then raise; end if;
    if sqlerrm not like 'CONFIG_UNKNOWN_KEY%' then
      raise exception 'M0078_POST_UNKNOWN_KEY_WRONG_ERROR: %', sqlerrm;
    end if;
  end;

  perform v_owner;
end
$post$;

-- 함수 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
--   0050 의 normalize_match_config 원문을 그대로 다시 적용하고
--   revoke/grant 두 줄을 재발급한다.
--   consecutive_games_limit 을 저장한 Event 가 있다면 먼저 그 키를 제거해야
--   한다 — 되돌린 함수는 그 키를 CONFIG_UNKNOWN_KEY 로 거부하고, 그 상태로는
--   해당 행의 어떤 UPDATE 도 events_match_config_normalized 를 위반한다.
-- ============================================================
