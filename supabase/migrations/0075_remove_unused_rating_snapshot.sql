-- ============================================================
-- 0075: 미사용 rating snapshot 제거 (Phase 2A-9C-C)
--
-- 0074 가 event_participants.rating_snapshot 을 추가하면서 members.rating 을
-- 복사하도록 했다. 그런데 members.rating 은 0004 이후 이미 미사용(deprecated)
-- 이고, SUPER MATCH 자동 대진의 확정 입력 기준에서도 rating 은 제외됐다.
-- 따라서 0074 가 새로 만든 rating snapshot 경로만 되돌린다.
--
--   자동 대진이 쓰지 않는 값: members.rating / event_participants.rating_snapshot
--                              members.grade / guests.skill_grade
--
-- 이 migration 이 건드리지 않는 것 (명시):
--   · members.rating 컬럼          — 그대로 둔다(deprecated 상태 유지)
--   · members.grade                — 그대로 둔다
--   · guests.skill_grade           — 그대로 둔다
--   · members.gender / tennis_start_year / dominant_hand (0074 [1])
--   · event_participants.gender_snapshot / tennis_start_year_snapshot /
--     dominant_hand_snapshot 과 그 CHECK 3개
--   · 회원 생성·편집 경로, Public RPC, member_stats, rating_history
--   · RLS/policy, 다른 테이블의 ACL
--   · events.match_config, event_games, 자동 대진 로직
--   · 기존 migration 원문(0074 포함) — 수정하지 않는다
--
-- ------------------------------------------------------------
-- 실행 순서 (dependency 순서를 반드시 지킨다)
-- ------------------------------------------------------------
--   [0] 사전 조건 검증 — 기대한 상태가 아니면 어떤 변경도 하지 않고 중단한다.
--   [1] _event_participant_upsert 재정의 (signature 동일 → create or replace)
--         members.rating 조회와 rating_snapshot INSERT 만 제거한다.
--   [2] 기존 7인자 set_event_participant_profile 제거 (정확한 signature, CASCADE 없음)
--   [3] 3필드 set_event_participant_profile 생성 (6인자)
--   [4] rating_snapshot 컬럼 dependency 재검증 후 제거 (CASCADE 없음)
--   [5] 사후 조건 검증
--
-- 함수 본문이 rating_snapshot 을 참조하는 상태에서 컬럼을 먼저 지우면 DDL 은
-- 통과하지만(plpgsql 은 런타임 해석) 다음 호출에서 함수가 깨진다. 그래서
-- [1]~[3] 으로 참조를 모두 없앤 뒤에만 [4] 를 실행한다.
--
-- ------------------------------------------------------------
-- 데이터 영향 — 의도된 데이터 제거
-- ------------------------------------------------------------
-- [4] 의 drop column 은 rating_snapshot 에 저장된 값을 영구히 제거한다.
-- 2026-08-19 Production 사전 조사 기준 rating_snapshot IS NOT NULL 은 7 행이며
-- 전부 e2e_qa Club 이다(cheongwoo 0 행, namaste 0 행, status='confirmed' 참가자
-- 0 행). 이 7 행의 값 삭제는 의도된 제거이고 되돌릴 수 없다.
-- event_participants 행 자체는 삭제·변경하지 않는다 — drop column 은 행 수를
-- 바꿀 수 없다(구조적으로 UPDATE/DELETE 가 발생하지 않는다).
-- Production 적용 전 재확인 query 는 보고서에 별도로 제시한다.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ------------------------------------------------------------
-- [0] 사전 조건 검증
--
-- 정적 SQL 만 쓴다(동적 SQL 0건). 기대와 다르면 즉시 예외를 던져
-- 트랜잭션 전체를 되돌린다.
-- ------------------------------------------------------------
-- signature 비교는 pg_get_function_identity_arguments 를 쓰지 않는다 — 그 함수는
-- 인자 "이름"까지 포함하므로 이름을 바꾸면 검증이 깨진다(격리 검증에서 실측).
-- format_type 으로 만든 타입 배열만 비교한다.
do $pre$
declare
  v_attnum smallint;
  v_cnt integer;
  v_types text[];
  v_fns text[];
