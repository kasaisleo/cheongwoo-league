-- ============================================================
-- 0048: point_history 이력 순서 보장(sequence_no) + get_public_point_history_v2
--        내부 정렬 전환 (Point History P1)
--
-- 배경: point_history.created_at은 트랜잭션 스코프 값(transaction_timestamp)이라
-- 같은 트랜잭션 안에서 여러 행이 삽입되면(예: 한 매치의 참가자 여러 명) 전부
-- 동일한 created_at을 갖는다. 라이브 실측 결과 동일 member_id+created_at 동률
-- 그룹이 실제로 2건(최대 크기 2) 존재하며, 그중 rollback/apply(승패)가 섞인
-- 동률 사례(rollback 2건, loss 2건)도 확인되어 created_at만으로는 정합성 검사
-- (이력 체인 연속성 등)를 정확히 수행할 수 없다.
--
-- 해결: bigint identity 컬럼(sequence_no)을 추가해 "회원별 삽입(=상태 전이)
-- 순서"를 보장한다. 회원별 point_history 삽입은 항상 그 회원 행의 FOR UPDATE
-- 락(0045 _match_validate_and_lock_participants) 하에서 이루어지므로, 같은
-- member_id를 건드리는 두 트랜잭션은 항상 완전히 직렬화된다 — 따라서 sequence_no는
-- "전역 커밋 순서"가 아니라 "회원별 순서"만 보장하면 충분하고, identity 컬럼이
-- 정확히 그 보장을 제공한다(전역 커밋 순서 불일치·시퀀스 gap은 이 목적에 영향
-- 없음 — 정상이며 오류가 아니다).
--
-- 기존 147행은 진짜 삽입 순서를 지금 복원할 수 없다(동률 그룹 내부의 실제 선후
-- 관계는 uuid 등 어떤 컬럼으로도 추정 불가 — 임의로 지어내지 않는다). 그래서
-- sequence_trusted 플래그로 "이 sequence_no가 실제 삽입 순서를 신뢰할 수 있는지"를
-- 명시한다: 기존 행은 전부 false, 이 migration 커밋 이후 새로 삽입되는 행부터 true.
--
-- 이번 migration이 하는 일:
--   1) point_history.sequence_no (bigint identity) + unique index 추가.
--      identity는 값의 유일성을 "발급" 시점에 보장할 뿐 테이블 제약이 아니므로
--      (OVERRIDING SYSTEM VALUE로 직접 지정된 중복값이 이론상 가능) unique
--      index를 별도로 명시한다.
--   2) 회원별 조회 성능용 index(club_id, member_id, sequence_no desc) 추가 —
--      unique index와 목적이 다르다(A1/A2류 조회 성능 전용).
--   3) point_history.sequence_trusted 추가 — 컬럼 추가 시점 default를 false로
--      먼저 걸어 기존 행 전부가 자동으로 false를 받게 한 뒤(전체 UPDATE 불필요),
--      그 다음 default만 true로 바꿔 이후 신규 INSERT부터 true가 되게 한다.
--   4) get_public_point_history_v2(0043)를 CREATE OR REPLACE — 인자 목록과
--      반환 컬럼은 1도 바꾸지 않고, 함수 본문의 `order by ph.created_at desc`를
--      `order by ph.created_at desc, ph.sequence_no desc`로 교체한다(단순히
--      sequence_no만으로 정렬하지 않는다 — 기존 147행의 sequence_no는 backfill
--      시점의 identity 자동 채움 순서일 뿐 실제 과거 삽입 순서를 보장하지 않으므로,
--      sequence_no 단독 정렬은 기존 이력 전체의 표시 순서를 뒤섞을 위험이 있다.
--      created_at을 1차 정렬 기준으로 유지해 기존 시간순 표시를 그대로 보존하고,
--      sequence_no는 동일 created_at 안에서만 tie-break로 작동한다 — 신규 데이터의
--      동률(같은 트랜잭션 내 여러 행)은 정확한 삽입 순서로, 과거 동률은 여전히
--      복원 불가 상태로 남되 최소한 created_at 순서 자체는 깨지지 않는다).
--      인자 시그니처가 동일하므로 DROP은 필요 없다(0046의 DROP-then-CREATE
--      규칙은 인자 목록 자체가 바뀔 때만 해당 — PostgREST overload 충돌은
--      이번에 발생하지 않는다).
--      CREATE OR REPLACE는 기존 GRANT를 그대로 보존하므로(DROP 후 CREATE와 달리)
--      이번 migration에서 REVOKE/GRANT를 다시 실행하지 않는다 — 적용 후 검증
--      SQL로 grant 상태가 이전과 동일함을 직접 재확인한다.
--   5) sequence_no/sequence_trusted는 이 함수의 반환 컬럼에 포함하지 않는다
--      (공개 payload 비노출 — 정렬 기준으로만 내부 사용. 이 값을 외부에 노출하면
--      두 시점의 값 차이로 클럽 전체 활동량을 역산할 수 있어 새로운 정보 노출이 된다).
--
-- 이번 migration이 하지 않는 일:
--   - point_history 테이블의 RLS/GRANT 변경 없음(0044에서 이미 완전 잠금 상태 유지).
--   - _match_apply_effects/_match_undo_effects(0045) 무변경 — sequence_no/
--     sequence_trusted는 컬럼 DEFAULT로 자동 채워지므로 INSERT 문 수정 불필요.
--   - A1/A2 정합성 쿼리 자체는 DDL이 아니므로 이 migration에 포함하지 않는다
--     (별도 운영 조회 스크립트로 관리).
--   - get_public_point_history(v1)는 0044에서 이미 제거되어 이번에 다룰 대상 없음.
--
-- 트랜잭션 범위: 이 파일 전체가 begin~commit 하나로 묶여 있으므로, Studio에
-- 붙여넣어 그대로 실행하면 중간 어느 단계에서 실패하든 전체가 원자적으로
-- 롤백된다(부분 적용 없음) — 이 프로젝트는 별도 migration 러너 없이 Studio
-- SQL Editor에 전문을 붙여넣어 실행하는 방식이므로, 이 begin/commit 래핑 자체가
-- "단일 트랜잭션" 보장의 유일하고 충분한 근거다.
--
-- 라이브 실측(사전 확인 완료, 참고용):
--   total_rows=147, tie_group_count=2, max_group_size=2,
--   rollback_apply_tie_exists=true(rollback 2건/loss 2건 동률) —
--   과거 동률 구간의 실제 순서는 sequence_trusted=false로만 표시하고 복원하지 않는다.
--   라이브 함수 전수 조사 결과 point_history를 참조하는 함수는 _match_apply_effects,
--   _match_undo_effects, update_match_with_effects(create/delete 포함 0045 외부
--   함수 3개 전부가 apply/undo_effects를 호출하므로 정의에 포함), get_public_point_history_v2
--   뿐 — 예상 밖 legacy writer 없음.
-- ============================================================

