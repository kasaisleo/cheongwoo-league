begin;

drop policy "members_select_all"
on public.members;

revoke all
on public.member_stats
from public, anon, authenticated;

revoke all
on public.members
from public, anon, authenticated;

commit;

-- ROLLBACK (권장 긴급 기능 복구):
--
-- begin;
--
-- grant select
-- on public.members
-- to anon, authenticated;
--
-- grant select
-- on public.member_stats
-- to anon, authenticated;
--
-- create policy "members_select_all"
-- on public.members
-- for select
-- using (true);
--
-- commit;
--
-- 참고:
-- 이전 ACL에는 anon/authenticated에 광범위 privilege가 존재했지만,
-- 보안상 정확한 이전 ACL 복구는 권장하지 않는다.
-- 기능 복구에는 SELECT만 복원하면 충분하다.
