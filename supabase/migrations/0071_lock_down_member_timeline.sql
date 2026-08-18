-- ============================================================
-- 0071: member_timeline 최소 권한 적용 (Phase 2A-8E-1D)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 2A-8E-0A/0C 드리프트 조사에서 확인된 Production-only 테이블이다.
-- 저장소 migration 은 이 테이블을 만들지 않는다(결번 구간의 수동 SQL 산물).
--
-- Production 상태:
--   RLS enabled=true, forced=false
--   anon / authenticated 가 SELECT·INSERT·UPDATE·DELETE 를 포함한
--   테이블 권한 전부(arwdDxtm)를 보유
--   policy member_timeline_select_all — SELECT / {public} / using=true
--
-- RLS 가 켜져 있어도 permissive SELECT policy 가 using=true 이므로
-- anon 은 전체 행을 읽을 수 있다. 쓰기 쪽은 policy 가 없어 RLS 가 막지만,
-- 테이블 권한 자체가 남아 있는 것은 최소 권한 원칙에 어긋난다.
--
-- 코드 소비처는 전부 service_role 경유다(2A-8E-1D에서 재확인).
--   app/api/members/timeline/route.ts            createServiceClient()
--   app/api/members/timeline/[timelineId]/route.ts  createServiceClient()
--   lib/member-timeline-validation.ts            호출자가 service client 주입
-- browser anon/authenticated client 의 직접 .from("member_timeline") 은 0건이므로
-- 권한을 회수해도 공개 타임라인 API 기능은 그대로 동작한다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] 테이블이 없으면 안전하게 no-op (minimal-augmented replay)
--   [2] 테이블이 있으면 적용 전에 계약을 검증한다
--         - 일반 table 인지
--         - policy 가 있다면 정확히 member_timeline_select_all 하나이고
--           SELECT / PERMISSIVE / {public} / using=true / with_check 없음
--         - 예상 외 policy 가 하나라도 있으면 RAISE EXCEPTION
--       조용히 DROP POLICY IF EXISTS 만 하고 끝내지 않는다.
--   [3] PUBLIC / anon / authenticated 테이블 권한 회수 + policy 제거
--   [4] postcondition 검증 (service_role·owner 권한 불변 포함)
--
-- 데이터 DML 0건. table/column/constraint/index 변경 0건.
-- 다른 테이블 권한 변경 0건. default privileges 변경 0건.
-- policy 신규 생성 0건. FORCE ROW LEVEL SECURITY 사용 0건. CASCADE 0건.
-- ============================================================

begin;

do $$
declare
  c_tbl     constant text := 'public.member_timeline';
  c_policy  constant text := 'member_timeline_select_all';

  v_oid       oid;
  v_relkind   "char";
  v_owner     text;
  v_svc_before text;
  v_own_before text;
  v_svc_after  text;
  v_own_after  text;
  v_npol      int;
  v_bad       text;
  v_rows      bigint;
  v_hash      text;
