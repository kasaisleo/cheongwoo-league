-- ============================================================
-- Mapo Cheongwoo Club League — 0004: LP 시스템 도입 (1단계)
--
-- 범위: members 컬럼 추가 / staging_members 생성 / point_history 생성 /
--       member_stats view를 league_point 기준으로 변경
--
-- 하지 않는 것 (의도적 보류):
-- - grade, rating 컬럼 삭제 (deprecated 주석만 남기고 유지)
-- - rating_history 테이블 삭제 (유지)
-- - 대회 시스템, New Tennis Gear
-- ============================================================

-- ----------------------------------------------------------
-- 0) grade / rating deprecated 처리 (삭제하지 않음)
-- ----------------------------------------------------------
-- 신규 API/UI는 이 두 컬럼을 더 이상 사용하지 않는다. 하지만 기존 코드/뷰가
-- 참조 중일 수 있어 안정성을 위해 컬럼 자체는 남겨두고, 의미만 deprecated로 표시한다.
-- 실제 삭제는 신규 시스템이 충분히 안정화된 뒤 별도 migration에서 진행한다.
comment on column members.grade is
  'DEPRECATED (0004 이후 미사용). 실력 등급 — LP 시스템으로 대체됨. 신규 코드에서 참조하지 말 것.';
comment on column members.rating is
  'DEPRECATED (0004 이후 미사용). ELO 레이팅 — league_point로 대체됨. 신규 코드에서 참조하지 말 것.';

-- ----------------------------------------------------------
-- 1) members 테이블 확장
-- ----------------------------------------------------------
create type member_type as enum ('정회원', '준회원', '게스트');
create type permission_role as enum ('member', 'scorer', 'manager', 'admin', 'master');

alter table members
  add column member_type member_type not null default '정회원',
  add column league_point integer not null default 0,
  add column permission_role permission_role not null default 'member',
  add column kakao_provider_id text unique,
  add column is_kakao_linked boolean not null default false,
  add column address_full text,
  add column district text,
  add column age integer check (age between 0 and 120);

comment on column members.member_type is '회원 구분: 정회원/준회원/게스트.';
comment on column members.league_point is 'LP(리그 포인트). 일반 경기 승리 +10, 패배 +0로 누적. 추후 대회 포인트는 별도 합산 예정.';
comment on column members.permission_role is '권한 등급: member(조회/출석) < scorer(경기입력) < manager(회원/경기/출석 수정) < admin(삭제/대회 생성) < master(전체 권한).';
comment on column members.kakao_provider_id is '카카오 로그인 식별자. 1인당 1개 회원에만 연결되며 null 허용(미연결 상태).';
comment on column members.is_kakao_linked is '카카오 계정 연결 여부.';
comment on column members.address_full is '회원의 전체 주소(원문).';
comment on column members.district is '주소에서 추출한 생활권/동네 단위 지역명 (구 단위가 아님). 예: 당산, 망원, 합정, 성산, 상암, 문래, 목동 등.';
comment on column members.age is '회원 나이.';

-- ----------------------------------------------------------
-- 2) staging_members 테이블 신설 (대회명부 Import용)
-- ----------------------------------------------------------
-- members에 직접 insert하지 않고, 이 테이블에 원본을 적재한 뒤
-- 정제/검증을 거쳐 운영진이 확인 후 members에 반영(import)하는 중간 단계로 사용한다.
create type staging_validation_status as enum (
  'pending',
  'valid',
  'duplicate',
  'missing_required',
  'invalid_phone',
  'invalid_mapo_score',
  'needs_review',
  'imported',
  'skipped'
);

create table staging_members (
  id uuid primary key default gen_random_uuid(),

  -- 원본 데이터 (가공 없이 그대로 저장)
  raw_name text,
  raw_nickname text,
  raw_phone text,
  raw_address text,
  raw_age text,
  raw_mapo_score text,
  raw_member_type text,

  -- 정제된 데이터 (검증/정규화 후 채움)
  normalized_name text,
  normalized_nickname text,
  normalized_phone text,
  normalized_address text,
  normalized_district text,
  normalized_age integer,
  normalized_mapo_score integer,
  normalized_member_type text,

  -- 검증 상태
  validation_status staging_validation_status not null default 'pending',
  validation_errors text,

  -- 기존 회원과의 매칭 (phone 중복 시 update 후보로 연결)
  existing_member_id uuid references members(id),

  memo text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table staging_members is '대회명부 등 외부 데이터를 members에 직접 반영하기 전 임시 적재/정제/검증하는 테이블.';
comment on column staging_members.normalized_district is '정제된 주소에서 추출한 생활권/동네 단위 지역명 (구 단위가 아님).';
comment on column staging_members.normalized_age is '공유시트 기준 나이에 +1 적용하여 저장한 값.';
comment on column staging_members.existing_member_id is 'normalized_phone이 기존 members.phone과 일치할 경우, 매칭된 회원의 id. update 후보로 처리.';

create index idx_staging_members_validation_status on staging_members(validation_status);
create index idx_staging_members_normalized_phone on staging_members(normalized_phone);

-- ----------------------------------------------------------
-- 3) point_history 테이블 신설 (rating_history는 유지, 별도로 추가)
-- ----------------------------------------------------------
create table point_history (
  id uuid primary key default gen_random_uuid(),
  -- 일반 경기 포인트는 항상 match_id가 채워진다. 추후 대회 보너스 포인트처럼
  -- 특정 경기와 직접 연결되지 않는 포인트 변동이 생길 수 있어 nullable로 둔다.
  match_id uuid references matches(id) on delete cascade,
  member_id uuid not null references members(id),
  point_before integer not null,
  point_after integer not null,
  point_change integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

comment on table point_history is 'LP(league_point) 변동 이력. 일반 경기는 reason=regular_match_win 등으로 기록. rating_history와는 별개의 신규 테이블.';
comment on column point_history.reason is '포인트 변동 이유. 예: regular_match_win, regular_match_loss 등. 추후 대회 포인트 종류 확장 예정.';

create index idx_point_history_member on point_history(member_id, created_at desc);

-- ----------------------------------------------------------
-- 4) member_stats 뷰 재생성 (league_point 기준, rating 참조 제거)
-- ----------------------------------------------------------
-- 기존 컬럼(rating, grade 포함)은 members 테이블에서 삭제하지 않으므로 뷰에는
-- select *로 계속 포함되지만, 정렬/표시 목적은 league_point 중심으로 전환한다.
drop view if exists member_stats;

create view member_stats as
select
  m.*,
  case when (m.wins + m.losses) = 0 then 0
       else round((m.wins::numeric / (m.wins + m.losses)) * 100, 1)
  end as win_rate
from members m;

comment on view member_stats is 'league_point, wins, losses, win_rate 중심으로 사용. rating/grade는 deprecated 컬럼으로 select에는 포함되지만 신규 코드에서 참조하지 않음.';

-- ----------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------
-- staging_members는 공개 접근을 일체 허용하지 않는다. service-role(운영진 API)만 접근.
alter table staging_members enable row level security;
-- select/insert/update/delete 정책을 만들지 않음 = anon 키로는 어떤 작업도 불가능.
-- 모든 접근은 서버 라우트에서 service-role 클라이언트로 처리한다.

-- point_history는 rating_history와 동일한 패턴: 조회는 공개, 쓰기는 service-role만.
alter table point_history enable row level security;
create policy "point_history_select_all" on point_history for select using (true);
-- insert/update 정책 없음 = anon 쓰기 금지, 서버 라우트(service-role)에서만 처리.
