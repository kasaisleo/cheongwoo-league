-- ============================================================
-- Cheongwoo League — 0002: 직책, 연락처, 마포구 점수 추가
-- ============================================================

-- ----------------------------------------------------------
-- 1) 직책(role) 추가
-- ----------------------------------------------------------
-- grade(A/B/C/D)는 실력 등급으로 그대로 유지하고, role은 클럽 내 직책을 나타내는
-- 별도 축이다. 한 회원이 grade와 role을 동시에 가진다.
create type member_role as enum (
  '회장', '부회장', '총무', '경기이사', '홍보이사', '운영이사', '섭외이사', '정회원', '고문'
);

alter table members
  add column role member_role not null default '정회원',
  add column phone text,
  add column mapo_score integer check (mapo_score between 1 and 10);

comment on column members.role is '클럽 내 직책. 실력 등급(grade)과 별개의 축.';
comment on column members.phone is '휴대폰 번호.';
comment on column members.mapo_score is '마포구 대회용 점수(1~10). 클럽 레이팅(rating)에는 영향을 주지 않는다.';

-- ----------------------------------------------------------
-- 2) member_stats 뷰 재생성 (새 컬럼 포함)
-- ----------------------------------------------------------
drop view if exists member_stats;

create view member_stats as
select
  m.*,
  case when (m.wins + m.losses) = 0 then 0
       else round((m.wins::numeric / (m.wins + m.losses)) * 100, 1)
  end as win_rate
from members m;

-- ----------------------------------------------------------
-- 3) 게스트 → 정회원 전환 시 참고용 컬럼
-- ----------------------------------------------------------
-- 게스트 레코드는 정회원으로 전환되어도 삭제하지 않고 그대로 보관한다(방문 이력 보존).
-- 전환된 게스트가 어떤 회원으로 연결됐는지 추적하기 위한 컬럼을 추가한다.
alter table guests
  add column converted_to_member_id uuid references members(id);

comment on column guests.converted_to_member_id is '이 게스트가 정회원으로 전환된 경우, 생성된 members.id를 가리킨다. null이면 아직 게스트 상태.';
