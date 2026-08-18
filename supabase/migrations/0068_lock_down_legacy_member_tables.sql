-- ============================================================
-- 0068: legacy member 테이블 권한 잠금 (Phase 2A-8E-0B)
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- 2A-8E-0A의 Production 스키마 드리프트 조사에서 P0 두 건이 확인됐다.
--
-- [1] public.club_members
--     RLS = false, PK/FK/CHECK/index/policy/trigger 전무(con=0, idx=0),
--     ACL = {postgres, service_role, anon, authenticated} 모두 arwdDxtm.
--     즉 anon 키만으로 SELECT/INSERT/UPDATE/DELETE/TRUNCATE가 가능했다.
--     이 테이블은 저장소 migration이 만든 적이 없고(재생 DB에는 존재하지 않는다)
--     Studio에서 수동 생성된 것으로 추정된다.
--     의존 관계 0건(pg_depend deptype='n'), 함수 본문 참조 0건,
--     앱 코드 참조 0건이므로 권한을 회수해도 깨지는 경로가 없다.
--
-- [2] public.members의 members_insert_anon / members_update_anon
--     roles = {public}인 INSERT/UPDATE policy가 Production에만 남아 있다.
--     0037이 members의 anon/authenticated grant를 회수했기 때문에 현재는
--     effective INSERT/UPDATE가 false라 실행되지 않지만, 누군가 grant를
--     되살리면 즉시 열리는 latent write policy다. 저장소에는 없다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] club_members에서 PUBLIC / anon / authenticated 권한 회수
--   [2] club_members RLS 활성화 (policy가 없으므로 default deny)
--   [3] members의 anon write policy 2개 제거
--
-- club_members는 저장소 재생 DB에 존재하지 않으므로 to_regclass로 존재를
-- 확인한 뒤에만 실행한다. REVOKE는 IF EXISTS를 지원하지 않아 DO 블록이 필요하다.
--
-- ------------------------------------------------------------
-- 건드리지 않는 것
-- ------------------------------------------------------------
--   postgres / service_role 권한 (그대로 유지 — 앱은 service_role로만 접근한다)
--   FORCE ROW LEVEL SECURITY (사용하지 않는다)
--   club_members의 policy (새로 만들지 않는다 — 없어야 default deny다)
--   club_members의 테이블·컬럼·constraint·index (변경 0건, DROP TABLE 0건)
--   members의 다른 policy·RLS·ACL·컬럼·constraint
--   member_timeline (RLS on + SELECT policy만 존재하는 판정 A 상태.
--     앱은 전부 service_role로 접근하므로 anon grant는 불필요하지만,
--     소비처 6곳을 확인한 뒤 별도 Phase에서 최소 권한으로 정리한다.)
--   사용자 데이터 (DML 0건, backfill 0건)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- [1][2] club_members — 권한 회수 + RLS 활성화
-- ------------------------------------------------------------
-- 저장소 재생 DB에는 이 테이블이 없다. 없으면 조용히 건너뛴다.
do $$
begin
  if to_regclass('public.club_members') is not null then
    execute 'revoke all privileges on table public.club_members from public, anon, authenticated';
    execute 'alter table public.club_members enable row level security';
  end if;
end
$$;

-- ------------------------------------------------------------
-- [3] members — Production에만 남은 anon write policy 제거
-- ------------------------------------------------------------
-- 저장소에는 없는 정책이므로 재생 DB에서는 IF EXISTS로 no-op이 된다.
drop policy if exists members_insert_anon on public.members;
drop policy if exists members_update_anon on public.members;

-- PostgREST 스키마 캐시 갱신 — 권한·RLS가 바뀌었으므로 필수.
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
-- 아래는 anon/authenticated에 club_members 전권을 되돌려주고 RLS를 끈다.
-- 그 자체가 이 migration이 막으려던 위험이므로 사고 대응 외 실행 금지.
-- ============================================================
-- begin;
-- alter table public.club_members disable row level security;
-- grant all privileges on table public.club_members to anon, authenticated;
-- create policy members_insert_anon on public.members for insert with check (true);
-- create policy members_update_anon on public.members for update using (true);
-- notify pgrst, 'reload schema';
-- commit;
