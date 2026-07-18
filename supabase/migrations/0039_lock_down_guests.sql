-- ============================================================
-- 0039: guests/guest_stats 최종 잠금 (guests P0 Phase 4)
--
-- 전제조건(Phase 1~3 완료 확인):
--   - guest_stats 앱 쿼리 의존 0건 (get_public_guest_list RPC로 대체 완료)
--   - members!guests_referred_by_fkey / members!guests_converted_to_member_id_fkey
--     embed 0건
--   - Admin/Public read 전부 service-role 또는 get_public_guest_list RPC 경유
--   - MATCH_SELECT_WITH_PLAYERS(guests!matches_team_*_guest_fkey 임베드)
--     소비처 전수 service-role 확인
--   - task_138d9ede(admin matches 회귀) 해결 완료
--
-- get_public_guest_list RPC(0038)는 SECURITY DEFINER로 자체 권한을 가지므로
-- 이 migration의 영향을 받지 않는다 — 여기서 손대지 않는다.
-- write 정책(anon insert/update)은 0023에서 이미 제거됐고 여기서 복구하지 않는다.
-- ============================================================

drop policy if exists "guests_select_all" on public.guests;

revoke all on table public.guests from public, anon, authenticated;

revoke all on table public.guest_stats from public, anon, authenticated;

drop view if exists public.guest_stats;

-- ============================================================
-- ROLLBACK — 긴급 복구용. 실행 전 별도 승인 필요.
-- 이 rollback은 guests의 phone/notes/referred_by 등 PII를
-- anon/authenticated에 다시 노출시킨다. 사고 대응 목적 외 실행 금지.
-- ============================================================
-- create view public.guest_stats as
-- select
--   g.*,
--   case
--     when (g.wins + g.losses) = 0 then 0
--     else round((g.wins::numeric / (g.wins + g.losses)) * 100, 1)
--   end as win_rate
-- from public.guests g;
--
-- create policy "guests_select_all"
-- on public.guests
-- for select
-- using (true);
--
-- grant select on public.guests to anon, authenticated;
-- grant select on public.guest_stats to anon, authenticated;
