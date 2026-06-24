-- ============================================================
-- Mapo Cheongwoo Club League — 0009: 경기 삭제 시 LP 이력 보존
--
-- 문제: point_history.match_id가 "on delete cascade"로 설정되어 있어,
-- 경기(matches)를 삭제하면 그 경기와 관련된 point_history 기록까지
-- 자동으로 모두 삭제된다. 이러면 경기 삭제 시 rollbackMatch()가 남기는
-- "되돌림" 보정 레코드까지 같이 사라져서, LP 변동 이력을 추적할 수 없게 된다.
--
-- 해결: match_id의 삭제 정책을 "on delete set null"로 바꾼다. 경기가
-- 삭제되어도 point_history 행 자체는 남고, match_id만 null이 되어
-- "어떤 경기였는지는 알 수 없지만 포인트 변동은 있었다"는 이력이 보존된다.
-- ============================================================

alter table point_history drop constraint if exists point_history_match_id_fkey;

alter table point_history
  add constraint point_history_match_id_fkey
  foreign key (match_id) references matches(id) on delete set null;

comment on column point_history.match_id is '연결된 경기. 경기가 삭제되면 null로 남아 이력은 보존된다(on delete set null).';
