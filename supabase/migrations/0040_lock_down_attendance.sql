-- ============================================================
-- 0040: attendance 최종 잠금 (attendance P0 Phase 4)
--
-- 전제조건(Phase 1~3 완료 확인):
--   - Client direct attendance read/write 0건 — Public/Admin attendance
--     화면 전부 /api/attendance/{roster,public-sessions}, /api/member/attendance,
--     /api/attendance/admin-update 경유로 전환 완료.
--   - Admin Server(page.tsx)의 attendance/attendance_sessions read 전부
--     createServiceClient()로 전환 완료 — anon-role(createClient) 의존 0건.
--   - attendance raw table의 앱 의존 0건 확인(Phase 3 grep + 실측).
--
-- attendance_sessions는 이번 잠금 대상이 아니다 — attendance_sessions_select_all
-- 정책과 관련 anon/authenticated ACL은 그대로 유지한다. Public 세션 메타데이터는
-- 여전히 익명 공개 정보로 취급하며(public-sessions API도 이 select_all 정책에
-- 의존), Group B 소비처(app/(public)/c/[slug]/page.tsx 등 4곳)가 아직
-- service-role로 전환되지 않은 상태이므로 여기서 손대면 즉시 Public 회귀가
-- 발생한다.
--
-- write 정책(anon insert/update)은 0023에서 이미 제거됐고 여기서 복구하지 않는다.
-- ============================================================

begin;

drop policy if exists "attendance_select_all"
on public.attendance;

revoke all privileges
on table public.attendance
from public, anon, authenticated;

commit;

-- ROLLBACK (긴급 기능 복구용 — 실제 장애 확인 후에만, 별도 승인 거쳐 실행):
--
-- begin;
--
-- grant select
-- on public.attendance
-- to anon, authenticated;
--
-- create policy "attendance_select_all"
-- on public.attendance
-- for select
-- using (true);
--
-- commit;
--
-- 참고:
-- 이 rollback은 회원별 출석 상태(attendance) 전체를 다시 anon/authenticated에
-- 노출시킨다 — 사고 대응 목적 외 실행 금지. INSERT/UPDATE/DELETE grant는
-- 여기서 복구하지 않는다(0023에서 이미 의도적으로 제거된 상태).
