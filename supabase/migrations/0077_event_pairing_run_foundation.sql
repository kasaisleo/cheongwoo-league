-- ============================================================
-- 0077: Pairing Run 기반 + Game provenance (Phase 2A-9D-B-2)
--
-- 이 migration 은 자동 대진의 "기록 구조"만 만든다. preview RPC, commit RPC,
-- 자동 대진 알고리즘, seed 생성 UI, Game 생성·삭제·감소는 여기서 만들지 않고
-- source='auto' Game 도 만들지 않는다(만들 경로 자체가 없다).
--
-- ------------------------------------------------------------
-- [A] 단계형 운영 흐름 (2A-9D-B-2 재확정)
-- ------------------------------------------------------------
--   1. Game 생성            (ensure_event_game_count — 기존)
--   2. Game 수 설정
--   3. Game 종류·Court/Session 설정 (0076 set_event_game_gender_category / place_event_game)
--   4. 선수 배정            · 자동 preview/commit (9D-C/9D-D)
--                           · 수동 lineup (set_event_game_players — 기존)
--   5. Game 진행·종료
--   6. Match 결과 입력
--
--   자동 대진도 Game 을 "먼저 만든다". commit 은 새 Game 을 만들지 않고
--   이미 존재하는 빈 draft Game 에 lineup 을 채운 뒤, 같은 트랜잭션에서
--   source='auto' 와 pairing_run_id 를 함께 설정한다. 그래야 Game 수와
--   Game row 가 preview/commit 사이에 임의로 늘거나 줄지 않는다.
--
-- ------------------------------------------------------------
-- [B] run row 는 commit 성공 시에만 존재한다
-- ------------------------------------------------------------
--   preview 는 DB write 0건이고 commit 은 단일 트랜잭션이므로,
--   실패한 commit 은 rollback 되어 run row 자체가 남지 않는다.
--   따라서 status 컬럼도 committed_at 컬럼도 만들지 않는다:
--     · row 존재 = committed
--     · created_at = commit 시각
--     · superseded_at = 나중에 재생성으로 결과가 대체될 때만 기록(9D-D)
--   'failed' / 'stale' 상태는 구조적으로 저장될 수 없다.
--
-- ------------------------------------------------------------
-- [C] snapshot 정본
-- ------------------------------------------------------------
--   config_snapshot : normalized match_config + 알고리즘 고정 파라미터 +
--                     default 적용 결과 (calculation_year 포함)
--   input_snapshot  : Event 식별·운영 상태 / players raw+effective 입력 /
--                     Games / derived history
--   두 곳에 같은 config 를 중복 저장하지 않는다.
--
--   input_hash 는 다음 envelope 전체의 SHA-256 이다:
--       { "config": <config_snapshot>, "input": <input_snapshot> }
--   config 변경도 stale 로 판정된다.
--
--   input_snapshot 은 "전체가" hash 대상이다 — 일부만 제외되는 JSON 영역을
--   만들지 않는다. preview 의 capturedAt 은 응답 metadata 이고, committed run
--   의 시각은 created_at 이다.
--
--   표시 이름(display_name_snapshot 원문/해시)은 저장하지 않는다 —
--   알고리즘 입력이 아니고, 이름 변경이 대진 stale 사유가 되면 안 된다.
--   participant ID 만 저장하고 UI 는 현재 roster 와 조합해 표시한다.
--
--   경력 계산 기준 연도는 서버 현재 연도가 아니라
--       calculation_year = extract(year from events.event_date)
--   이다(events.event_date 는 0050 부터 NOT NULL). 그래야 해가 바뀌어도
--   같은 Event 의 hash 가 변하지 않고 미래 Event 도 그 Event 기준으로 계산된다.
--
--   hashed payload 에는 실수를 넣지 않는다(정수·문자열·null 만).
--   축소 승률, 경력 정규화, 가중 전력 점수, coverage 비율, imputed median 은
--   전부 제외하고 엔진이 algorithm_version 기준으로 재계산한다.
--   coverage 는 result_summary 에 둔다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] event_pairing_runs 테이블 + CHECK + FK + index + RLS/ACL + COMMENT
--   [2] event_games.pairing_run_id 컬럼 + 복합 FK + source 짝 CHECK
--
-- 건드리지 않는 것: 기존 테이블 데이터(backfill 0건), 기존 함수,
--   RLS/policy/relation ACL, Public RPC, member_stats, match_config,
--   members.rating / members.grade / guests.skill_grade, 기존 migration 원문.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ------------------------------------------------------------
-- [0] 사전 조건 검증
-- ------------------------------------------------------------
do $pre$
declare
  v_cnt integer;
