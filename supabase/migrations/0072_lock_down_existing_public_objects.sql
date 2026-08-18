-- ============================================================
-- 0072: 민감 public 객체 최소 권한 적용 (Phase 2A-8E-2D)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 2A-8E-2A/2C 조사에서 확인된 latent grant 정리다.
--
-- Supabase 플랫폼의 default privileges 가 public 스키마의 신규 table 에
-- anon / authenticated 전권(arwdDxtm)을 자동 부여한다. 그 결과 아래 객체들은
-- 코드가 한 번도 anon 으로 접근하지 않는데도 권한만 남아 있다.
--
--   platform_admins          password_hash 보유
--   platform_admin_sessions  token_hash 보유
--   club_admin_audit_logs    운영진 권한 변경 감사 기록
--   staging_members          CSV import 원본 개인정보(전화/주소/생년)
--   platform_audit_logs      플랫폼 감사 기록
--   point_history_sequence_no_seq  point_history.sequence_no identity sequence
--
-- 지금은 RLS 가 실제 접근을 막고 있어 노출 사고는 없다(sequence 는 RLS 가
-- 적용되지 않지만 PostgREST 가 sequence 를 라우팅하지 않고, anon 이 실행할 수
-- 있는 함수 중 이 sequence 를 건드리는 것도 없다). 그러나 RLS 가 꺼지거나
-- policy 가 잘못 추가되는 순간 자격증명 해시와 개인정보가 바로 열린다.
-- 권한 자체를 없애 그 경로를 봉인한다.
--
-- 소비처는 전부 service_role 이다(2A-8E-2C 전수 조사).
--   platform_*  / staging_members : createServiceClient() 전용
--   club_admin_audit_logs         : SECURITY DEFINER RPC 내부에서만 기록
--   point_history                 : SECURITY DEFINER 함수 내부에서만 INSERT
-- SECURITY DEFINER 함수는 owner(postgres) 권한으로 실행되므로 호출자의 테이블·
-- sequence 권한에 의존하지 않는다. 따라서 회수해도 모든 정상 경로가 동작한다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] 필수 role 존재 확인 (PUBLIC 은 pseudo-role 이라 검사 대상이 아니다)
--   [2] 대상 table 5개: 구조 계약 검증 후 PUBLIC/anon/authenticated 권한 회수
--   [3] 대상 sequence 1개: 동일
--   [4] postcondition
--
-- 검증에서 예상 외 상태(owner/RLS/policy/service_role 권한)가 나오면 조용히
-- 덮어쓰지 않고 예외를 던져 트랜잭션 전체를 rollback 한다.
--
-- 건드리지 않는 것:
--   service_role 권한, owner 권한, RLS enabled/forced, 모든 기존 policy,
--   데이터(DML 0건), 컬럼/제약/인덱스, sequence 값·소유관계·identity,
--   함수 ACL, default privileges, 스키마 USAGE, 그리고 이번 대상이 아닌
--   모든 relation 의 ACL.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  -- 대상은 정확히 이 6개다.
  c_tables constant text[] := array[
    'platform_admins',
    'platform_admin_sessions',
    'club_admin_audit_logs',
    'staging_members',
    'platform_audit_logs'
  ];
  c_seq    constant text := 'point_history_sequence_no_seq';
  c_privs  constant text[] := array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
  c_sprivs constant text[] := array['USAGE','SELECT','UPDATE'];

  v_role     text;
  v_tbl      text;
  v_oid      oid;
  v_kind     "char";
  v_owner    text;
  v_rls      boolean;
  v_forced   boolean;
  v_npol     int;
  v_bad      text;
  v_svc      text;
  v_svc_after text;
  v_left     text;
  v_skipped  int := 0;
  v_done     int := 0;
  v_deny_before boolean := false;
  v_prod_shaped boolean := false;
