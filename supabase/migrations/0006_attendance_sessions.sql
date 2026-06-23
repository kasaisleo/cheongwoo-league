-- ============================================================
-- Mapo Cheongwoo Club League — 0006: 출석 세션(attendance_sessions) 도입
--
-- 범위: attendance_sessions 테이블 신설, attendance.session_id 추가
--
-- 설계 원칙:
-- - 기존 attendance 테이블/제약은 삭제하지 않고 그대로 유지 (event_date 기반 레거시 데이터 보존)
-- - 신규 출석은 session_id를 채워서 기록하고, event_date에는 session_date를 그대로 복사해 넣어
--   기존 not null 제약과 호환시킨다
-- - 월요일 초기화/휴일·임시운동 생성은 자동 스케줄이 아니라 manager 이상이 누르는
--   수동 버튼으로 동작한다 (이번 단계 SQL에는 자동화 로직을 넣지 않음, API에서 구현)
-- ============================================================

-- ----------------------------------------------------------
-- 1) attendance_sessions 테이블 신설
-- ----------------------------------------------------------
create type session_day_type as enum ('saturday', 'sunday', 'holiday', 'custom');
create type session_status_type as enum ('open', 'closed', 'archived');

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  session_day session_day_type not null,
  title text not null,
  status session_status_type not null default 'open',
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table attendance_sessions is '출석을 날짜가 아닌 세션 단위로 관리. 토요/일요 정기 세션과 휴일/임시운동 세션을 모두 포함.';
comment on column attendance_sessions.session_day is '세션 구분: saturday(토요 정기), sunday(일요 정기), holiday(휴일), custom(임시운동).';
comment on column attendance_sessions.status is 'open(현재 활성) → closed(마감, 추후 확장용) → archived(보관, 더 이상 활성 표시 안 함).';
comment on column attendance_sessions.created_by is '세션을 생성한 운영진(manager 이상)의 members.id.';

-- 같은 날짜+구분으로 이미 open 세션이 있는지 빠르게 조회하기 위한 인덱스
-- (중복 생성 방지 체크는 API 레벨에서 이 인덱스를 활용해 수행한다)
create index idx_attendance_sessions_date_day_status
  on attendance_sessions(session_date, session_day, status);

create index idx_attendance_sessions_status on attendance_sessions(status);

-- ----------------------------------------------------------
-- 2) attendance 테이블 확장 (기존 테이블/제약 유지, 컬럼만 추가)
-- ----------------------------------------------------------
alter table attendance
  add column session_id uuid references attendance_sessions(id);

comment on column attendance.session_id is '이 출석이 속한 세션. null이면 session 도입 이전의 레거시(event_date 기반) 데이터.';

-- 세션 기반 출석은 (member_id, session_id) 조합이 유일해야 한다.
-- 기존 unique(member_id, event_date)는 그대로 유지하며, session_id가 null인 레거시
-- 행들은 이 부분 unique 인덱스의 대상이 아니므로(where 조건으로 제외) 서로 영향을 주지 않는다.
create unique index idx_attendance_member_session_unique
  on attendance(member_id, session_id)
  where session_id is not null;

-- ----------------------------------------------------------
-- 3) RLS
-- ----------------------------------------------------------
-- attendance_sessions는 조회는 공개로 열고, 생성/마감/보관은 manager 이상만
-- 가능해야 하므로 anon insert/update 정책을 만들지 않는다. API Route(service-role)에서만 처리.
alter table attendance_sessions enable row level security;
create policy "attendance_sessions_select_all" on attendance_sessions for select using (true);
-- insert/update 정책 없음 = anon 쓰기 금지. manager 이상만 서버 라우트로 생성/마감/보관 처리.

-- attendance 테이블의 기존 RLS 정책(attendance_insert_anon, attendance_update_anon)은
-- 그대로 유지한다. 일반 회원의 본인 출석 변경 흐름은 이번 단계에서 건드리지 않는다.
