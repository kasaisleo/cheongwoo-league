-- ============================================================
-- 0069: pending_link_requests Production 복구 (Phase 2A-8E-1A)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 2A-8E-0C의 스키마 드리프트 조사에서 확인된 D5 항목이다.
--   저장소 재생 DB : pending_link_requests 존재 (0030이 생성)
--   Production     : 부재
-- 그런데 런타임 코드 4곳이 이 테이블을 실제로 사용한다.
--   app/(public)/auth/callback/route.ts  카카오 로그인 후 pending row upsert
--   app/admin/page.tsx                   Admin 대시보드 pending count/대조
--   app/api/auth/link-member/route.ts    연결 완료 후 row 삭제
--   app/admin/auth-link/AuthLinkPageClient.tsx  (API 경유, 직접 접근 없음)
-- callback은 upsert 오류를 확인하지 않으므로 로그인 자체는 진행되지만
-- pending row가 만들어지지 않아 "카카오 연결 대기" 기능이 동작하지 않는다.
--
-- ------------------------------------------------------------
-- 정본
-- ------------------------------------------------------------
-- 0030_pending_link_requests.sql의 정의를 그대로 복원한다. 추정하지 않는다.
--   id           uuid        primary key default gen_random_uuid()
--   auth_user_id uuid        not null
--   club_id      uuid        not null references clubs(id) on delete cascade
--   display_name text                       (카카오 표시명만, 이메일 저장 금지)
--   created_at   timestamptz not null default now()
--   updated_at   timestamptz not null default now()
--   unique (auth_user_id, club_id)
--   index idx_pending_link_requests_club (club_id, created_at desc)
--   RLS enabled, policy 없음 → service_role 전용
--   auth.users FK 없음(의도적 — cascade 복잡성 회피)
--   trigger 없음 — updated_at은 앱이 upsert에서 갱신한다
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] dependency 검증 (clubs)
--   [2] 테이블이 없으면 0030 계약 그대로 생성, 있으면 계약 검증
--       — 불완전한 기존 객체는 조용히 덮어쓰지 않고 명시적 예외로 중단한다.
--         CREATE TABLE IF NOT EXISTS만 쓰면 잘못된 스키마도 성공 처리되므로
--         그 방식은 쓰지 않는다.
--   [3] 보안 계약 강제 — PUBLIC/anon/authenticated 권한 회수 + RLS 활성화
--       Supabase는 public 스키마 신규 테이블에 default privilege로
--       anon/authenticated 권한을 부여할 수 있다. 생성 직후 반드시 회수한다.
--   [4] postcondition 검증
--
-- 건드리지 않는 것: 기존 0001~0068, 사용자 데이터(DML 0건), 다른 객체.
-- DROP TABLE 0건, CASCADE 0건, PUBLIC/anon/authenticated grant 0건.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- [1][2] dependency 검증 + 생성 또는 계약 검증
-- ------------------------------------------------------------
do $$
declare
  v_oid  oid;
  v_sig  text;
  c_sig  constant text :=
    'id|uuid|t|gen_random_uuid(),'
    'auth_user_id|uuid|t|-,'
    'club_id|uuid|t|-,'
    'display_name|text|f|-,'
    'created_at|timestamp with time zone|t|now(),'
    'updated_at|timestamp with time zone|t|now()';