begin
  -- 0-1) 대상 컬럼이 존재해야 한다. 없으면 이미 적용된 DB 이므로 중단한다.
  select a.attnum into v_attnum
  from pg_attribute a
  where a.attrelid = 'public.event_participants'::regclass
    and a.attname = 'rating_snapshot'
    and not a.attisdropped;

  if v_attnum is null then
    raise exception 'M0075_PRE_COLUMN_MISSING: event_participants.rating_snapshot not found';
  end if;

  -- 0-2) 남겨야 하는 snapshot 컬럼 3개가 모두 있어야 한다.
  select count(*) into v_cnt
  from pg_attribute a
  where a.attrelid = 'public.event_participants'::regclass
    and not a.attisdropped
    and a.attname in ('gender_snapshot', 'tennis_start_year_snapshot', 'dominant_hand_snapshot');

  if v_cnt <> 3 then
    raise exception 'M0075_PRE_SNAPSHOT_COLUMNS: expected 3, found %', v_cnt;
  end if;

  -- 0-3) 기존 profile 함수는 정확히 1개이고 0074 signature 여야 한다.
  select count(*) into v_cnt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_participant_profile';

  if v_cnt <> 1 then
    raise exception 'M0075_PRE_PROFILE_FN_COUNT: expected 1, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_participant_profile';

  if v_types is distinct from array['uuid', 'uuid', 'uuid', 'text', 'integer', 'text', 'integer']::text[] then
    raise exception 'M0075_PRE_PROFILE_FN_SIGNATURE: %', v_types;
  end if;

  -- 0-4) upsert helper 도 정확히 1개이고 0052/0074 signature 여야 한다.
  select count(*) into v_cnt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_event_participant_upsert';

  if v_cnt <> 1 then
    raise exception 'M0075_PRE_UPSERT_FN_COUNT: expected 1, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_event_participant_upsert';

  if v_types is distinct from array['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'text', 'uuid', 'uuid']::text[] then
    raise exception 'M0075_PRE_UPSERT_FN_SIGNATURE: %', v_types;
  end if;

  -- 0-5) rating_snapshot 을 참조하는 public 함수는 위 두 개뿐이어야 한다.
  --      예상 밖의 함수가 참조하면 임의로 고치지 않고 중단한다.
  select array_agg(distinct p.proname::text order by p.proname::text) into v_fns
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%rating_snapshot%';

  if v_fns is distinct from array['_event_participant_upsert', 'set_event_participant_profile']::text[] then
    raise exception 'M0075_PRE_UNEXPECTED_FUNCTION_REFERENCE: %', v_fns;
  end if;

  -- 0-6) view / materialized view 가 이 컬럼을 참조하면 중단한다.
  if exists (select 1 from pg_views where schemaname = 'public' and definition like '%rating_snapshot%') then
    raise exception 'M0075_PRE_UNEXPECTED_VIEW_REFERENCE';
  end if;
  if exists (select 1 from pg_matviews where schemaname = 'public' and definition like '%rating_snapshot%') then
    raise exception 'M0075_PRE_UNEXPECTED_MATVIEW_REFERENCE';
  end if;

  -- 0-7) 컬럼에 걸린 제약 / 인덱스 / 기본값 / 기타 의존이 없어야 한다.
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.event_participants'::regclass
      and v_attnum = any(c.conkey)
  ) then
    raise exception 'M0075_PRE_UNEXPECTED_CONSTRAINT';
  end if;

  if exists (
    select 1 from pg_index i
    where i.indrelid = 'public.event_participants'::regclass
      and v_attnum::int = any(string_to_array(i.indkey::text, ' ')::int[])
  ) then
    raise exception 'M0075_PRE_UNEXPECTED_INDEX';
  end if;

  if exists (
    select 1 from pg_attrdef d
    where d.adrelid = 'public.event_participants'::regclass and d.adnum = v_attnum
  ) then
    raise exception 'M0075_PRE_UNEXPECTED_DEFAULT';
  end if;

  if exists (
    select 1 from pg_depend d
    where d.refclassid = 'pg_class'::regclass
      and d.refobjid = 'public.event_participants'::regclass
      and d.refobjsubid = v_attnum
  ) then
    raise exception 'M0075_PRE_UNEXPECTED_DEPENDENCY';
  end if;
end
$pre$;

