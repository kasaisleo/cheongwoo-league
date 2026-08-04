-- ============================================================
-- 0049: clubs/attendance_sessions/session_guests 기본 권한 잠금
--        + members/guests 복합 unique(club_id, id) 추가
-- (Match System 2.0 Phase 2A-0.5 — 착수 전 선행 보안 패치)
--
-- 배경: Match System 2.0 Phase 2A-0 라이브 스키마 실측 중, clubs/
-- attendance_sessions/session_guests 세 테이블이 Supabase 프로젝트의
-- public 스키마 신규 테이블 default privilege(anon/authenticated/
-- service_role에 자동으로 ALL 부여)를 한 번도 회수(REVOKE)하지 않은
-- 상태로 남아있음을 확인했다. relacl 실측 결과 세 테이블 전부 anon/
-- authenticated/service_role에 arwdDxtm(SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) 전체가 동일하게 부여되어 있었다
-- (PUBLIC pseudo-role에는 별도 ACL 항목 없음 — 원래 없었으므로 이번
-- migration도 PUBLIC에 대한 grant를 추가하지 않는다).
--
-- 특히 clubs는 RLS 자체가 비활성 상태(relrowsecurity=false)였고 정책도
-- 0건이라, anon/authenticated 키만으로 누구나 clubs 테이블 전체를 직접
-- INSERT/UPDATE/DELETE/TRUNCATE할 수 있는 상태였다(P0). 실제 코드 조사
-- 결과 clubs에 대한 쓰기(INSERT/UPDATE)는 저장소 전체에서 전부
-- createServiceClient()(service-role)로만 이루어지고 있어(app/api/
-- platform/clubs/route.ts, app/api/platform/clubs/[id]/route.ts),
-- anon/authenticated의 쓰기 권한 회수는 회귀 위험이 없다.
--
-- attendance_sessions는 RLS/select 정책은 이미 있었으나(공개 메타데이터로
-- 의도적으로 열어둔 것, 0040 참고) INSERT/UPDATE/DELETE/TRUNCATE 등도
-- anon/authenticated에 default로 열려 있었다 — 실제 쓰기는 4개 API
-- (app/api/admin/sessions, attendance-sessions/{weekly,archive,custom})
-- 전부 service-role이므로 동일하게 회수 가능.
--
-- session_guests는 저장소 전체에서 이 테이블을 직접 참조하는 코드가
-- app/api/admin/session-guests/route.ts 단 1개뿔이며 이마저 GET/POST/
-- DELETE 전부 service-role이다. raw anon 직접 소비처가 애초에 존재한
-- 적이 없어(0021 생성 시점부터), guests/members 등과 달리 "safe RPC로
-- 먼저 이관" 단계 없이 SELECT까지 포함해 즉시 완전 잠금한다.
--
-- service_role은 BYPASSRLS로 RLS 정책만 우회할 뿐 GRANT 체계와는
-- 무관하다 — REVOKE ALL ... FROM PUBLIC, anon, authenticated 실행 후
-- service_role의 실제 권한을 추정하지 않고 세 테이블 모두 GRANT ALL
-- PRIVILEGES를 명시적으로 재선언한다(적용 전 실측 결과 이미 보유하고
-- 있었더라도 멱등하며 해가 없다).
--
-- members/guests에 (club_id, id) 복합 unique를 추가하는 이유: 이후
-- Match System 2.0의 신규 도메인 테이블(events 등)이 (참조 id, club_id)
-- 복합 FK로 "참조 대상이 실제로 같은 club 소속인지"를 DB 레벨에서
-- 강제하려면, 참조되는 쪽에 이 복합 unique가 먼저 있어야 한다. id 자체가
-- 이미 PK라 club_id와 무관하게 전역 유일하므로 사전 중복 검사는 항상
-- 0건이어야 하며, 적용 전 실측으로 두 테이블 모두 0건임을 확인했다.
--
-- 이번 migration이 하지 않는 일:
--   - clubs SELECT를 status='active'로 좁히지 않는다 — RLS가 꺼져있던
--     현재 상태(사실상 전체 공개)와 정확히 동일하게 유지해 읽기 쪽 회귀를
--     0으로 만든다(admin/page.tsx, admin/layout.tsx의 status 미필터
--     조회 2곳을 포함해 어떤 기존 읽기 경로도 깨지지 않는다). 읽기 스코프
--     강화는 이번 P0 패치와 분리된 별도 후속 작업이다.
--   - attendance_sessions의 select_all 정책은 무변경(공개 메타데이터로
--     유지하는 기존 결정, 0040 그대로).
--   - session_guests에는 select도 재부여하지 않는다(raw 소비처 0건).
--   - members/guests의 기존 FK/제약은 무변경, 복합 unique만 추가.
--
-- 알려진 한계: clubs 테이블 자체는 생성 migration 파일이 저장소에 없는
-- 기존 gap이다(0011~0019 결번 구간 또는 대시보드 직접 생성으로 추정,
-- 확인 안 됨). 이번 migration은 그 gap 자체를 다루지 않고 현재 라이브
-- 스키마를 대상으로만 권한을 조정한다.
-- ============================================================

