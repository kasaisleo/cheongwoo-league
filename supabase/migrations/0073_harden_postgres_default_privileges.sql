-- ============================================================
-- 0073: public 스키마 신규 객체 기본 권한 하드닝 (Phase 2A-8E-2E)
--
-- New public tables and sequences created by postgres are private by default.
-- Client access requires an explicit GRANT and an appropriate RLS policy.
--
-- supabase_admin defaults are not changed because the postgres migration role
-- cannot alter that role's defaults. All current application objects in public
-- are owned by postgres.
--
-- 바꾸는 것: postgres 의 public 스키마 table / sequence 기본 권한에서
--            anon / authenticated 제거.
-- 바꾸지 않는 것: service_role·owner 기본 권한, function 기본 권한,
--            기존 객체 ACL, 스키마 USAGE, RLS/policy, 데이터,
--            supabase_admin 및 다른 스키마의 기본 권한.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 사전 검증 — 실행 권한과 필수 grantee role 확인.
do $$
declare
  v_role text;
begin
  -- ALTER DEFAULT PRIVILEGES FOR ROLE postgres 는 postgres 본인이거나
  -- 그 role 의 멤버만 실행할 수 있다.
  if not pg_has_role(current_user, 'postgres', 'USAGE') then
    raise exception 'DEFACL_NO_PRIVILEGE: % cannot alter default privileges for role postgres',
      current_user;
  end if;

  foreach v_role in array array['anon','authenticated','service_role'] loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      raise exception 'DEFACL_MISSING_ROLE: role % does not exist', v_role;
    end if;
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;

-- 사후 검증.
do $$
declare
  c_types constant text[] := array['r','S'];
  v_type  text;
  v_left  text;
  v_svc   boolean;
  v_owner boolean;
begin
  foreach v_type in array c_types loop
    -- anon / authenticated 가 기본 권한 목록에 남아 있으면 안 된다.
    select string_agg(distinct pg_get_userbyid(a.grantee) || ':' || a.privilege_type, ' ')
      into v_left
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
     where n.nspname = 'public'
       and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
       and d.defaclobjtype = v_type
       and a.grantee in ((select oid from pg_roles where rolname = 'anon'),
                         (select oid from pg_roles where rolname = 'authenticated'));

    if v_left is not null then
      raise exception 'DEFACL_POSTCONDITION_FAILED: postgres/public/% still grants %', v_type, v_left;
    end if;

    -- 기본 권한 행이 있는 환경에서는 service_role 과 owner 몫이 그대로여야 한다.
    -- (행이 아예 없는 재생 환경은 내장 기본값만 쓰므로 검사 대상이 아니다.)
    if exists (
      select 1 from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
       where n.nspname = 'public' and d.defaclobjtype = v_type
         and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
    ) then
      select
        exists (select 1 from pg_default_acl d
                  join pg_namespace n on n.oid = d.defaclnamespace
                  cross join lateral aclexplode(d.defaclacl) a
                 where n.nspname = 'public' and d.defaclobjtype = v_type
                   and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
                   and a.grantee = (select oid from pg_roles where rolname = 'service_role')),
        exists (select 1 from pg_default_acl d
                  join pg_namespace n on n.oid = d.defaclnamespace
                  cross join lateral aclexplode(d.defaclacl) a
                 where n.nspname = 'public' and d.defaclobjtype = v_type
                   and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
                   and a.grantee = (select oid from pg_roles where rolname = 'postgres'))
        into v_svc, v_owner;

      if not v_svc then
        raise exception 'DEFACL_POSTCONDITION_FAILED: postgres/public/% lost service_role default', v_type;
      end if;
      if not v_owner then
        raise exception 'DEFACL_POSTCONDITION_FAILED: postgres/public/% lost owner default', v_type;
      end if;
    end if;
  end loop;

  -- function 기본 권한은 이 migration 의 대상이 아니다. 공개 RPC 4종이 여기에
  -- 의존하므로 anon EXECUTE 가 남아 있어야 정상이다.
  if exists (
    select 1 from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public' and d.defaclobjtype = 'f'
       and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
  ) and not exists (
    select 1 from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
     where n.nspname = 'public' and d.defaclobjtype = 'f'
       and d.defaclrole = (select oid from pg_roles where rolname = 'postgres')
       and a.grantee = (select oid from pg_roles where rolname = 'anon')
  ) then
    raise exception 'DEFACL_POSTCONDITION_FAILED: function defaults were modified';
  end if;

  -- supabase_admin 기본 권한은 손대지 않았음을 확인한다(변경 권한도 없다).
  if not exists (
    select 1 from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
     where n.nspname = 'public' and d.defaclobjtype = 'r'
       and d.defaclrole = (select oid from pg_roles where rolname = 'supabase_admin')
       and a.grantee = (select oid from pg_roles where rolname = 'anon')
  ) and exists (
    select 1 from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public' and d.defaclobjtype = 'r'
       and d.defaclrole = (select oid from pg_roles where rolname = 'supabase_admin')
  ) then
    raise exception 'DEFACL_POSTCONDITION_FAILED: supabase_admin defaults were modified';
  end if;
end
$$;

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
--   begin;
--   alter default privileges for role postgres in schema public
--     grant all privileges on tables to anon, authenticated;
--   alter default privileges for role postgres in schema public
--     grant usage, select, update on sequences to anon, authenticated;
--   commit;
-- ============================================================