-- ------------------------------------------------------------
-- [1] _event_participant_upsert — rating snapshot 복사만 제거
--
-- 0074 판에서 바뀌는 곳은 세 곳뿐이다:
--   · v_rating 선언 삭제
--   · members 조회에서 m.rating 삭제
--   · INSERT 의 rating_snapshot 컬럼/값 삭제
-- signature, 반환 계약(participant_id, outcome), 네 분기와 outcome 문자열,
-- 잠금 순서(FOR UPDATE), volatility, search_path, ACL 은 모두 그대로다.
-- reactivated 경로가 기존 snapshot 을 덮어쓰지 않는 정책도 유지한다.
-- ------------------------------------------------------------
create or replace function public._event_participant_upsert(
  p_event_id uuid,
  p_club_id uuid,
  p_participant_type text,
  p_member_id uuid,
  p_guest_id uuid,
  p_display_name text,
  p_source_type text,
  p_source_attendance_session_id uuid,
  p_source_record_id uuid
) returns table(participant_id uuid, outcome text)
language plpgsql
set search_path = ''
as $$
declare
  v_existing public.event_participants%rowtype;
  v_new_id uuid;
  v_gender text;
  v_start_year smallint;
  v_hand text;
begin
  if p_member_id is not null then
    select * into v_existing
    from public.event_participants
    where event_id = p_event_id and member_id = p_member_id
    for update;
  else
    select * into v_existing
    from public.event_participants
    where event_id = p_event_id and guest_id = p_guest_id
    for update;
  end if;

  if not found then
    -- 회원이면 현재 Profile 을 굳힌다. 게스트는 NULL 로 두고 Admin 이 입력한다.
    if p_member_id is not null then
      select m.gender, m.tennis_start_year, m.dominant_hand
        into v_gender, v_start_year, v_hand
        from public.members m
       where m.id = p_member_id and m.club_id = p_club_id;
    end if;

    insert into public.event_participants (
      event_id, club_id, participant_type, member_id, guest_id, display_name_snapshot,
      source_type, source_attendance_session_id, source_record_id, status, is_active,
      gender_snapshot, tennis_start_year_snapshot, dominant_hand_snapshot
    ) values (
      p_event_id, p_club_id, p_participant_type, p_member_id, p_guest_id, p_display_name,
      p_source_type, p_source_attendance_session_id, p_source_record_id, 'pending', true,
      v_gender, v_start_year, v_hand
    )
    returning id into v_new_id;
    return query select v_new_id, 'inserted'::text;

  elsif v_existing.is_active then
    return query select v_existing.id, 'skipped_active'::text;

  elsif v_existing.status = 'excluded' then
    return query select v_existing.id, 'skipped_excluded'::text;

  else
    update public.event_participants
    set is_active = true,
        status = 'pending',
        display_name_snapshot = p_display_name,
        source_type = p_source_type,
        source_attendance_session_id = p_source_attendance_session_id,
        source_record_id = p_source_record_id,
        updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'reactivated'::text;
  end if;
end;
$$;

-- 0052/0074 와 동일 — private helper 이므로 service_role 까지 회수한다.
revoke all on function public._event_participant_upsert(uuid, uuid, text, uuid, uuid, text, text, uuid, uuid)
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [2] 기존 7인자 RPC 제거
--
-- 인자 개수가 바뀌므로 create or replace 로는 대체할 수 없다.
-- 0074 원문과 catalog 로 확인한 정확한 signature 로만 지우고 CASCADE 는 쓰지
-- 않는다 — 예상 밖의 의존 객체가 있으면 여기서 실패해야 한다.
-- ------------------------------------------------------------
drop function public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text, integer);

-- ------------------------------------------------------------
-- [3] 3필드 RPC 생성
--
-- 인자 순서는 0074 와 호출부(app/api/.../profile/route.ts)를 그대로 따른다 —
-- p_rating 만 빠진다. 세 값 전체 교체 계약, Event/Club scope 강제,
-- completed/cancelled 구조 잠금, 오류 코드는 모두 0074 와 동일하다.
-- ------------------------------------------------------------
create function public.set_event_participant_profile(
  p_participant_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_gender text,
  p_tennis_start_year integer,
  p_dominant_hand text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
begin
  if p_gender is not null and p_gender not in ('male', 'female', 'unspecified') then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: gender';
  end if;
  if p_dominant_hand is not null and p_dominant_hand not in ('right', 'left', 'unspecified') then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: dominant_hand';
  end if;
  if p_tennis_start_year is not null and (p_tennis_start_year < 1900 or p_tennis_start_year > 2200) then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: tennis_start_year';
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

  update public.event_participants
  set gender_snapshot = p_gender,
      tennis_start_year_snapshot = p_tennis_start_year::smallint,
      dominant_hand_snapshot = p_dominant_hand,
      updated_at = now()
  where id = p_participant_id and event_id = p_event_id and club_id = p_club_id;

  if not found then
    raise exception 'EVENT_PARTICIPANT_NOT_FOUND';
  end if;
end;
$$;

revoke all privileges on function
  public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text)