begin
  if to_regclass('public.event_pairing_runs') is not null then
    raise exception 'M0077_PRE_TABLE_EXISTS: public.event_pairing_runs';
  end if;

  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_games'::regclass
      and attname = 'pairing_run_id' and not attisdropped
  ) then
    raise exception 'M0077_PRE_COLUMN_EXISTS: event_games.pairing_run_id';
  end if;

  -- 0076 이 만든 컬럼이 있어야 한다(적용 순서 보증).
  select count(*) into v_cnt
  from pg_attribute
  where attrelid = 'public.event_games'::regclass and not attisdropped
    and attname in ('gender_category', 'gender_category_source', 'manually_modified_at');
  if v_cnt <> 3 then
    raise exception 'M0077_PRE_0076_MISSING: expected 3 category columns, found %', v_cnt;
  end if;

  -- events.event_date 는 NOT NULL 이어야 calculation_year 가 항상 도출된다.
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.events'::regclass and attname = 'event_date'
      and not attisdropped and attnotnull
  ) then
    raise exception 'M0077_PRE_EVENT_DATE_NULLABLE';
  end if;

  -- 복합 FK 의 참조 대상 unique 제약이 있어야 한다.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass and conname = 'events_id_club_id_uniq'
  ) then
    raise exception 'M0077_PRE_EVENTS_UNIQUE_MISSING';
  end if;

  -- members(club_id, id) unique — event_games.created_by FK 가 쓰는 것과 동일.
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.members'::regclass and c.contype in ('u', 'p')
      and (select array_agg(a.attname::text order by a.attname)
             from pg_attribute a
            where a.attrelid = c.conrelid and a.attnum = any(c.conkey))
          = array['club_id', 'id']::text[]
  ) then
    raise exception 'M0077_PRE_MEMBERS_CLUB_ID_UNIQUE_MISSING';
  end if;

  -- 기존 Game 은 전부 manual 이어야 source 짝 CHECK 가 backfill 없이 통과한다.
  select count(*) into v_cnt from public.event_games where source <> 'manual';
  if v_cnt <> 0 then
    raise exception 'M0077_PRE_UNEXPECTED_AUTO_GAMES: %', v_cnt;
  end if;
end
$pre$;

