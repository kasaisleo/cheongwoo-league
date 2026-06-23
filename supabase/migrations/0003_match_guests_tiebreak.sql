-- ============================================================
-- Mapo Cheongwoo Club League — 0003: 매치 구조 변경 (게스트 참여),
-- 타이브레이크 스코어, 게스트 나이/구력 추가
-- ============================================================

-- ----------------------------------------------------------
-- 1) 게스트 테이블에 나이/구력 추가
-- ----------------------------------------------------------
alter table guests
  add column age integer check (age between 0 and 120),
  add column years_playing numeric(4, 1) check (years_playing >= 0),
  add column phone text;

comment on column guests.age is '게스트 나이.';
comment on column guests.years_playing is '테니스 구력(년). 소수 허용(예: 1.5년).';
comment on column guests.phone is '게스트 휴대폰 번호.';

-- ----------------------------------------------------------
-- 2) matches 테이블 구조 변경
-- ----------------------------------------------------------
-- 기존: team_a_player1~team_b_player2 4개 컬럼이 모두 members(id)만 가리킴.
-- 변경: 각 슬롯마다 member_id/guest_id 두 컬럼을 두고, 정확히 하나만 채워지도록 한다.
-- 이렇게 하면 회원과 게스트가 같은 경기에서 함께 뛸 수 있다.

-- 기존 4개 컬럼과 그 컬럼들에 걸린 제약을 제거하고 새 구조로 교체한다.
-- (이미 저장된 경기 데이터가 있다면 마이그레이션 전에 별도 백업/이행이 필요하지만,
--  이 프로젝트는 초기 단계이므로 기존 매치 데이터 보존 없이 구조를 변경한다.)

alter table matches drop constraint if exists chk_no_duplicate_players;
alter table matches drop column if exists team_a_player1;
alter table matches drop column if exists team_a_player2;
alter table matches drop column if exists team_b_player1;
alter table matches drop column if exists team_b_player2;

alter table matches
  add column team_a_player1_member uuid references members(id),
  add column team_a_player1_guest uuid references guests(id),
  add column team_a_player2_member uuid references members(id),
  add column team_a_player2_guest uuid references guests(id),
  add column team_b_player1_member uuid references members(id),
  add column team_b_player1_guest uuid references guests(id),
  add column team_b_player2_member uuid references members(id),
  add column team_b_player2_guest uuid references guests(id);

comment on column matches.team_a_player1_member is '청팀 선수1이 회원인 경우의 members.id. 게스트인 경우 null.';
comment on column matches.team_a_player1_guest is '청팀 선수1이 게스트인 경우의 guests.id. 회원인 경우 null.';

alter table matches
  add constraint chk_team_a_player1_exactly_one
    check ((team_a_player1_member is not null) <> (team_a_player1_guest is not null)),
  add constraint chk_team_a_player2_exactly_one
    check ((team_a_player2_member is not null) <> (team_a_player2_guest is not null)),
  add constraint chk_team_b_player1_exactly_one
    check ((team_b_player1_member is not null) <> (team_b_player1_guest is not null)),
  add constraint chk_team_b_player2_exactly_one
    check ((team_b_player2_member is not null) <> (team_b_player2_guest is not null));

-- ----------------------------------------------------------
-- 3) 타이브레이크 스코어 추가
-- ----------------------------------------------------------
-- 테니스 세트 스코어는 0~7(7-6은 타이브레이크 진행을 의미). 타이브레이크 자체 점수는
-- 별도로 기록하며 이론상 무제한으로 올라갈 수 있다(예: 10-8, 15-13 등).
alter table matches
  add column score_a_tiebreak integer check (score_a_tiebreak >= 0),
  add column score_b_tiebreak integer check (score_b_tiebreak >= 0);

comment on column matches.score_a_tiebreak is '청팀 타이브레이크 점수(7-6 스코어일 때만 사용). 무제한 허용.';
comment on column matches.score_b_tiebreak is '우팀 타이브레이크 점수(7-6 스코어일 때만 사용). 무제한 허용.';

-- 세트 스코어 범위를 0~7로 제한 (기존에는 0 이상만 체크했음)
alter table matches drop constraint if exists matches_score_a_check;
alter table matches drop constraint if exists matches_score_b_check;
alter table matches
  add constraint chk_score_a_range check (score_a >= 0 and score_a <= 7),
  add constraint chk_score_b_range check (score_b >= 0 and score_b <= 7);

-- ----------------------------------------------------------
-- 4) rating_history: 게스트는 레이팅을 갖지 않으므로 회원 전용 유지
-- ----------------------------------------------------------
-- rating_history.member_id는 변경하지 않는다. 게스트가 경기에 참여해도
-- rating_history에는 기록을 남기지 않고, 승/패만 guests 테이블에 직접 갱신한다.
alter table guests
  add column wins integer not null default 0,
  add column losses integer not null default 0;

comment on column guests.wins is '게스트로 참여한 경기의 승 수. 레이팅에는 영향을 주지 않는다.';
comment on column guests.losses is '게스트로 참여한 경기의 패 수. 레이팅에는 영향을 주지 않는다.';

-- ----------------------------------------------------------
-- 5) guest_stats 뷰 (승률 포함)
-- ----------------------------------------------------------
create view guest_stats as
select
  g.*,
  case when (g.wins + g.losses) = 0 then 0
       else round((g.wins::numeric / (g.wins + g.losses)) * 100, 1)
  end as win_rate
from guests g;

-- ----------------------------------------------------------
-- 6) guests RLS 보강: anon insert/update 허용
-- ----------------------------------------------------------
-- 게스트 등록 화면(/guests/new)과 경기입력 화면의 게스트 즉석등록은 모두
-- 미들웨어에서 운영진 세션을 먼저 확인한 뒤에만 진입 가능한 페이지이므로,
-- 그 페이지 내부에서 이루어지는 브라우저발 insert/update는 허용해도 안전하다.
create policy "guests_insert_anon" on guests for insert with check (true);
create policy "guests_update_anon" on guests for update using (true);