from public, anon, authenticated;

grant execute on function
  public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text)
to service_role;

comment on function public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text) is
'Event 참가자의 자동 대진용 snapshot 3필드를 한 번에 교체한다(0075).
성별 / 테니스 시작 연도 / 주손. NULL 은 "아직 굳지 않음"으로 저장되고
''unspecified''(명시적 미지정)와 의미가 다르다. 부분 갱신이 아니라 전체
교체이므로 호출자가 세 값을 함께 보낸다. rating 은 사용하지 않는다.';

-- ------------------------------------------------------------
-- [4] rating_snapshot 컬럼 제거
--
-- [1]~[3] 으로 함수 참조가 모두 사라진 뒤에만 실행한다. 여기서 한 번 더
-- 함수 참조 0건을 확인하고, CASCADE 없이 제거한다 — 예상 밖의 의존이 남아
-- 있으면 Postgres 가 거부해서 트랜잭션이 전부 되돌아간다.
-- ------------------------------------------------------------
do $mid$
declare
  v_fns text[];
begin
  select array_agg(distinct p.proname::text order by p.proname::text) into v_fns
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%rating_snapshot%';

  if v_fns is not null then
    raise exception 'M0075_MID_FUNCTION_STILL_REFERENCES: %', v_fns;
  end if;
end
$mid$;

alter table public.event_participants
  drop column rating_snapshot;

-- ------------------------------------------------------------
-- [5] 사후 조건 검증
-- ------------------------------------------------------------
do $post$
declare
  v_cnt integer;
  v_types text[];
  v_secdef boolean;
  v_config text[];
  v_acl aclitem[];
  v_src text;
  v_owner oid;
