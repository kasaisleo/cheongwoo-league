-- ============================================================
-- 0032: point_history club_id snapshot 컬럼 추가 (Phase 1)
--
-- 배경: point_history에는 club_id가 없어 member_id → members.club_id로만
-- 클럽을 판별할 수 있다. RLS(point_history_select_all)가 전체 공개 조회를
-- 허용하고 있어, anon key로 직접 REST 호출 시 클럽 구분 없이 전체 이력이
-- 노출되는 문제가 있다(Skin Leakage 감사 확인).
--
-- Phase 1 범위:
--   1) club_id nullable 컬럼 추가
--   2) 기존 row backfill(member_id → members.club_id)
--   3) FK + index 추가
--   4) NOT NULL은 적용하지 않는다 — 앱 코드(lib/match-engine.ts) 배포가
--      이 migration보다 먼저 반영되어야 신규 INSERT가 실패하지 않는다.
--      적용 순서: (a) 이 migration → (b) match-engine.ts 배포 →
--      (c) 운영 검증 → (d) 별도 Phase 2에서 NOT NULL 전환.
--   5) point_history_select_all 정책은 이번 Phase에서 건드리지 않는다.
--   6) 복합 FK/trigger는 이번 Phase에서 추가하지 않는다(별도 Phase에서 검토).
-- ============================================================

begin;

-- 1) 컬럼 추가 — IF NOT EXISTS를 쓰지 않는다. 동일 이름의 예상 밖 컬럼이
--    이미 존재한다면(타입/FK가 다를 수 있으므로) migration이 조용히 넘어가지
--    않고 명확하게 실패해야 한다.
alter table public.point_history
  add column club_id uuid references public.clubs(id);

comment on column public.point_history.club_id is
  '기록 발생 당시 회원의 소속 클럽 snapshot. members.club_id를 실시간 조인하는
   대신 이 값을 저장해, 향후 회원의 클럽 소속이 바뀌더라도 기록 시점의 클럽
   귀속을 그대로 보존한다. Phase 1에서는 nullable — Phase 2에서 NOT NULL 전환.';

-- 2) 기존 row backfill
update public.point_history ph
set club_id = m.club_id
from public.members m
where ph.member_id = m.id
  and ph.club_id is null;

-- 3) 검증 — null row와 member.club_id 불일치 row를 모두 확인한다.
--    하나라도 있으면 트랜잭션 전체를 롤백시킨다(컬럼 추가/backfill 포함).
do $$
declare
  null_count integer;
  mismatch_count integer;
begin
  select count(*)
  into null_count
  from public.point_history
  where club_id is null;

  select count(*)
  into mismatch_count
  from public.point_history ph
  join public.members m on m.id = ph.member_id
  where ph.club_id is distinct from m.club_id;

  if null_count > 0 or mismatch_count > 0 then
    raise exception
      'point_history backfill validation failed: % null row(s), % mismatched row(s)',
      null_count,
      mismatch_count;
  end if;
end $$;

-- 4) index
create index if not exists idx_point_history_club_id_created_at
  on public.point_history (club_id, created_at desc);

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- drop index if exists public.idx_point_history_club_id_created_at;
-- alter table public.point_history drop column if exists club_id;
