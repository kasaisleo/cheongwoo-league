-- ============================================================
-- Mapo Cheongwoo Club League — 0010: matches.session_id 추가
--
-- 경기를 특정 출석 세션(attendance_sessions)에 귀속시키기 위한 컬럼 추가.
-- 신규 경기는 session_id를 필수로 받지만(API 레벨에서 검증), 기존에 이미
-- 저장된 경기 데이터는 session_id가 null인 상태로 그대로 둔다(레거시 허용).
-- ============================================================

alter table matches
  add column session_id uuid references attendance_sessions(id);

comment on column matches.session_id is '이 경기가 속한 출석 세션. 신규 경기는 API에서 필수로 검증하지만, 컬럼 자체는 nullable — 세션 연결 이전에 저장된 레거시 경기는 null로 남는다.';

create index idx_matches_session_id on matches(session_id);