begin;

-- ── A. clubs ──────────────────────────────────────────────
alter table public.clubs enable row level security;

create policy "clubs_select_all" on public.clubs
  for select using (true);   -- 현재 동작과 동일(회귀 없음)

revoke all privileges on public.clubs from public, anon, authenticated;
grant select on public.clubs to anon, authenticated;
grant all privileges on public.clubs to service_role;

-- ── B. attendance_sessions ───────────────────────────────
-- RLS는 이미 enabled, attendance_sessions_select_all 정책도 이미 존재(무변경)
revoke all privileges on public.attendance_sessions from public, anon, authenticated;
grant select on public.attendance_sessions to anon, authenticated;
grant all privileges on public.attendance_sessions to service_role;

-- ── C. session_guests — 즉시 완전 잠금 ────────────────────
drop policy if exists "session_guests_select_all" on public.session_guests;
revoke all privileges on public.session_guests from public, anon, authenticated;
grant all privileges on public.session_guests to service_role;

-- ── D. 신규 도메인용 복합 unique (사전 중복 0건 확인 완료) ──
alter table public.members add constraint members_club_id_id_uniq unique (club_id, id);
alter table public.guests add constraint guests_club_id_id_uniq unique (club_id, id);

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- 적용 전 relacl 실측 결과(anon/authenticated/service_role 전부
-- arwdDxtm 동일, PUBLIC에는 별도 ACL 항목 없음, clubs RLS disabled,
-- attendance_sessions/session_guests RLS enabled)를 그대로 재현한다.
-- ============================================================
-- begin;
--
-- alter table public.members drop constraint if exists members_club_id_id_uniq;
-- alter table public.guests drop constraint if exists guests_club_id_id_uniq;
--
-- -- clubs: 적용 전 상태로 정확히 복원(anon/authenticated/service_role
-- -- 전부 ALL PRIVILEGES, RLS disabled)
-- drop policy if exists "clubs_select_all" on public.clubs;
-- grant all privileges on public.clubs to anon, authenticated, service_role;
-- alter table public.clubs disable row level security;
--
-- -- attendance_sessions: 적용 전 상태로 정확히 복원(RLS는 원래도
-- -- enabled였으므로 그대로 유지, attendance_sessions_select_all
-- -- 정책은 이번 migration이 건드리지 않았으므로 rollback 대상 아님)
-- grant all privileges on public.attendance_sessions to anon, authenticated, service_role;
--
-- -- session_guests: 적용 전 상태로 정확히 복원(정책 재생성 + ALL 재부여)
-- create policy "session_guests_select_all" on public.session_guests for select using (true);
-- grant all privileges on public.session_guests to anon, authenticated, service_role;
--
-- commit;