-- ------------------------------------------------------------
-- [1] event_pairing_runs
--
-- ON DELETE 정책:
--   · events           → RESTRICT. Event 를 지우면서 provenance 를 잃지 않는다
--                        (실제로 Event 삭제 경로는 존재하지 않는다).
--   · members(actor)   → SET NULL (created_by). club_id 는 NOT NULL 이라
--                        전체 SET NULL 을 쓸 수 없다. PostgreSQL 15+ 의
--                        컬럼 지정 SET NULL 을 쓴다(Production 17.6).
--                        members 는 soft delete only 라 실제로는 발화하지
--                        않지만, 발화하더라도 Club scope 는 보존된다.
-- ------------------------------------------------------------
create table public.event_pairing_runs (
  id                  uuid        primary key default gen_random_uuid(),
  event_id            uuid        not null,
  club_id             uuid        not null,

  algorithm_version   text        not null,
  seed                text        not null,

  config_snapshot     jsonb       not null,
  input_snapshot      jsonb       not null,
  input_hash          text        not null,
  result_snapshot     jsonb       not null,
  result_hash         text        not null,
  result_summary      jsonb       not null default '{}'::jsonb,

  created_by          uuid,
  created_at          timestamptz not null default now(),
  superseded_at       timestamptz,

  constraint event_pairing_runs_algorithm_version_check
    check (algorithm_version ~ '^v[0-9]+$'),
  constraint event_pairing_runs_seed_not_blank
    check (btrim(seed) <> ''),
  -- 소문자 SHA-256 64 hex 만 허용한다(대문자·길이 오류를 DB 가 잡는다).
  constraint event_pairing_runs_input_hash_check
    check (input_hash ~ '^[0-9a-f]{64}$'),
  constraint event_pairing_runs_result_hash_check
    check (result_hash ~ '^[0-9a-f]{64}$'),
  constraint event_pairing_runs_superseded_after_created
    check (superseded_at is null or superseded_at >= created_at),
  constraint event_pairing_runs_config_snapshot_object
    check (jsonb_typeof(config_snapshot) = 'object'),
  constraint event_pairing_runs_input_snapshot_object
    check (jsonb_typeof(input_snapshot) = 'object'),
  constraint event_pairing_runs_result_snapshot_object
    check (jsonb_typeof(result_snapshot) = 'object'),
  constraint event_pairing_runs_result_summary_object
    check (jsonb_typeof(result_summary) = 'object'),

  constraint event_pairing_runs_id_event_club_uniq unique (id, event_id, club_id),
  constraint event_pairing_runs_event_club_fk
    foreign key (event_id, club_id) references public.events (id, club_id)
    on delete restrict,
  constraint event_pairing_runs_created_by_club_fk
    foreign key (club_id, created_by) references public.members (club_id, id)
    on delete set null (created_by)
);

comment on table public.event_pairing_runs is
  '자동 대진 실행 기록(0077). row 가 존재한다는 것 자체가 commit 성공을 뜻한다 —
   preview 는 DB write 가 없고 commit 은 단일 트랜잭션이라 실패한 실행은 남지 않는다.
   status / committed_at 컬럼을 두지 않는 이유가 이것이다. 삭제 RPC 는 없다.';
comment on column public.event_pairing_runs.algorithm_version is
  '실행에 쓰인 알고리즘 판본. v1, v2 … 형식. match_config 에 중복 저장하지 않는다.';
comment on column public.event_pairing_runs.seed is
  '재현성 필수 입력. 같은 input_hash + algorithm_version + seed 는 같은 결과를 만든다.
   UUID 정렬은 candidate canonicalization 에만 쓰이고 seed 를 대체하지 않는다.';
comment on column public.event_pairing_runs.config_snapshot is
  '실행 시점 normalized match_config + 알고리즘 고정 파라미터 + default 적용 결과
   (calculation_year 포함). input_snapshot 에 같은 config 를 중복 저장하지 않는다.';
comment on column public.event_pairing_runs.input_snapshot is
  '실행 시점 입력 정본 전체 — Event 상태 / players / Games / derived history.
   표시 이름은 저장하지 않고 participant ID 만 둔다. 전체가 hash 대상이다.';
comment on column public.event_pairing_runs.input_hash is
  'sha256({"config":config_snapshot,"input":input_snapshot}) 의 소문자 hex.
   commit 시 재capture 한 값과 다르면 stale 로 거부한다.';
comment on column public.event_pairing_runs.result_snapshot is
  '이 run 이 결정한 배정 원본. 기존 target Game ID 를 그대로 쓰고 새 ID 를 만들지 않는다.
   이후 관리자가 수동 수정해도 알고리즘이 무엇을 냈는지가 남는다.';
comment on column public.event_pairing_runs.result_summary is
  '지표·완화·중립값 적용 내역. coverage 비율처럼 실수인 값은 여기에 둔다
   (hash 대상 payload 에는 실수를 넣지 않는다).';
comment on column public.event_pairing_runs.created_by is
  '실행한 운영진 members.id. 서버가 도출한 access.memberId 만 쓰고 요청 body 값은 신뢰하지 않는다.
   nullable — 시스템 실행 경로를 미리 막지 않는다.';
comment on column public.event_pairing_runs.superseded_at is
  '이 run 의 결과가 재생성으로 대체된 시각(9D-D). append run 은 이전 run 을 supersede 하지 않는다.';

create index event_pairing_runs_event_created_idx
  on public.event_pairing_runs (event_id, created_at desc);
