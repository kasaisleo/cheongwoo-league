-- ============================================================
-- 0042: rating_history 최종 잠금 (rating_history P0 Phase 2 — 즉시 잠금)
--
-- 전제조건(Phase 1 조사 완료 확인):
--   - rating_history는 0001에서 생성된 ELO 레이팅 시스템의 이력 테이블이며,
--     0004에서 도입된 point_history(LP 시스템)로 대체된 레거시 테이블이다
--     (members.rating/members.grade와 동일하게 deprecated).
--   - 앱 코드 전수 검색 결과 read/write 참조 0건 — lib/match-engine.ts의
--     applyMatch()/rollbackMatch()는 point_history만 갱신하고 rating_history는
--     전혀 참조하지 않는다. lib/supabase/database.types.ts의 타입 선언 외에는
--     리포지토리 어디에서도 이 테이블을 쿼리하지 않는다.
--   - 데이터 0건(anon/service-role 공통 실측 확인).
--   - Studio 스냅샷 확인 결과 rating_history_select_all(roles={public},
--     using(true)) 존재, RLS enabled=true/force=false, anon/authenticated에
--     SELECT뿐 아니라 DELETE/INSERT/REFERENCES/TRIGGER/TRUNCATE/UPDATE까지
--     broad grant가 남아있음이 확인되어 전체 revoke가 필요하다.
--
-- Public/Admin 어떤 화면도 rating_history를 읽지 않으므로 이번 잠금으로 인한
-- 기능 영향은 없다. matches/point_history 등 다른 테이블은 이 migration의
-- 대상이 아니다.
-- ============================================================

begin;

drop policy if exists "rating_history_select_all"
on public.rating_history;

revoke all privileges
on table public.rating_history
from public, anon, authenticated;

commit;

-- ROLLBACK (긴급 기능 복구용 — 실제 장애 확인 후에만, 별도 승인 거쳐 실행):
--
-- begin;
--
-- grant select
-- on table public.rating_history
-- to anon, authenticated;
--
-- create policy "rating_history_select_all"
-- on public.rating_history
-- for select
-- to public
-- using (true);
--
-- commit;
--
-- 참고:
-- rating_history는 앱 코드에서 전혀 사용되지 않으므로 이 rollback이 실제로
-- 필요할 상황은 없을 것으로 예상된다 — 사고 대응 목적 외 실행 금지.
