-- ============================================================
-- 0070: platform_audit_logs.club_id FK 복구 (Phase 2A-8E-1C)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 2A-8E-1B-R 조사에서 확정된 Production drift 1건이다.
--   저장소 재생 DB : platform_audit_logs_club_id_fkey 존재
--   Production     : 부재
-- FK 집합 diff에서 재생 DB에만 있는 유일한 제약이며, 정본은
-- 0029_platform_audit_logs.sql:17 의 inline 참조다.
--
--   club_id uuid references public.clubs(id) on delete set null
--
-- FK가 없는 동안 Club이 삭제되면 ON DELETE SET NULL이 동작하지 않아
-- 감사 로그에 존재하지 않는 Club을 가리키는 stale UUID가 남는다.
-- Production에 실제로 그런 행이 2건 있다(삭제된 QA 임시 Club 1개).
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] 테이블 / 컬럼 / 참조 키 / 타입 검증
--   [2] 기존 FK 상태 판정 (정의·validated·동일 semantics 중복까지)
--   [3] orphan 상태 검증 — 허용 상태는 정확히 두 가지뿐
--         A. orphan 0                (fresh replay / 재실행)
--         B. 승인된 QA orphan 2      (Production 최초 적용)
--       그 외에는 명시적 예외로 트랜잭션 전체를 rollback 한다.
--   [4] 상태 B일 때만 club_id를 NULL로 정리 — 정본 FK의 ON DELETE
--       SET NULL 동작을 사후 복원하는 것이며, 별도 승인을 받았다.
--   [5] 변경 행 수 검증 (예상과 다르면 예외 → rollback)
--   [6] FK가 없으면 0029 정본 그대로 NOT VALID 로 추가
--   [7] VALIDATE CONSTRAINT
--   [8] postcondition (convalidated=true, orphan 0)
--
-- UUID·row id 를 하드코딩하지 않는다. 대상은 의미 계약으로만 식별한다.
-- 감사 로그 DELETE 0건, club_id 외 컬럼 변경 0건, Club row 생성 0건.
-- 다른 테이블 / 다른 constraint / index / grant / RLS / policy 변경 0건.
-- ============================================================

begin;

-- DDL lock 은 대상 행 수와 무관하게 테이블 전체를 잠근다.
-- 잡히지 않으면 재시도하지 않고 실패시켜 전체를 rollback 한다.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  c_fkname  constant text := 'platform_audit_logs_club_id_fkey';
  c_fkdef   constant text :=
    'FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL';

  v_oid        oid;
  v_attnum     smallint;
  v_coltype    text;
  v_reftype    text;
  v_fk_def     text;
  v_fk_valid   boolean;
  v_fk_defer   boolean;
  v_dup        text;
  v_orphans    bigint;
  v_clubs      bigint;
  v_actions    text;
  v_meta_ok    boolean;
  v_extrefs    bigint := 0;
  v_tbl        record;
  v_cnt        bigint;
  v_updated    bigint;
  v_state      text;      -- 'A' = orphan 0, 'B' = 승인된 QA orphan 2