begin
  if to_regclass('public.clubs') is null then
    raise exception 'PLR_DEPENDENCY_MISSING: public.clubs not found';
  end if;

  -- 같은 이름의 다른 객체(View / sequence / type)가 있으면 즉시 중단한다.
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pending_link_requests' and c.relkind <> 'r'
  ) then
    raise exception 'PLR_NAME_CONFLICT: public.pending_link_requests exists but is not a table';
  end if;

  v_oid := to_regclass('public.pending_link_requests');

  if v_oid is null then
    -- 0030 정본 그대로 생성
    create table public.pending_link_requests (
      id           uuid        primary key default gen_random_uuid(),
      auth_user_id uuid        not null,
      club_id      uuid        not null references public.clubs(id) on delete cascade,
      display_name text,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      unique (auth_user_id, club_id)
    );

    create index idx_pending_link_requests_club
      on public.pending_link_requests (club_id, created_at desc);

    raise notice '0069: public.pending_link_requests created from the 0030 contract';
  else
    -- 이미 존재한다면 0030 계약과 정확히 같은지 검증한다.
    select string_agg(
             a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|'
             || case when a.attnotnull then 't' else 'f' end || '|'
             || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), ',' order by a.attnum)
      into v_sig
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = v_oid and a.attnum > 0 and not a.attisdropped;

    if v_sig is distinct from c_sig then
      raise exception 'PLR_SCHEMA_MISMATCH: columns differ from the 0030 contract. found=%', v_sig;
    end if;

    if not exists (select 1 from pg_constraint where conrelid = v_oid and contype = 'p') then
      raise exception 'PLR_SCHEMA_MISMATCH: primary key missing';
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_oid and contype = 'u'
        and pg_get_constraintdef(oid) = 'UNIQUE (auth_user_id, club_id)'
    ) then
      raise exception 'PLR_SCHEMA_MISMATCH: UNIQUE (auth_user_id, club_id) missing';
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = v_oid and contype = 'f'
        and pg_get_constraintdef(oid)
            = 'FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE'
    ) then
      raise exception 'PLR_SCHEMA_MISMATCH: club_id FK to clubs(id) ON DELETE CASCADE missing';
    end if;

    if not exists (
      select 1 from pg_index i join pg_class ci on ci.oid = i.indexrelid
      where i.indrelid = v_oid and ci.relname = 'idx_pending_link_requests_club'
    ) then
      raise exception 'PLR_SCHEMA_MISMATCH: idx_pending_link_requests_club missing';
    end if;

    raise notice '0069: existing public.pending_link_requests matches the 0030 contract';
  end if;
end
$$;

-- ------------------------------------------------------------
-- [3] 보안 계약 — service_role 전용
-- ------------------------------------------------------------
-- 0030은 grant를 명시하지 않았고 policy도 만들지 않았다(service_role 전용 설계).
-- Supabase의 default privilege가 신규 테이블에 anon/authenticated 권한을 줄 수
-- 있으므로 여기서 명시적으로 회수한다. policy를 만들지 않으므로 RLS 아래에서
-- anon/authenticated는 default deny다. FORCE ROW LEVEL SECURITY는 쓰지 않는다.
revoke all privileges on table public.pending_link_requests from public, anon, authenticated;
alter table public.pending_link_requests enable row level security;

-- ------------------------------------------------------------
-- [4] postcondition
-- ------------------------------------------------------------
do $$
declare
  v_oid oid := to_regclass('public.pending_link_requests');
begin
  if v_oid is null then
    raise exception 'PLR_POSTCONDITION_FAILED: table missing after migration';
  end if;

  if not (select c.relrowsecurity from pg_class c where c.oid = v_oid) then
    raise exception 'PLR_POSTCONDITION_FAILED: row level security not enabled';
  end if;

  if (select c.relforcerowsecurity from pg_class c where c.oid = v_oid) then
    raise exception 'PLR_POSTCONDITION_FAILED: force row level security must stay off';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pending_link_requests') then
    raise exception 'PLR_POSTCONDITION_FAILED: no policy expected (service_role only)';
  end if;

  if has_table_privilege('anon', v_oid, 'SELECT') or has_table_privilege('anon', v_oid, 'INSERT')
     or has_table_privilege('anon', v_oid, 'UPDATE') or has_table_privilege('anon', v_oid, 'DELETE')
     or has_table_privilege('authenticated', v_oid, 'SELECT') or has_table_privilege('authenticated', v_oid, 'INSERT')
     or has_table_privilege('authenticated', v_oid, 'UPDATE') or has_table_privilege('authenticated', v_oid, 'DELETE') then
    raise exception 'PLR_POSTCONDITION_FAILED: anon/authenticated still hold privileges';
  end if;
end
$$;

-- PostgREST 스키마 캐시 갱신 — 테이블이 새로 생겼으므로 필수.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
-- 이 테이블을 지우면 카카오 연결 대기 기능이 다시 동작하지 않는다.
-- ============================================================
-- begin;
-- drop table if exists public.pending_link_requests;
-- notify pgrst, 'reload schema';
-- commit;