create index event_pairing_runs_event_input_hash_idx
  on public.event_pairing_runs (event_id, input_hash);

alter table public.event_pairing_runs enable row level security;
-- 정책 0개 — anon/authenticated 는 GRANT 자체가 없어 정책 여부와 무관하게 접근 불가.
revoke all on public.event_pairing_runs from public, anon, authenticated, service_role;
grant select on public.event_pairing_runs to service_role;
-- INSERT/UPDATE/DELETE 는 어떤 role 에도 부여하지 않는다 — 쓰기는 향후 RPC 전용.

-- ------------------------------------------------------------
-- [2] event_games.pairing_run_id — Game provenance
--
-- 기존 Production 은 source='auto' 가 0건이고 create_event_game /
-- ensure_event_game_count 가 'manual' 하드코딩이므로, 아래 CHECK 는
-- 기존 모든 행에서 (false)=(false) 로 참이 되어 backfill 이 필요 없다.
-- ------------------------------------------------------------
alter table public.event_games
  add column pairing_run_id uuid;

alter table public.event_games
  add constraint event_games_pairing_run_fk
  foreign key (pairing_run_id, event_id, club_id)
  references public.event_pairing_runs (id, event_id, club_id)
  on delete restrict;

alter table public.event_games
  add constraint event_games_pairing_run_source_check
  check ((source = 'auto') = (pairing_run_id is not null));

comment on column public.event_games.pairing_run_id is
  '이 Game 의 lineup 을 만든 자동 대진 실행(0077). source=''auto'' 와 정확히 짝을 이룬다
   (CHECK 로 강제). stable-prefix append 에서 기존 auto Game 은 최초 생성 run 을 유지하고
   새로 채운 Game 만 새 run 을 가리킨다. 수동 수정된 auto Game 도 source 와 이 FK 를
   유지하고 manually_modified_at 만 기록한다.';

-- ------------------------------------------------------------
-- [3] 사후 조건 검증
-- ------------------------------------------------------------
do $post$
declare
  v_cnt integer;
  v_acl aclitem[];
  v_owner oid;
  v_confupd "char";