begin
  -- ----------------------------------------------------------
  -- [1] 테이블 / 컬럼 / 참조 키 / 타입 검증
  -- ----------------------------------------------------------
  v_oid := to_regclass('public.platform_audit_logs');
  if v_oid is null then
    raise exception 'PAL_FK_MISSING_TABLE: public.platform_audit_logs not found';
  end if;

  if to_regclass('public.clubs') is null then
    raise exception 'PAL_FK_MISSING_TABLE: public.clubs not found';
  end if;

  select a.attnum, format_type(a.atttypid, a.atttypmod)
    into v_attnum, v_coltype
    from pg_attribute a
   where a.attrelid = v_oid and a.attname = 'club_id' and not a.attisdropped;

  if v_attnum is null then
    raise exception 'PAL_FK_MISSING_COLUMN: platform_audit_logs.club_id not found';
  end if;

  select format_type(a.atttypid, a.atttypmod) into v_reftype
    from pg_attribute a
   where a.attrelid = 'public.clubs'::regclass and a.attname = 'id' and not a.attisdropped;

  if v_coltype is distinct from 'uuid' or v_reftype is distinct from 'uuid' then
    raise exception 'PAL_FK_TYPE_MISMATCH: club_id=% clubs.id=% (both must be uuid)',
      v_coltype, v_reftype;
  end if;

  -- clubs(id) 가 참조 가능한 키여야 한다.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.clubs'::regclass and contype in ('p', 'u')
       and conkey = array[(select a.attnum from pg_attribute a
                            where a.attrelid = 'public.clubs'::regclass and a.attname = 'id')]
  ) then
    raise exception 'PAL_FK_NO_REFERENCED_KEY: clubs(id) has no primary/unique key';
  end if;

  -- ----------------------------------------------------------
  -- [2] 기존 FK 상태 판정
  -- ----------------------------------------------------------
  select pg_get_constraintdef(oid), convalidated, condeferrable
    into v_fk_def, v_fk_valid, v_fk_defer
    from pg_constraint
   where conrelid = v_oid and conname = c_fkname;

  if v_fk_def is not null then
    -- pg_get_constraintdef 은 아직 검증되지 않은 제약에 ' NOT VALID' 접미사를 붙인다.
    -- 검증 여부는 convalidated 로 따로 판정하므로 정의 비교에서는 떼어낸다.
    v_fk_def := regexp_replace(v_fk_def, '\s+NOT VALID$', '');

    -- 같은 이름이 이미 있다면 정본과 정확히 같아야 한다. 자동 수정하지 않는다.
    if v_fk_def is distinct from c_fkdef then
      raise exception 'PAL_FK_DEFINITION_CONFLICT: % exists with a different definition. found=%',
        c_fkname, v_fk_def;
    end if;
    if v_fk_defer then
      raise exception 'PAL_FK_DEFINITION_CONFLICT: % must not be deferrable', c_fkname;
    end if;
  end if;

  -- 이름만 다른 동일 semantics FK 가 있으면 중복 생성하지 않고 중단한다.
  select string_agg(conname || '=' || pg_get_constraintdef(oid), ' ; ' order by conname)
    into v_dup
    from pg_constraint
   where conrelid = v_oid and contype = 'f'
     and conkey = array[v_attnum]
     and conname <> c_fkname;

  if v_dup is not null then
    raise exception 'PAL_FK_DUPLICATE_SEMANTICS: another FK already covers club_id. found=%', v_dup;
  end if;

  -- ----------------------------------------------------------
  -- [3] orphan 상태 검증 — 허용 상태는 A 또는 B 뿐
  -- ----------------------------------------------------------
  select count(*), count(distinct p.club_id)
    into v_orphans, v_clubs
    from public.platform_audit_logs p
   where p.club_id is not null
     and not exists (select 1 from public.clubs c where c.id = p.club_id);

  if v_orphans = 0 then
    v_state := 'A';

  elsif v_orphans = 2 then
    -- 승인된 대상인지 의미 계약으로만 확인한다(UUID 하드코딩 금지).
    if v_clubs <> 1 then
      raise exception 'PAL_FK_UNAPPROVED_ORPHANS: expected 1 distinct orphan club, found %', v_clubs;
    end if;

    select string_agg(p.action, '+' order by p.action),
           bool_and(p.metadata::text like '%bootstrap_qa_tmp%')
      into v_actions, v_meta_ok
      from public.platform_audit_logs p
     where p.club_id is not null
       and not exists (select 1 from public.clubs c where c.id = p.club_id);

    if v_actions is distinct from 'club.create+club.master_bootstrap' then
      raise exception 'PAL_FK_UNAPPROVED_ORPHANS: unexpected action set. found=%', v_actions;
    end if;

    if not coalesce(v_meta_ok, false) then
      raise exception 'PAL_FK_UNAPPROVED_ORPHANS: metadata does not identify the approved QA club';
    end if;

    -- 운영 테이블이 같은 Club 을 아직 참조하고 있으면 삭제된 QA Club 이 아니다.
    -- club_id 컬럼을 가진 public 테이블을 동적으로 훑어 환경 차이에 견디게 한다.
    for v_tbl in
      select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'club_id' and not a.attisdropped
       where n.nspname = 'public' and c.relkind = 'r'
         and c.relname <> 'platform_audit_logs'
       order by c.relname
    loop
      execute format(
        'select count(*) from public.%I t where t.club_id in ('
        || 'select p.club_id from public.platform_audit_logs p '
        || 'where p.club_id is not null and not exists ('
        || 'select 1 from public.clubs c where c.id = p.club_id))', v_tbl.relname)
        into v_cnt;
      if v_cnt > 0 then
        raise exception 'PAL_FK_UNAPPROVED_ORPHANS: table % still references the orphan club (% rows)',
          v_tbl.relname, v_cnt;
      end if;
      v_extrefs := v_extrefs + v_cnt;
    end loop;

    v_state := 'B';

  else
    raise exception 'PAL_FK_UNAPPROVED_ORPHANS: expected 0 or the approved 2, found % rows across % clubs',
      v_orphans, v_clubs;
  end if;

  raise notice '0070: orphan state = % (rows=%, clubs=%, external refs=%)',
    v_state, v_orphans, v_clubs, v_extrefs;

  -- ----------------------------------------------------------
  -- [4][5] 상태 B 에서만 club_id 정리 + 변경 행 수 검증
  -- ----------------------------------------------------------
  if v_state = 'B' then
    update public.platform_audit_logs pal
       set club_id = null
     where pal.club_id is not null
       and not exists (select 1 from public.clubs c where c.id = pal.club_id);

    get diagnostics v_updated = row_count;

    if v_updated <> 2 then
      raise exception 'PAL_FK_UNEXPECTED_ROWCOUNT: expected 2 updated rows, got %', v_updated;
    end if;

    raise notice '0070: cleared club_id on % approved audit rows', v_updated;
  end if;

  -- ----------------------------------------------------------
  -- [6][7] FK 추가(없을 때만) + validation
  -- ----------------------------------------------------------
  if v_fk_def is null then
    execute format(
      'alter table public.platform_audit_logs add constraint %I '
      || 'foreign key (club_id) references public.clubs(id) on delete set null not valid',
      c_fkname);
    raise notice '0070: % added as NOT VALID', c_fkname;
  end if;

  select convalidated into v_fk_valid from pg_constraint
   where conrelid = v_oid and conname = c_fkname;

  if not v_fk_valid then
    execute format('alter table public.platform_audit_logs validate constraint %I', c_fkname);
    raise notice '0070: % validated', c_fkname;
  end if;

  -- ----------------------------------------------------------
  -- [8] postcondition
  -- ----------------------------------------------------------
  select pg_get_constraintdef(oid), convalidated, condeferrable
    into v_fk_def, v_fk_valid, v_fk_defer
    from pg_constraint
   where conrelid = v_oid and conname = c_fkname;

  if v_fk_def is null then
    raise exception 'PAL_FK_POSTCONDITION_FAILED: % missing after migration', c_fkname;
  end if;

  -- 검증 여부는 아래 convalidated 검사가 담당한다. 정의 비교에서는 접미사를 뗀다.
  v_fk_def := regexp_replace(v_fk_def, '\s+NOT VALID$', '');

  if v_fk_def is distinct from c_fkdef then
    raise exception 'PAL_FK_POSTCONDITION_FAILED: definition mismatch. found=%', v_fk_def;
  end if;

  if not v_fk_valid then
    raise exception 'PAL_FK_POSTCONDITION_FAILED: % is not validated', c_fkname;
  end if;

  if v_fk_defer then
    raise exception 'PAL_FK_POSTCONDITION_FAILED: % must not be deferrable', c_fkname;
  end if;

  if exists (
    select 1 from public.platform_audit_logs p
     where p.club_id is not null
       and not exists (select 1 from public.clubs c where c.id = p.club_id)
  ) then
    raise exception 'PAL_FK_POSTCONDITION_FAILED: orphan rows still present';
  end if;
end
$$;

-- 제약 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
-- 제약만 되돌린다.
--   begin;
--   alter table public.platform_audit_logs
--     drop constraint if exists platform_audit_logs_club_id_fkey;
--   notify pgrst, 'reload schema';
--   commit;
--
-- NULL 로 정리한 2행의 club_id 는 되돌리지 않는다. 그 값은 이미 삭제된
-- QA Club 을 가리키는 stale 참조이고, 정본 FK 의 ON DELETE SET NULL 이
-- 살아 있었다면 애초에 NULL 이었을 값이다. 감사 정보(action / target_type /
-- target_id / target_label / metadata / platform_admin / created_at)는
-- 전부 그대로 남아 있으므로 복원할 감사 근거가 사라지지 않는다.
-- ============================================================
