-- ============================================================
-- Mapo Cheongwoo Club League — 0007: attendance unique 제약 수정
--
-- 문제: 0006에서 만든 idx_attendance_member_session_unique가
-- "where session_id is not null" 조건이 붙은 부분(partial) unique 인덱스였다.
-- PostgreSQL의 ON CONFLICT는 조건이 없는 일반 unique 제약/인덱스만 인식하기 때문에,
-- upsert 시 "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification" (42P10) 에러가 발생했다.
--
-- 해결: 조건 없는 일반 unique 제약으로 교체한다. PostgreSQL은 unique 제약에서
-- null 값을 항상 "서로 다른 값"으로 취급하므로, session_id가 null인 레거시
-- attendance 행들은 여전히 서로 충돌하지 않는다. 즉 동작은 동일하게 유지되면서
-- ON CONFLICT만 정상적으로 인식되게 된다.
-- ============================================================

drop index if exists idx_attendance_member_session_unique;

alter table attendance
  add constraint attendance_member_session_unique unique (member_id, session_id);

comment on constraint attendance_member_session_unique on attendance is
  '회원당 세션 하나에 출석 기록 하나만 허용. session_id가 null인 레거시 행들은 서로 충돌하지 않음(PostgreSQL의 null unique 처리 규칙). upsert의 ON CONFLICT (member_id, session_id)가 이 제약을 사용한다.';
