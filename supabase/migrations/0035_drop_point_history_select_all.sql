begin;

drop policy "point_history_select_all"
on public.point_history;

commit;

-- ROLLBACK:
-- create policy "point_history_select_all"
-- on public.point_history
-- for select
-- using (true);