begin
  -- 적용 전 deny policy 존재 여부를 기록해 둔다(사후 비교용).
  v_deny_before := exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'platform_audit_logs'
       and cmd = 'ALL' and qual = 'false' and with_check = 'false');

  -- ----------------------------------------------------------
  -- [1] 필수 role — 아래 권한 조회가 role 이름을 참조하므로 가장 먼저 확인한다.
  -- ----------------------------------------------------------
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      raise exception 'LOCKDOWN_MISSING_ROLE: role % does not exist', v_role;
    end if;
  end loop;

  -- 이 환경이 플랫폼 default privileges 로 anon 권한이 붙은 상태인지 판정한다.
  -- Production 이 여기 해당하고, 저장소만 재생한 환경은 해당하지 않는다.
  v_prod_shaped := to_regclass('public.platform_audit_logs') is not null
    and exists (
      select 1 from unnest(array['anon','authenticated']) r
       cross join unnest(c_privs) p
       where has_table_privilege(r, 'public.platform_audit_logs', p));

  -- ----------------------------------------------------------
  -- [2] 대상 table
  -- ----------------------------------------------------------
  foreach v_tbl in array c_tables loop
    v_oid := to_regclass('public.' || v_tbl);

    if v_oid is null then
      -- 저장소 baseline 에는 없는 Production-only 객체가 섞여 있다.
      v_skipped := v_skipped + 1;
      raise notice '0072: public.% not present — skipped', v_tbl;
      continue;
    end if;

    select c.relkind, pg_get_userbyid(c.relowner), c.relrowsecurity, c.relforcerowsecurity
      into v_kind, v_owner, v_rls, v_forced
      from pg_class c where c.oid = v_oid;

    if v_kind <> 'r' then
      raise exception 'LOCKDOWN_NOT_A_TABLE: public.% has relkind=%', v_tbl, v_kind;
    end if;

    if v_owner <> 'postgres' then
      raise exception 'LOCKDOWN_UNEXPECTED_OWNER: public.% is owned by %', v_tbl, v_owner;
    end if;

    if not v_rls then
      raise exception 'LOCKDOWN_RLS_DISABLED: public.% has row level security off', v_tbl;
    end if;

    if v_forced then
      raise exception 'LOCKDOWN_RLS_FORCED: public.% has force row level security on', v_tbl;
    end if;

    -- policy 기대값: platform_audit_logs 만 명시적 deny 1개, 나머지는 0개.
    select count(*) into v_npol
      from pg_policies where schemaname = 'public' and tablename = v_tbl;

    if v_tbl = 'platform_audit_logs' then
      -- Production 에는 전면 차단 policy 가 하나 있다(저장소 migration 산물이 아니라
      -- 운영에서 추가된 방어선). 재생 환경에는 없으므로 0개도 정상으로 본다.
      -- 그 외의 policy 는 permissive 접근을 만들 수 있으므로 예외 처리한다.
      if v_npol > 1 then
        raise exception 'LOCKDOWN_UNEXPECTED_POLICY: public.% expected at most 1 deny policy, found %',
          v_tbl, v_npol;
      end if;

      select string_agg(policyname || '|cmd=' || cmd || '|roles=' || roles::text
                        || '|using=' || coalesce(qual, '(null)')
                        || '|check=' || coalesce(with_check, '(null)'), ' ## ' order by policyname)
        into v_bad
        from pg_policies
       where schemaname = 'public' and tablename = v_tbl
         and not (cmd = 'ALL' and roles::text = '{public}'
                  and qual = 'false' and with_check = 'false');

      if v_bad is not null then
        raise exception 'LOCKDOWN_UNEXPECTED_POLICY: public.% deny policy differs. found=%', v_tbl, v_bad;
      end if;
    else
      if v_npol <> 0 then
        select string_agg(policyname || '|cmd=' || cmd || '|roles=' || roles::text, ' ## ' order by policyname)
          into v_bad
          from pg_policies where schemaname = 'public' and tablename = v_tbl;
        raise exception 'LOCKDOWN_UNEXPECTED_POLICY: public.% expected 0 policies, found %. detail=%',
          v_tbl, v_npol, v_bad;
      end if;
    end if;

    -- service_role 은 이 migration 이 건드리지 않는다.
    select string_agg(p, ',') into v_svc
      from unnest(c_privs) p where has_table_privilege('service_role', v_oid, p);

    -- anon/authenticated 권한이 남아 있다는 것은 플랫폼 default privileges 가
    -- 적용된 환경이라는 뜻이고, 그렇다면 service_role 에도 같은 경로로 권한이
    -- 부여돼 있어야 정상이다. 그 상태에서 service_role 만 없으면 예상 외 상황이다.
    -- 반대로 default privileges 가 없는 재생 환경은 anon/auth 권한도 0 이므로
    -- service_role 부재가 정상이고, 아래 REVOKE 는 멱등한 no-op 이 된다.
    select string_agg(r || ':' || p, ' ') into v_left
      from unnest(array['anon','authenticated']) r
      cross join unnest(c_privs) p
     where has_table_privilege(r, v_oid, p);

    if v_left is not null and v_svc is null then
      raise exception 'LOCKDOWN_SERVICE_ROLE_MISSING: public.% grants % but service_role has none',
        v_tbl, v_left;
    end if;

    -- 이미 일부/전부 회수된 상태도 정상이다. 회수할 것이 하나도 없으면 REVOKE 를
    -- 실행하지 않는다 — 빈 REVOKE 도 relacl 을 NULL 에서 명시 배열로 구체화해
    -- "아무것도 바꾸지 않는다"는 계약을 깨기 때문이다.
    if v_left is not null or exists (select 1 from aclexplode((select c.relacl from pg_class c where c.oid = v_oid)) where grantee = 0)
    then
      execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_tbl);
    end if;

    -- 즉시 확인 — service_role 권한이 함께 사라지지 않았는지 본다.
    select string_agg(p, ',') into v_svc_after
      from unnest(c_privs) p where has_table_privilege('service_role', v_oid, p);

    if v_svc_after is distinct from v_svc then
      raise exception 'LOCKDOWN_SERVICE_ROLE_CHANGED: public.% before=% after=%', v_tbl, v_svc, v_svc_after;
    end if;

    v_done := v_done + 1;
  end loop;

  -- ----------------------------------------------------------
  -- [3] 대상 sequence
  -- ----------------------------------------------------------
  v_oid := to_regclass('public.' || c_seq);

  if v_oid is null then
    v_skipped := v_skipped + 1;
    raise notice '0072: public.% not present — skipped', c_seq;
  else
    select c.relkind, pg_get_userbyid(c.relowner) into v_kind, v_owner
      from pg_class c where c.oid = v_oid;

    if v_kind <> 'S' then
      raise exception 'LOCKDOWN_NOT_A_SEQUENCE: public.% has relkind=%', c_seq, v_kind;
    end if;

    if v_owner <> 'postgres' then
      raise exception 'LOCKDOWN_UNEXPECTED_OWNER: public.% is owned by %', c_seq, v_owner;
    end if;

    select string_agg(p, ',') into v_svc
      from unnest(c_sprivs) p where has_sequence_privilege('service_role', v_oid, p);

    -- table 과 같은 기준이다 — anon/auth 권한이 있는 환경에서만 service_role 을 요구한다.
    select string_agg(r || ':' || p, ' ') into v_left
      from unnest(array['anon','authenticated']) r
      cross join unnest(c_sprivs) p
     where has_sequence_privilege(r, v_oid, p);

    if v_left is not null and v_svc is null then
      raise exception 'LOCKDOWN_SERVICE_ROLE_MISSING: public.% grants % but service_role has none',
        c_seq, v_left;
    end if;

    -- 값(last_value)과 소유관계·identity 는 읽지도 바꾸지도 않는다.
    if v_left is not null or exists (select 1 from aclexplode((select c.relacl from pg_class c where c.oid = v_oid)) where grantee = 0)
    then
      execute format('revoke all privileges on sequence public.%I from public, anon, authenticated', c_seq);
    end if;

    select string_agg(p, ',') into v_svc_after
      from unnest(c_sprivs) p where has_sequence_privilege('service_role', v_oid, p);

    if v_svc_after is distinct from v_svc then
      raise exception 'LOCKDOWN_SERVICE_ROLE_CHANGED: public.% before=% after=%', c_seq, v_svc, v_svc_after;
    end if;

    v_done := v_done + 1;
  end if;

  -- ----------------------------------------------------------
  -- [4] postcondition
  -- ----------------------------------------------------------
  foreach v_tbl in array c_tables loop
    v_oid := to_regclass('public.' || v_tbl);
    continue when v_oid is null;

    select string_agg(r || ':' || p, ' ') into v_left
      from unnest(array['anon','authenticated']) r
      cross join unnest(c_privs) p
     where has_table_privilege(r, v_oid, p);

    if v_left is not null then
      raise exception 'LOCKDOWN_POSTCONDITION_FAILED: public.% still grants %', v_tbl, v_left;
    end if;

    if exists (select 1 from aclexplode((select c.relacl from pg_class c where c.oid = v_oid)) where grantee = 0) then
      raise exception 'LOCKDOWN_POSTCONDITION_FAILED: public.% still grants PUBLIC', v_tbl;
    end if;

    if not (select c.relrowsecurity from pg_class c where c.oid = v_oid) then
      raise exception 'LOCKDOWN_POSTCONDITION_FAILED: public.% lost row level security', v_tbl;
    end if;
  end loop;

  v_oid := to_regclass('public.' || c_seq);
  if v_oid is not null then
    select string_agg(r || ':' || p, ' ') into v_left
      from unnest(array['anon','authenticated']) r
      cross join unnest(c_sprivs) p
     where has_sequence_privilege(r, v_oid, p);

    if v_left is not null then
      raise exception 'LOCKDOWN_POSTCONDITION_FAILED: public.% still grants %', c_seq, v_left;
    end if;

    if exists (select 1 from aclexplode((select c.relacl from pg_class c where c.oid = v_oid)) where grantee = 0) then
      raise exception 'LOCKDOWN_POSTCONDITION_FAILED: public.% still grants PUBLIC', c_seq;
    end if;
  end if;

  -- Production 상태(플랫폼 default privileges 로 anon 권한이 붙어 있던 환경)에서는
  -- 이 방어선이 반드시 있어야 한다. 적용 전에 anon 권한이 하나도 없던 재생 환경은
  -- deny policy 도 없는 것이 정상이므로 요구하지 않는다.
  if v_prod_shaped and not v_deny_before then
    raise exception 'LOCKDOWN_UNEXPECTED_POLICY: platform_audit_logs deny policy missing in a granted environment';
  end if;

  -- deny policy 가 있던 환경에서는 그대로 남아 있어야 한다(이 migration 은 policy 를
  -- 만들지도 지우지도 않으므로, 사라졌다면 무언가 잘못된 것이다).
  if v_deny_before and not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'platform_audit_logs'
          and cmd = 'ALL' and qual = 'false' and with_check = 'false')
  then
    raise exception 'LOCKDOWN_POSTCONDITION_FAILED: platform_audit_logs deny policy disappeared';
  end if;

  raise notice '0072: locked down % object(s), skipped % absent object(s)', v_done, v_skipped;
end
$$;

-- 권한 변경을 PostgREST 스키마 캐시에 반영한다.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
-- 되돌리면 자격증명 해시·세션 토큰·개인정보가 담긴 테이블에 anon/authenticated
-- 권한이 다시 붙는다. 코드 소비처는 전부 service_role 이므로 정상 운영에는
-- 필요 없다. 아래는 원래 상태(플랫폼 default privileges 가 부여하던 전권)를
-- 재현하는 문장이다.
--
--   begin;
--   grant all privileges on table public.platform_admins,
--     public.platform_admin_sessions, public.club_admin_audit_logs,
--     public.staging_members, public.platform_audit_logs
--     to anon, authenticated;
--   grant usage, select, update on sequence public.point_history_sequence_no_seq
--     to anon, authenticated;
--   notify pgrst, 'reload schema';
--   commit;
-- ============================================================