begin
  v_oid := to_regclass(c_tbl);

  -- ----------------------------------------------------------
  -- [1] 테이블 부재 — 저장소 baseline 에는 이 테이블이 없다. no-op.
  -- ----------------------------------------------------------
  if v_oid is null then
    raise notice '0071: % not present — nothing to do', c_tbl;
    return;
  end if;

  select c.relkind, pg_get_userbyid(c.relowner) into v_relkind, v_owner
    from pg_class c where c.oid = v_oid;

  if v_relkind <> 'r' then
    raise exception 'MT_LOCKDOWN_NOT_A_TABLE: % has relkind=%', c_tbl, v_relkind;
  end if;

  -- ----------------------------------------------------------
  -- [2] 적용 전 policy 계약 검증
  -- ----------------------------------------------------------
  select count(*) into v_npol
    from pg_policies where schemaname = 'public' and tablename = 'member_timeline';

  -- 예상 정의에서 벗어나는 policy 를 전부 모은다.
  select string_agg(
           policyname || '|cmd=' || cmd || '|perm=' || permissive
           || '|roles=' || roles::text
           || '|using=' || coalesce(qual, '(null)')
           || '|check=' || coalesce(with_check, '(null)'), ' ## ' order by policyname)
    into v_bad
    from pg_policies
   where schemaname = 'public' and tablename = 'member_timeline'
     and not (
       policyname = c_policy
       and cmd = 'SELECT'
       and permissive = 'PERMISSIVE'
       and roles::text = '{public}'
       and qual = 'true'
       and with_check is null
     );

  if v_bad is not null then
    raise exception 'MT_LOCKDOWN_UNEXPECTED_POLICY: % has policies outside the expected contract. found=%',
      c_tbl, v_bad;
  end if;

  if v_npol > 1 then
    raise exception 'MT_LOCKDOWN_UNEXPECTED_POLICY: expected at most 1 policy, found %', v_npol;
  end if;

  -- 기준선 저장 — service_role 과 owner 권한은 이 migration 이 건드리지 않는다.
  select string_agg(p || '=' || has_table_privilege('service_role', c_tbl, p)::text, ' ')
    into v_svc_before
    from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

  select string_agg(p || '=' || has_table_privilege(v_owner, c_tbl, p)::text, ' ')
    into v_own_before
    from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

  execute format('select count(*) from %s', c_tbl) into v_rows;

  -- ----------------------------------------------------------
  -- [3] 권한 회수 + policy 제거
  -- ----------------------------------------------------------
  execute format('revoke all privileges on table %s from public, anon, authenticated', c_tbl);
  execute format('drop policy if exists %I on %s', c_policy, c_tbl);

  raise notice '0071: revoked public/anon/authenticated privileges on % and dropped % (rows=%)',
    c_tbl, c_policy, v_rows;

  -- ----------------------------------------------------------
  -- [4] postcondition
  -- ----------------------------------------------------------
  if not (select c.relrowsecurity from pg_class c where c.oid = v_oid) then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: row level security must stay enabled';
  end if;

  if (select c.relforcerowsecurity from pg_class c where c.oid = v_oid) then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: force row level security must stay off';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_timeline') then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: policies still present';
  end if;

  if exists (
    select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
     where has_table_privilege('anon', c_tbl, p)
        or has_table_privilege('authenticated', c_tbl, p)
  ) then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: anon/authenticated still hold privileges';
  end if;

  -- PUBLIC 에 남은 권한은 anon/authenticated 를 통해서도 보이지만 직접 확인한다.
  if (select count(*) from aclexplode(coalesce((select c.relacl from pg_class c where c.oid = v_oid), '{}'))
       where grantee = 0) > 0 then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: PUBLIC still holds privileges';
  end if;

  select string_agg(p || '=' || has_table_privilege('service_role', c_tbl, p)::text, ' ')
    into v_svc_after
    from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

  if v_svc_after is distinct from v_svc_before then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: service_role privileges changed. before=% after=%',
      v_svc_before, v_svc_after;
  end if;

  select string_agg(p || '=' || has_table_privilege(v_owner, c_tbl, p)::text, ' ')
    into v_own_after
    from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;

  if v_own_after is distinct from v_own_before then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: owner privileges changed. before=% after=%',
      v_own_before, v_own_after;
  end if;

  if pg_get_userbyid((select c.relowner from pg_class c where c.oid = v_oid)) is distinct from v_owner then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: owner changed';
  end if;

  execute format('select count(*) from %s', c_tbl) into v_hash;
  if v_hash::bigint is distinct from v_rows then
    raise exception 'MT_LOCKDOWN_POSTCONDITION_FAILED: row count changed from % to %', v_rows, v_hash;
  end if;
end
$$;

-- 권한/정책 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
-- 되돌리면 anon 이 다시 전체 타임라인을 직접 읽을 수 있게 된다.
-- 코드 소비처는 전부 service_role 경유이므로 정상 운영에는 필요 없다.
--
--   begin;
--   grant select, insert, update, delete on table public.member_timeline
--     to anon, authenticated;
--   create policy member_timeline_select_all on public.member_timeline
--     for select using (true);
--   notify pgrst, 'reload schema';
--   commit;
-- ============================================================
