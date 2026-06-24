-- ============================================================
-- Mapo Cheongwoo Club League — 0008: 레거시 unique 제약 제거
--
-- 문제: 0001에서 만든 unique(member_id, event_date) 제약이 세션 시스템과
-- 충돌한다. 같은 날짜에 정기 세션과 휴일/임시운동 세션이 함께 열리면
-- (예: 토요 정기운동 + 그날의 임시운동), 같은 회원이 같은 event_date를
-- 가진 두 세션 모두에 출석 행을 가지게 되는데, 이 옛 제약이 그걸 막아서
-- "duplicate key value violates unique constraint
-- attendance_member_id_event_date_key" (23505) 에러가 발생했다.
--
-- 해결: 이 제약을 제거한다. 세션 기반 출석의 유일성은 0007에서 추가한
-- attendance_member_session_unique(member_id, session_id) 제약이 담당하므로,
-- event_date 기준 제약은 더 이상 필요하지 않다.
--
-- 영향: session_id가 null인 레거시 데이터(세션 도입 이전)에는 이 제약이
-- 없어져도 안전하다 — 그 데이터는 이미 과거에 쌓인 것이고 더 이상
-- 새로 추가되지 않는다.
-- ============================================================

alter table attendance drop constraint if exists attendance_member_id_event_date_key;
