-- migration 0021: session_guests 테이블 추가
-- 목적: attendance_sessions(매치) 단위로 참석 게스트를 지정/관리.
-- matches.team_*_guest는 "경기 결과 슬롯" 용도로 분리 유지.

create table session_guests (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references attendance_sessions(id) on delete cascade,
  guest_id    uuid not null references guests(id) on delete cascade,
  added_by    uuid references members(id),  -- 지정한 운영진 member.id
  created_at  timestamptz not null default now(),

  -- 같은 매치에 같은 게스트 중복 추가 방지
  unique (session_id, guest_id)
);

comment on table session_guests is
  '매치(attendance_session) 단위로 참석 게스트를 지정하는 테이블.
   matches.team_*_guest(경기 결과 슬롯)와 다른 용도.
   관리자가 운영 편의상 참석 게스트를 미리 지정하고,
   경기 입력 시 해당 게스트를 선수 후보 상단에 노출하는 데 활용.';

create index idx_session_guests_session on session_guests(session_id);
create index idx_session_guests_guest   on session_guests(guest_id);

-- RLS: 읽기 공개, 쓰기는 서비스 롤(API Route)에서만
alter table session_guests enable row level security;
create policy "session_guests_select_all" on session_guests for select using (true);
