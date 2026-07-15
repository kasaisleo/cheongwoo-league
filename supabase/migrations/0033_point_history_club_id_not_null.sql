-- ============================================================
-- 0033: point_history.club_id NOT NULL 전환 (Phase 2 step 1)
--
-- 배경: 0032에서 club_id를 nullable snapshot 컬럼으로 추가하고 backfill했다.
-- 이번 migration은 그 값을 NOT NULL로 승격한다.
--
-- 범위:
--   - null / member.club_id 불일치 재검증 (하나라도 있으면 즉시 실패)
--   - club_id를 NOT NULL로 변경
--   - RPC, RLS 정책은 이 migration에서 건드리지 않는다
-- ============================================================

begin;

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
      'point_history NOT NULL precheck failed: % null row(s), % mismatched row(s)',
      null_count,
      mismatch_count;
  end if;
end $$;

alter table public.point_history
  alter column club_id set not null;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- alter table public.point_history alter column club_id drop not null;