begin;

-- ============================================================
-- 1) sequence_no — bigint identity + unique index
-- ============================================================
alter table public.point_history
  add column sequence_no bigint generated always as identity;

comment on column public.point_history.sequence_no is
  '회원별(club_id, member_id) 삽입 순서를 보장하는 단조 증가 값. 전역 커밋
   순서는 보장하지 않으며 그럴 필요도 없다 — 같은 member_id에 대한 삽입은
   항상 그 회원 행의 FOR UPDATE 락(0045)으로 직렬화되기 때문이다. rollback으로
   인한 시퀀스 gap은 정상이며 오류가 아니다. 외부 공개 payload에는 노출하지
   않는다(get_public_point_history_v2는 정렬에만 사용, 반환 컬럼에는 미포함).';

create unique index point_history_sequence_no_uniq
  on public.point_history (sequence_no);

create index idx_point_history_club_member_sequence
  on public.point_history (club_id, member_id, sequence_no desc);

-- ============================================================
-- 2) sequence_trusted — 기존 행 false, 이후 신규 행 true
--    (전체 UPDATE 없이 컬럼 추가 시점의 default 값을 단계적으로 전환)
-- ============================================================
alter table public.point_history
  add column sequence_trusted boolean not null default false;

comment on column public.point_history.sequence_trusted is
  'sequence_no가 실제 삽입 순서를 신뢰할 수 있는지 여부. 이 migration 적용
   시점의 기존 행은 전부 false로 고정된다(동률 그룹 내부의 실제 선후 관계는
   어떤 컬럼으로도 복원할 수 없어 추정하지 않는다) — false 확정 이후 default만
   true로 바뀌어 이 migration 커밋 이후 새로 삽입되는 행부터 true를 받는다.
   정합성 검사(A2류)는 연속된 두 행이 모두 true일 때만 체인 연속성을 검사해야
   한다 — cutover 경계에 걸친 쌍은 검사 대상에서 제외한다.';