begin
  -- 3-1) 테이블과 컬럼 14개.
  if to_regclass('public.event_pairing_runs') is null then
    raise exception 'M0077_POST_TABLE_MISSING';
  end if;
  select count(*) into v_cnt
  from pg_attribute where attrelid = 'public.event_pairing_runs'::regclass
    and attnum > 0 and not attisdropped;
  if v_cnt <> 14 then
    raise exception 'M0077_POST_COLUMN_COUNT: expected 14, found %', v_cnt;
  end if;

  -- 3-2) status / committed_at 컬럼을 만들지 않았다.
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_pairing_runs'::regclass
      and attname in ('status', 'committed_at') and not attisdropped
  ) then
    raise exception 'M0077_POST_UNEXPECTED_STATUS_COLUMN';
  end if;

  -- 3-3) CHECK 9종.
  select count(*) into v_cnt
  from pg_constraint
  where conrelid = 'public.event_pairing_runs'::regclass and contype = 'c';
  if v_cnt <> 9 then
    raise exception 'M0077_POST_CHECK_COUNT: expected 9, found %', v_cnt;
  end if;

  -- 3-4) FK 2종과 삭제 정책.
  select confupdtype into v_confupd from pg_constraint
  where conrelid = 'public.event_pairing_runs'::regclass
    and conname = 'event_pairing_runs_event_club_fk';
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_pairing_runs'::regclass
      and conname = 'event_pairing_runs_event_club_fk' and confdeltype = 'r'
  ) then
    raise exception 'M0077_POST_EVENT_FK_NOT_RESTRICT';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_pairing_runs'::regclass
      and conname = 'event_pairing_runs_created_by_club_fk' and confdeltype = 'n'
  ) then
    raise exception 'M0077_POST_ACTOR_FK_NOT_SET_NULL';
  end if;

  -- 3-5) RLS on / policy 0 / service_role SELECT only.
  if not (select relrowsecurity from pg_class where oid = 'public.event_pairing_runs'::regclass) then
    raise exception 'M0077_POST_RLS_DISABLED';
  end if;
  select count(*) into v_cnt from pg_policies
  where schemaname = 'public' and tablename = 'event_pairing_runs';
  if v_cnt <> 0 then
    raise exception 'M0077_POST_UNEXPECTED_POLICY: %', v_cnt;
  end if;

  select c.relacl, c.relowner into v_acl, v_owner
  from pg_class c where c.oid = 'public.event_pairing_runs'::regclass;
  if v_acl is null then
    raise exception 'M0077_POST_RELACL_IS_DEFAULT';
  end if;
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.grantee = 0 or a.grantee = 'anon'::regrole or a.grantee = 'authenticated'::regrole
  ) then
    raise exception 'M0077_POST_CLIENT_PRIVILEGE_REMAINS';
  end if;
  if exists (
    select 1 from aclexplode(v_acl) a
    where a.grantee = 'service_role'::regrole and a.privilege_type <> 'SELECT'
  ) then
    raise exception 'M0077_POST_SERVICE_ROLE_WRITE_GRANTED';
  end if;
  if not exists (
    select 1 from aclexplode(v_acl) a
    where a.grantee = 'service_role'::regrole and a.privilege_type = 'SELECT'
  ) then
    raise exception 'M0077_POST_SERVICE_ROLE_SELECT_MISSING';
  end if;

  -- 3-6) event_games 쪽 컬럼·FK·CHECK.
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.event_games'::regclass and attname = 'pairing_run_id'
      and not attisdropped and atttypid = 'uuid'::regtype and not attnotnull
  ) then
    raise exception 'M0077_POST_GAME_COLUMN';
  end if;
  if exists (
    select 1 from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.event_games'::regclass and a.attname = 'pairing_run_id'
  ) then
    raise exception 'M0077_POST_GAME_COLUMN_DEFAULT';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_games'::regclass
      and conname = 'event_games_pairing_run_fk' and confdeltype = 'r'
  ) then
    raise exception 'M0077_POST_GAME_FK';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_games'::regclass
      and conname = 'event_games_pairing_run_source_check' and contype = 'c'
  ) then
    raise exception 'M0077_POST_GAME_SOURCE_CHECK';
  end if;

  -- 3-7) 기존 Game backfill 0건.
  select count(*) into v_cnt from public.event_games where pairing_run_id is not null;
  if v_cnt <> 0 then
    raise exception 'M0077_POST_UNEXPECTED_BACKFILL: %', v_cnt;
  end if;
  select count(*) into v_cnt from public.event_games where source <> 'manual';
  if v_cnt <> 0 then
    raise exception 'M0077_POST_UNEXPECTED_AUTO_GAMES: %', v_cnt;
  end if;

  -- 3-8) event_games 의 기존 보안 계약은 그대로다.
  if not (select relrowsecurity from pg_class where oid = 'public.event_games'::regclass) then
    raise exception 'M0077_POST_GAMES_RLS_DISABLED';
  end if;
  select count(*) into v_cnt from pg_policies
  where schemaname = 'public' and tablename = 'event_games';
  if v_cnt <> 0 then
    raise exception 'M0077_POST_GAMES_UNEXPECTED_POLICY';
  end if;

  -- 3-9) run 테이블은 비어 있어야 한다(이 migration 은 row 를 만들지 않는다).
  select count(*) into v_cnt from public.event_pairing_runs;
  if v_cnt <> 0 then
    raise exception 'M0077_POST_UNEXPECTED_RUN_ROWS: %', v_cnt;
  end if;

  perform v_confupd;
end
$post$;

-- 신규 테이블·컬럼을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
--   begin;
--   alter table public.event_games
--     drop constraint event_games_pairing_run_source_check,
--     drop constraint event_games_pairing_run_fk,
--     drop column pairing_run_id;
--   drop table public.event_pairing_runs;
--   notify pgrst, 'reload schema';
--   commit;
--
-- run row 가 하나라도 있으면 event_games.pairing_run_id 참조 때문에
-- drop table 이 실패한다 — 그때는 provenance 처리 방침을 먼저 정해야 한다.
-- ============================================================