begin
  -- 5-1) 대상 컬럼이 사라졌다.
  if exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.event_participants'::regclass
      and a.attname = 'rating_snapshot'
      and not a.attisdropped
  ) then
    raise exception 'M0075_POST_COLUMN_STILL_PRESENT';
  end if;

  -- 5-2) 남겨야 하는 snapshot 컬럼 3개와 타입이 그대로다.
  select count(*) into v_cnt
  from pg_attribute a
  where a.attrelid = 'public.event_participants'::regclass
    and not a.attisdropped
    and ((a.attname = 'gender_snapshot' and a.atttypid = 'text'::regtype)
      or (a.attname = 'tennis_start_year_snapshot' and a.atttypid = 'int2'::regtype)
      or (a.attname = 'dominant_hand_snapshot' and a.atttypid = 'text'::regtype));

  if v_cnt <> 3 then
    raise exception 'M0075_POST_SNAPSHOT_COLUMNS: expected 3, found %', v_cnt;
  end if;

  -- 5-3) snapshot CHECK 3개가 그대로다.
  select count(*) into v_cnt
  from pg_constraint c
  where c.conrelid = 'public.event_participants'::regclass
    and c.contype = 'c'
    and c.conname in (
      'event_participants_gender_snapshot_check',
      'event_participants_tennis_start_year_snapshot_check',
      'event_participants_dominant_hand_snapshot_check'
    );

  if v_cnt <> 3 then
    raise exception 'M0075_POST_SNAPSHOT_CHECKS: expected 3, found %', v_cnt;
  end if;

  -- 5-4) profile 함수는 정확히 1개이고 6인자다.
  select count(*) into v_cnt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_participant_profile';

  if v_cnt <> 1 then
    raise exception 'M0075_POST_PROFILE_FN_COUNT: expected 1, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_participant_profile';

  if v_types is distinct from array['uuid', 'uuid', 'uuid', 'text', 'integer', 'text']::text[] then
    raise exception 'M0075_POST_PROFILE_FN_SIGNATURE: %', v_types;
  end if;

  -- 5-5) SECURITY DEFINER + 빈 search_path + 반환 타입 void.
  select p.prosecdef, p.proconfig, p.proacl, p.prosrc
    into v_secdef, v_config, v_acl, v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_event_participant_profile';

  if not v_secdef then
    raise exception 'M0075_POST_PROFILE_FN_NOT_SECURITY_DEFINER';
  end if;
  if v_config is null or not exists (select 1 from unnest(v_config) c where c like 'search_path=%') then
    raise exception 'M0075_POST_PROFILE_FN_SEARCH_PATH_MISSING';
  end if;
  if v_src like '%rating%' then
    raise exception 'M0075_POST_PROFILE_FN_STILL_MENTIONS_RATING';
  end if;

  -- 5-6) 실행 권한 — PUBLIC/anon/authenticated 는 없어야 하고 service_role 만 있다.
  --      proacl 이 NULL 이면 기본값(PUBLIC 실행 가능) 상태이므로 실패다.
  if v_acl is null then
    raise exception 'M0075_POST_PROFILE_FN_ACL_IS_DEFAULT';
  end if;
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee = 'anon'::regrole or a.grantee = 'authenticated'::regrole)
  ) then
    raise exception 'M0075_POST_PROFILE_FN_CLIENT_EXECUTE_REMAINS';
  end if;
  if not exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE' and a.grantee = 'service_role'::regrole
  ) then
    raise exception 'M0075_POST_PROFILE_FN_SERVICE_ROLE_MISSING';
  end if;

  -- 5-7) upsert helper — signature 유지, rating 참조 0건, 외부 실행 권한 없음.
  select count(*) into v_cnt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_event_participant_upsert';

  if v_cnt <> 1 then
    raise exception 'M0075_POST_UPSERT_FN_COUNT: expected 1, found %', v_cnt;
  end if;

  select (
    select array_agg(pg_catalog.format_type(t, null) order by ord)
    from unnest(p.proargtypes) with ordinality as u(t, ord)
  ) into v_types
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_event_participant_upsert';

  if v_types is distinct from array['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'text', 'uuid', 'uuid']::text[] then
    raise exception 'M0075_POST_UPSERT_FN_SIGNATURE: %', v_types;
  end if;

  select p.proacl, p.prosrc, p.proowner into v_acl, v_src, v_owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_event_participant_upsert';

  if v_src like '%rating%' then
    raise exception 'M0075_POST_UPSERT_FN_STILL_MENTIONS_RATING';
  end if;
  if v_acl is null then
    raise exception 'M0075_POST_UPSERT_FN_ACL_IS_DEFAULT';
  end if;
  -- 소유자(postgres)의 자기 권한은 회수 대상이 아니다 — 그 밖의 누구에게도
  -- 실행 권한이 남아 있으면 안 된다(service_role 포함).
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.privilege_type = 'EXECUTE' and a.grantee <> v_owner
  ) then
    raise exception 'M0075_POST_UPSERT_FN_EXECUTE_REMAINS';
  end if;

  -- 5-8) members.rating / members.grade / guests.skill_grade 는 그대로 있어야 한다.
  --      이 migration 이 그것들을 건드리지 않았음을 코드로 못박는다.
  if not exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.members'::regclass and a.attname = 'rating' and not a.attisdropped
  ) then
    raise exception 'M0075_POST_MEMBERS_RATING_MISSING';
  end if;
  if not exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.members'::regclass and a.attname = 'grade' and not a.attisdropped
  ) then
    raise exception 'M0075_POST_MEMBERS_GRADE_MISSING';
  end if;
  if not exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.guests'::regclass and a.attname = 'skill_grade' and not a.attisdropped
  ) then
    raise exception 'M0075_POST_GUESTS_SKILL_GRADE_MISSING';
  end if;
end
$post$;

-- 함수 signature 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
-- 삭제된 rating_snapshot 값(Production 7 행)은 복구되지 않는다.
-- 컬럼과 함수 계약만 0074 상태로 되돌린다.
--
--   begin;
--   alter table public.event_participants add column rating_snapshot integer;
--   comment on column public.event_participants.rating_snapshot is
--     '참가 시점의 실력 지표. 회원은 members.rating 복사, 게스트는 직접 입력. 당일 보정 가능.';
--   drop function public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text);
--   -- 아래 두 함수는 0074 원문 정의를 그대로 다시 적용한다:
--   --   _event_participant_upsert      (v_rating / m.rating / rating_snapshot 포함)
--   --   set_event_participant_profile  (7인자, p_rating 포함)
--   -- 0074 의 revoke/grant 문도 함께 다시 발급해야 한다.
--   notify pgrst, 'reload schema';
--   commit;
-- ============================================================
