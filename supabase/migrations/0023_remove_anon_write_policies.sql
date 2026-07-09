-- ============================================================
-- 0023: anon write 정책 제거
--
-- 배경:
--   0001_init.sql에서 "회원 로그인이 없으므로 누구나(anon) 체크할 수 있게"
--   attendance 테이블에 anon insert/update 정책을 만들었다.
--   0003_match_guests_tiebreak.sql에서 운영진 화면 진입 전에 미들웨어가
--   세션을 확인한다는 전제로 guests 테이블에도 anon insert/update를 열었다.
--
-- 현재 상태:
--   카카오 로그인 도입 이후, attendance/guests 쓰기 경로는 모두
--   API Route(service-role 클라이언트)로 통일됐다.
--   - app/api/member/attendance/route.ts   : createServiceClient()
--   - app/api/attendance/admin-update/route.ts : createServiceClient()
--   - app/api/attendance-sessions/*        : createServiceClient()
--   - app/api/guests/*                     : createServiceClient()
--   service_role은 RLS를 bypass하므로 아래 정책 제거 후에도
--   기존 API 동작은 전혀 영향을 받지 않는다.
--
-- 목적:
--   anon key를 가진 외부 클라이언트가 REST API를 직접 호출해
--   attendance/guests 행을 임의 삽입·수정하는 경로를 차단한다.
-- ============================================================

-- attendance: anon write 차단
drop policy if exists "attendance_insert_anon" on attendance;
drop policy if exists "attendance_update_anon" on attendance;

-- guests: anon write 차단
drop policy if exists "guests_insert_anon" on guests;
drop policy if exists "guests_update_anon" on guests;

-- ============================================================
-- ROLLBACK (필요 시 아래 두 블록을 그대로 실행)
-- ============================================================
-- create policy "attendance_insert_anon" on attendance for insert with check (true);
-- create policy "attendance_update_anon" on attendance for update using (true);
--
-- create policy "guests_insert_anon" on guests for insert with check (true);
-- create policy "guests_update_anon" on guests for update using (true);