alter table public.point_history
  alter column sequence_trusted set default true;

-- ============================================================
-- 3) get_public_point_history_v2 — created_at + sequence_no 복합 정렬로 교체
--    (인자/반환 컬럼/권한 전부 무변경 — CREATE OR REPLACE, DROP 불필요)
-- ============================================================
create or replace function public.get_public_point_history_v2(
  p_club_id uuid,
  p_member_id uuid default null,
  p_include_inactive_member boolean default false
)
returns table (
  member_name text,
  point_before integer,
  point_after integer,
  point_change integer,
  reason text,
  created_at timestamptz,
  match_played_at date,
  session_day text,
  session_title text,
  match_group_token text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.name,
    ph.point_before,
    ph.point_after,
    ph.point_change,
    ph.reason,
    ph.created_at,
    mt.played_at,
    s.session_day::text,
    s.title,
    -- digest 호출부: pgcrypto가 public 스키마에 설치돼 있다면
    -- extensions.digest를 public.digest로 바꿀 것(0043과 동일 주의사항).
    case
      when ph.match_id is null then null
      else substr(
        encode(
          extensions.digest(p_club_id::text || ':' || ph.match_id::text, 'sha256'),
          'hex'
        ),
        1, 32
      )
    end as match_group_token
  from public.point_history ph
  join public.clubs c
    on c.id = p_club_id
   and c.status = 'active'
  join public.members m
    on m.id = ph.member_id
   and m.club_id = p_club_id
   and (
     m.is_active = true
     or (
       p_include_inactive_member = true
       and p_member_id is not null
       and m.id = p_member_id
     )
   )
  left join public.matches mt
    on mt.id = ph.match_id
   and mt.club_id = p_club_id
  left join public.attendance_sessions s
    on s.id = mt.session_id
   and s.club_id = p_club_id
  where ph.club_id = p_club_id
    and (p_member_id is null or ph.member_id = p_member_id)
  -- 0043 대비 유일한 변경점: created_at desc 단일 정렬 → created_at desc,
  -- sequence_no desc 복합 정렬. 전체 표시 순서는 여전히 created_at 기준(기존
  -- 동작 보존)이고, 같은 created_at(같은 트랜잭션에서 삽입된 행들)만 sequence_no로
  -- 정확한 삽입 순서로 tie-break된다. sequence_no 단독 정렬은 과거 147행의
  -- backfill 값이 실제 삽입 순서를 보장하지 않아 채택하지 않는다.
  order by ph.created_at desc, ph.sequence_no desc
  limit 200;
$$;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- -- get_public_point_history_v2를 0043 원본(order by ph.created_at desc)으로 되돌린다.
-- create or replace function public.get_public_point_history_v2(
--   p_club_id uuid,
--   p_member_id uuid default null,
--   p_include_inactive_member boolean default false
-- )
-- returns table (
--   member_name text, point_before integer, point_after integer, point_change integer,
--   reason text, created_at timestamptz, match_played_at date, session_day text,
--   session_title text, match_group_token text
-- )
-- language sql stable security definer set search_path = '' as $$
--   select
--     m.name, ph.point_before, ph.point_after, ph.point_change, ph.reason, ph.created_at,
--     mt.played_at, s.session_day::text, s.title,
--     case when ph.match_id is null then null
--       else substr(encode(extensions.digest(p_club_id::text || ':' || ph.match_id::text, 'sha256'), 'hex'), 1, 32)
--     end as match_group_token
--   from public.point_history ph
--   join public.clubs c on c.id = p_club_id and c.status = 'active'
--   join public.members m on m.id = ph.member_id and m.club_id = p_club_id
--     and (m.is_active = true or (p_include_inactive_member = true and p_member_id is not null and m.id = p_member_id))
--   left join public.matches mt on mt.id = ph.match_id and mt.club_id = p_club_id
--   left join public.attendance_sessions s on s.id = mt.session_id and s.club_id = p_club_id
--   where ph.club_id = p_club_id and (p_member_id is null or ph.member_id = p_member_id)
--   order by ph.created_at desc
--   limit 200;
-- $$;
--
-- drop index if exists public.idx_point_history_club_member_sequence;
-- drop index if exists public.point_history_sequence_no_uniq;
-- alter table public.point_history drop column if exists sequence_trusted;
-- alter table public.point_history drop column if exists sequence_no;
--
-- commit;
