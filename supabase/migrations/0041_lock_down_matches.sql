-- ============================================================
-- 0041: matches 최종 잠금 (matches P0 Phase 4)
--
-- 전제조건(Phase 1~3 완료 확인):
--   - Client direct matches read 0건 — Public 화면(/matches/history,
--     /(public)/c/[slug]/*, /(public)/matches)은 전부 /api/matches/public,
--     /api/matches/[id]/edit-detail 경유로 전환 완료.
--   - Admin Server(page.tsx 등)의 matches read 전부 createServiceClient()로
--     전환 완료 — anon-role(createClient) 의존 0건(app/admin/page.tsx 포함
--     전수 재확인).
--   - matches raw table의 앱 의존 0건 확인(Phase 4 grep + 실측).
--
-- attendance_sessions/members/guests 등 다른 테이블은 이번 잠금 대상이 아니다.
-- matches 데이터/컬럼/제약은 변경하지 않는다. service_role/postgres 권한도
-- 변경하지 않는다.
-- ============================================================

begin;

drop policy if exists "matches_select_all"
on public.matches;

revoke all privileges
on table public.matches
from public, anon, authenticated;

commit;

-- ROLLBACK (긴급 기능 복구용 — 실제 장애 확인 후에만, 별도 승인 거쳐 실행):
--
-- begin;
--
-- grant select
-- on public.matches
-- to anon, authenticated;
--
-- create policy "matches_select_all"
-- on public.matches
-- for select
-- to public
-- using (true);
--
-- commit;
--
-- 참고:
-- 이 rollback은 경기 참가자 raw member/guest UUID를 포함한 matches 전체를
-- 다시 anon/authenticated에 노출시킨다 — 사고 대응 목적 외 실행 금지.
