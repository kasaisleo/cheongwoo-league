-- ============================================================
-- 0044: point_history 최종 잠금 + get_public_point_history(v1) 제거
-- (point_history P0 Phase 3)
--
-- 전제조건(Phase 1~2 완료 확인):
--   - get_public_point_history_v2(0043)가 Public 화면의 유일한 소비 경로로
--     전환 완료 — 코드 전수 검색 결과 v1 호출 0건, canonical QA 통과.
--   - point_history raw table은 정책 0건(0035에서 select_all 삭제)이지만
--     anon/authenticated table-level GRANT는 REVOKE된 적이 없어 soft lock
--     상태였다(rating_history와 동일한 패턴).
--
-- 이번 migration 범위:
--   1) point_history 테이블의 anon/authenticated/public GRANT 전부 회수.
--   2) get_public_point_history(v1) 함수의 EXECUTE 권한 회수 후 함수 자체를
--      제거 — v2로 완전히 대체되어 더 이상 필요하지 않음.
--
-- 절대 건드리지 않는 것:
--   - get_public_point_history_v2(0043) — 정의/EXECUTE grant 모두 무변경,
--     anon/authenticated EXECUTE 계속 유지되어야 Public 화면이 정상 동작한다.
--   - point_history 데이터/컬럼/제약.
--   - point_history 위에 새 정책을 추가하지 않는다(raw 접근은 앞으로도 없음).
--   - service_role/postgres 권한.
-- ============================================================

begin;

revoke all privileges
on table public.point_history
from public, anon, authenticated;

revoke all privileges
on function public.get_public_point_history(uuid, uuid, boolean)
from public, anon, authenticated;

drop function if exists public.get_public_point_history(uuid, uuid, boolean);

commit;

-- ============================================================
-- ROLLBACK (긴급 기능 복구용 — 실제 장애 확인 후에만, 별도 승인 거쳐 실행)
-- ============================================================
-- v1 함수 정의 자체는 여기 복제하지 않는다 — 필요 시 0034 migration의
-- get_public_point_history 정의를 그대로 재실행해 함수를 재생성한 뒤,
-- 아래 grant를 적용한다.
--
-- begin;
--
-- grant execute
-- on function public.get_public_point_history(uuid, uuid, boolean)
-- to anon, authenticated;
--
-- grant select, insert, update, delete, truncate, references, trigger
-- on table public.point_history
-- to anon, authenticated;
--
-- commit;
--
-- 참고:
-- point_history는 앱 코드에서 이미 v2 RPC로만 접근하므로, 이 rollback이
-- 실제로 필요할 상황은 거의 없을 것으로 예상된다 — 사고 대응 목적 외
-- 실행 금지.
