-- ============================================================
-- 0074: Player matching profile foundation (Phase 2A-9C-A)
--
-- 자동 대진의 입력이 될 선수 Profile 을 members 에 두고, Event 참가자에는
-- 그 시점 값을 굳히는 snapshot 컬럼을 둔다.
--
--   members
--     gender             male | female | unspecified      (기본 unspecified)
--     tennis_start_year  1900~2200 또는 NULL              (연차가 아니라 시작 연도)
--     dominant_hand      right | left | unspecified        (기본 unspecified)
--
--   event_participants
--     gender_snapshot / tennis_start_year_snapshot /
--     dominant_hand_snapshot / rating_snapshot            (전부 NULL 허용)
--
-- 왜 snapshot 인가: 회원 Profile 이 바뀌어도 이미 만들어진 대진의 입력이
-- 남아야 하고, 게스트는 마스터 테이블에 Profile 을 두지 않으며, Event 당일
-- 보정(override)이 필요하다. display_name_snapshot 이 이미 같은 패턴이다.
--
-- 값 표현은 enum 이 아니라 text + CHECK 다. member_role enum 이 환경 간
-- 8 vs 9 로 갈라진 전례가 있고 ALTER TYPE ADD VALUE 는 트랜잭션 안에서 쓸 수
-- 없다. 연도 상한은 불변 CHECK(1900~2200)로 두고 "미래 연도 금지"는 API 가
-- 현재 연도로 검증한다 — CHECK 에 now() 를 넣으면 해가 바뀔 때 기존 행이
-- 위반 상태가 된다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일
-- ------------------------------------------------------------
--   [1] members  컬럼 3개 추가
--   [2] event_participants  snapshot 컬럼 4개 추가
--   [3] _event_participant_upsert 재정의 — 회원 참가자를 새로 만들 때
--       members Profile 과 rating 을 snapshot 으로 복사한다.
--       (create_event_participant / import_..._from_attendance 가 공유하는
--        단일 INSERT 지점이라 두 경로가 함께 적용된다.)
--   [4] set_event_participant_profile 신규 — Admin 이 참가자 snapshot 을
--       직접 수정(override)한다.
--
-- 건드리지 않는 것: guests 마스터, 기존 행 데이터(backfill 0건),
--   ACL/RLS/policy, Public RPC 반환 계약, member_stats,
--   events.match_config, event_games provenance, 자동 대진 로직.
-- ============================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ------------------------------------------------------------
-- [1] members
-- ------------------------------------------------------------
alter table public.members
  add column if not exists gender text not null default 'unspecified',
  add column if not exists tennis_start_year smallint,
  add column if not exists dominant_hand text not null default 'unspecified';

alter table public.members
  add constraint members_gender_check
  check (gender in ('male', 'female', 'unspecified'));

alter table public.members
  add constraint members_tennis_start_year_check
  check (tennis_start_year is null or tennis_start_year between 1900 and 2200);

alter table public.members
  add constraint members_dominant_hand_check
  check (dominant_hand in ('right', 'left', 'unspecified'));

comment on column public.members.gender is
  '자동 대진용. male | female | unspecified. 미입력은 unspecified.';
comment on column public.members.tennis_start_year is
  '테니스를 시작한 연도. 연차가 아니라 연도를 저장한다(연차는 현재 연도와의 차이로 계산). 모르면 NULL.';
comment on column public.members.dominant_hand is
  '주손. right | left | unspecified. 양손잡이 옵션은 두지 않는다.';

-- ------------------------------------------------------------
-- [2] event_participants snapshot
-- ------------------------------------------------------------
alter table public.event_participants
  add column if not exists gender_snapshot text,
  add column if not exists tennis_start_year_snapshot smallint,
  add column if not exists dominant_hand_snapshot text,
  add column if not exists rating_snapshot integer;

alter table public.event_participants
  add constraint event_participants_gender_snapshot_check
  check (gender_snapshot is null or gender_snapshot in ('male', 'female', 'unspecified'));

alter table public.event_participants
  add constraint event_participants_tennis_start_year_snapshot_check
  check (tennis_start_year_snapshot is null
         or tennis_start_year_snapshot between 1900 and 2200);

alter table public.event_participants
  add constraint event_participants_dominant_hand_snapshot_check
  check (dominant_hand_snapshot is null
         or dominant_hand_snapshot in ('right', 'left', 'unspecified'));

comment on column public.event_participants.gender_snapshot is
  '참가 시점의 성별. 회원은 members 에서 복사하고 게스트는 직접 입력한다. NULL 은 아직 굳지 않은 이행 상태다.';
comment on column public.event_participants.rating_snapshot is
  '참가 시점의 실력 지표. 회원은 members.rating 복사, 게스트는 직접 입력. 당일 보정 가능.';

