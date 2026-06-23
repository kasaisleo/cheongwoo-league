-- ============================================================
-- Cheongwoo League — 초기 스키마
-- ============================================================

create type member_grade as enum ('A', 'B', 'C', 'D');
create type attendance_status as enum ('attending', 'absent', 'undecided');
create type winner_team_type as enum ('A', 'B');

-- ----------------------------------------------------------
-- 1) 회원
-- ----------------------------------------------------------
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text not null,
  grade member_grade not null,
  rating integer not null default 1500,
  wins integer not null default 0,
  losses integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table members is '클럽 회원. 레이팅은 경기 결과에 따라 ELO로 갱신된다.';

create or replace function set_initial_rating()
returns trigger as $$
begin
  if new.rating is null then
    new.rating := case new.grade
      when 'A' then 1700
      when 'B' then 1500
      when 'C' then 1300
      when 'D' then 1100
    end;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_initial_rating
before insert on members
for each row execute function set_initial_rating();

create view member_stats as
select
  m.*,
  case when (m.wins + m.losses) = 0 then 0
       else round((m.wins::numeric / (m.wins + m.losses)) * 100, 1)
  end as win_rate
from members m;

-- ----------------------------------------------------------
-- 2) 경기 (복식)
-- ----------------------------------------------------------
create table matches (
  id uuid primary key default gen_random_uuid(),
  played_at date not null default current_date,
  team_a_player1 uuid not null references members(id),
  team_a_player2 uuid not null references members(id),
  team_b_player1 uuid not null references members(id),
  team_b_player2 uuid not null references members(id),
  score_a integer not null check (score_a >= 0),
  score_b integer not null check (score_b >= 0),
  winner_team winner_team_type not null,
  created_by uuid references members(id),
  created_at timestamptz not null default now(),

  constraint chk_no_duplicate_players check (
    team_a_player1 not in (team_a_player2, team_b_player1, team_b_player2)
    and team_a_player2 not in (team_b_player1, team_b_player2)
    and team_b_player1 <> team_b_player2
  )
);

comment on table matches is '복식 경기 결과. 저장 시 애플리케이션에서 ELO를 계산해 members.rating과 rating_history를 함께 갱신한다.';

create index idx_matches_played_at on matches(played_at desc);

create table rating_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  member_id uuid not null references members(id),
  rating_before integer not null,
  rating_after integer not null,
  rating_change integer not null,
  created_at timestamptz not null default now()
);

comment on table rating_history is '경기마다 선수별 레이팅 변동 전/후 값을 기록. members.rating은 최신값만 가지므로 이력 추적에 필요.';

create index idx_rating_history_member on rating_history(member_id, created_at desc);

-- ----------------------------------------------------------
-- 3) 출석
-- ----------------------------------------------------------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  event_date date not null,
  status attendance_status not null default 'undecided',
  updated_at timestamptz not null default now(),
  unique(member_id, event_date)
);

comment on table attendance is '회원별 날짜별 출석 상태. 한 회원당 같은 날짜는 1건만 존재(토글 업데이트).';

create index idx_attendance_event_date on attendance(event_date);

-- ----------------------------------------------------------
-- 4) 게스트
-- ----------------------------------------------------------
create table guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  referred_by uuid references members(id),
  visit_date date not null,
  skill_grade member_grade,
  manner_score integer check (manner_score between 1 and 5),
  reinvite boolean,
  notes text,
  created_at timestamptz not null default now()
);

comment on table guests is '게스트 방문 기록. 회원이 아니므로 members와 분리.';

create index idx_guests_visit_date on guests(visit_date desc);

-- ----------------------------------------------------------
-- 5) RLS (Row Level Security)
-- ----------------------------------------------------------
-- 회원 로그인이 없는 구조. 읽기는 공개로 열고, members/matches/rating_history/guests의
-- 쓰기는 서버(API Route, service-role 키)에서만 수행한다. 운영진 인증은
-- 애플리케이션 레이어(쿠키 세션)에서 처리한다.

alter table members enable row level security;
alter table matches enable row level security;
alter table rating_history enable row level security;
alter table attendance enable row level security;
alter table guests enable row level security;

create policy "members_select_all" on members for select using (true);
create policy "matches_select_all" on matches for select using (true);
create policy "rating_history_select_all" on rating_history for select using (true);
create policy "attendance_select_all" on attendance for select using (true);
create policy "guests_select_all" on guests for select using (true);

-- 출석은 회원 로그인이 없으므로 누구나(anon) 체크할 수 있게 열어둔다.
create policy "attendance_insert_anon" on attendance for insert with check (true);
create policy "attendance_update_anon" on attendance for update using (true);

-- members/matches/rating_history/guests에는 anon insert/update 정책을 만들지 않음.
-- 운영진 화면의 저장 요청은 서버 라우트에서 service-role 클라이언트로 처리한다.
