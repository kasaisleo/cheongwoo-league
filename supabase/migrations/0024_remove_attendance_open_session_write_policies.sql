-- Remove remaining public attendance write policies.
-- Attendance writes now go through server API routes using service role clients.

drop policy if exists "attendance_insert_open_session" on attendance;
drop policy if exists "attendance_update_open_session" on attendance;

-- Rollback:
-- create policy "attendance_insert_open_session" on attendance
--   for insert
--   with check (true);
--
-- create policy "attendance_update_open_session" on attendance
--   for update
--   using (true);
