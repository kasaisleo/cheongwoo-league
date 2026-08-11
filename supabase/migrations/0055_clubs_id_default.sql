-- ============================================================
-- 0055: clubs.id 기본값 보강
--
-- 배경: CENTER COURT 클럽 생성 오류 조사 결과, 프로덕션 clubs.id 컬럼에
--   default가 없음을 확인했다(23502 not_null_violation로 실측 재현).
--   clubs는 이 저장소에 CREATE TABLE migration이 없는 기존 gap(0049
--   주석에 이미 문서화된 사실)이라 다른 신규 테이블(events, event_games
--   등)과 달리 id에 gen_random_uuid() default가 애초에 설정되지 않았다.
--
--   이번 migration은 이 gap의 근본 원인(clubs 테이블 자체의 부재)을
--   다루지 않는다 — 그 재현성 작업은 관련 함수·RLS·권한·제약·의존 순서를
--   별도로 조사한 뒤 진행하기로 결정했다(이번 범위 밖). 여기서는 API가
--   id를 명시적으로 생성해 전달하도록 병행 수정한 것과 별개로, DB
--   레벨에서도 id 없이 삽입해도 안전하게 동작하도록 default만 보강한다.
--
--   clubs의 다른 컬럼·제약·데이터는 전혀 건드리지 않는다.
-- ============================================================

begin;

alter table public.clubs
  alter column id set default gen_random_uuid();

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- alter table public.clubs alter column id drop default;
--
-- commit;