-- ------------------------------------------------------------
-- [3] _event_participant_upsert — 회원 snapshot 복사 추가
--
-- 0052 원본에서 바뀌는 곳은 INSERT 컬럼 목록과 값뿐이다. signature,
-- 반환 계약(participant_id, outcome), 분기 동작, 권한은 그대로다.
-- 재활성화(reactivated) 경로는 snapshot 을 덮어쓰지 않는다 — 기존 override 를
-- 참가자 재추가가 조용히 되돌리면 안 되기 때문이다.
-- ------------------------------------------------------------
create or replace function public._event_participant_upsert(
  p_event_id uuid,
  p_club_id uuid,
  p_participant_type text,
  p_member_id uuid,
  p_guest_id uuid,
  p_display_name text,
  p_source_type text,
  p_source_attendance_session_id uuid,
  p_source_record_id uuid
) returns table(participant_id uuid, outcome text)
language plpgsql
set search_path = ''
as $$
declare
  v_existing public.event_participants%rowtype;
  v_new_id uuid;
  v_gender text;
  v_start_year smallint;
  v_hand text;
  v_rating integer;
begin
  if p_member_id is not null then
    select * into v_existing
    from public.event_participants
    where event_id = p_event_id and member_id = p_member_id
    for update;
  else
    select * into v_existing
    from public.event_participants
    where event_id = p_event_id and guest_id = p_guest_id
    for update;
  end if;

  if not found then
    -- 회원이면 현재 Profile 을 굳힌다. 게스트는 NULL 로 두고 Admin 이 입력한다.
    if p_member_id is not null then
      select m.gender, m.tennis_start_year, m.dominant_hand, m.rating
        into v_gender, v_start_year, v_hand, v_rating
        from public.members m
       where m.id = p_member_id and m.club_id = p_club_id;
    end if;

    insert into public.event_participants (
      event_id, club_id, participant_type, member_id, guest_id, display_name_snapshot,
      source_type, source_attendance_session_id, source_record_id, status, is_active,
      gender_snapshot, tennis_start_year_snapshot, dominant_hand_snapshot, rating_snapshot
    ) values (
      p_event_id, p_club_id, p_participant_type, p_member_id, p_guest_id, p_display_name,
      p_source_type, p_source_attendance_session_id, p_source_record_id, 'pending', true,
      v_gender, v_start_year, v_hand, v_rating
    )
    returning id into v_new_id;
    return query select v_new_id, 'inserted'::text;

  elsif v_existing.is_active then
    return query select v_existing.id, 'skipped_active'::text;

  elsif v_existing.status = 'excluded' then
    return query select v_existing.id, 'skipped_excluded'::text;

  else
    update public.event_participants
    set is_active = true,
        status = 'pending',
        display_name_snapshot = p_display_name,
        source_type = p_source_type,
        source_attendance_session_id = p_source_attendance_session_id,
        source_record_id = p_source_record_id,
        updated_at = now()
    where id = v_existing.id;
    return query select v_existing.id, 'reactivated'::text;
  end if;
end;
$$;

revoke all on function public._event_participant_upsert(uuid, uuid, text, uuid, uuid, text, text, uuid, uuid)
from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- [4] set_event_participant_profile — Admin snapshot override
--
-- 네 값을 한 번에 교체한다. NULL 을 넘기면 그 필드는 "모름"으로 되돌린다
-- (부분 갱신이 아니라 전체 교체이므로 호출자가 현재 값을 함께 보낸다).
-- Club/Event scope 는 인자로 강제하고, 존재하지 않으면 타 Club 인지 구분할 수
-- 없는 동일한 오류를 던진다.
-- ------------------------------------------------------------
create or replace function public.set_event_participant_profile(
  p_participant_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_gender text,
  p_tennis_start_year integer,
  p_dominant_hand text,
  p_rating integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
begin
  if p_gender is not null and p_gender not in ('male', 'female', 'unspecified') then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: gender';
  end if;
  if p_dominant_hand is not null and p_dominant_hand not in ('right', 'left', 'unspecified') then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: dominant_hand';
  end if;
  if p_tennis_start_year is not null and (p_tennis_start_year < 1900 or p_tennis_start_year > 2200) then
    raise exception 'EVENT_PARTICIPANT_PROFILE_INVALID: tennis_start_year';
  end if;

  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
  end if;

  update public.event_participants
  set gender_snapshot = p_gender,
      tennis_start_year_snapshot = p_tennis_start_year::smallint,
      dominant_hand_snapshot = p_dominant_hand,
      rating_snapshot = p_rating,
      updated_at = now()
  where id = p_participant_id and event_id = p_event_id and club_id = p_club_id;

  if not found then
    raise exception 'EVENT_PARTICIPANT_NOT_FOUND';
  end if;
end;
$$;

revoke all privileges on function
  public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text, integer)
from public, anon, authenticated;

grant execute on function
  public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text, integer)
to service_role;

commit;

-- ============================================================
-- ROLLBACK (긴급 복구용. 실행 전 별도 승인 필요.)
--
--   begin;
--   drop function if exists public.set_event_participant_profile(uuid, uuid, uuid, text, integer, text, integer);
--   alter table public.event_participants
--     drop column if exists gender_snapshot,
--     drop column if exists tennis_start_year_snapshot,
--     drop column if exists dominant_hand_snapshot,
--     drop column if exists rating_snapshot;
--   alter table public.members
--     drop column if exists gender,
--     drop column if exists tennis_start_year,
--     drop column if exists dominant_hand;
--   -- _event_participant_upsert 는 0052 원본 정의로 되돌려야 한다.
--   commit;
-- ============================================================
