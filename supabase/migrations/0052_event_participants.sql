-- ============================================================
-- 0052: event_participants (Match System 2.0 Phase 2A-3)
--
-- 브리지 정책(D안, 확정): attendance_sessions/attendance/session_guests/
-- members/guests 스키마는 이번 migration에서 전혀 변경하지 않는다. 영속
-- 브리지 컬럼/테이블 없음. import RPC만 attendance 도메인을 읽기 전용으로
-- 조회하며, 자동 trigger 없음. 같은 Event에 서로 다른 attendance session을
-- 여러 번 반복 import할 수 있다(identity는 session이 아니라
-- event_id+member_id/guest_id).
--
-- identity 모델: event_participants는 "이벤트당 회원/게스트 1명당 평생
-- 1행"이다. event_courts/event_sessions의 "활성 행끼리만 유니크"와
-- 의도적으로 다르다 — unique(event_id, member_id)/unique(event_id, guest_id)
-- 는 is_active 무관 완전 유니크. 비활성(withdrawn) 참가자를 다시 추가하면
-- 새 행이 아니라 기존 행을 pending/active로 복구한다. excluded는 운영자의
-- 명시적 제외 결정이므로 import가 자동으로 되살리지 않는다 — 해제는
-- update_event_participant로만 가능(EVENT_PARTICIPANT_EXCLUDED).
--
-- 라이브 실측 확정(2026-08-06):
--   - attendance_sessions.club_id: uuid not null
--   - members/guests composite unique: (club_id, id) — club_id가 선두라
--     FK도 반드시 (club_id, member_id) references members(club_id, id)
--     순서로 맞춘다(참조 컬럼과 위치 정렬이 안 맞으면 완전히 다른 의미가 됨).
--   - members.name/guests.name: text not null
--   - members.is_active/guests.is_active: boolean not null
--   - members.deleted_at: timestamptz null(soft delete, is_active와 별개 컬럼)
--   - attendance.member_id -> members.id, session_guests.guest_id -> guests.id
--   - attendance.id/session_guests.id: uuid
--   - event_participants/RPC 이름 충돌 0건, 관련 constraint/index 이름 충돌 0건
--   - cross-club corruption(attendance.member 소속 불일치, session_guests.guest
--     소속 불일치) 라이브 데이터 0/0건
--
-- 잠금 순서(전역): events가 항상 최우선(FOR UPDATE). attendance_sessions/
-- attendance/session_guests/members/guests는 이 migration의 어떤 함수도
-- 잠그지 않는다(잠금 없는 일반 SELECT만, 단발성 soft-delete UPDATE 경로
-- app/api/members/[id]/route.ts, app/api/guests/[id]/route.ts를 직접
-- 확인해 잠금 불필요함을 근거로 확정 — 해당 코드 참고).
--
-- import는 member/guest 후보를 각각 4개 병렬 배열(id, source_record_id,
-- display_name, is_active)로 한 번에 materialize한 뒤, 그 이후로는
-- attendance/session_guests/members/guests를 다시 읽지 않는다.
-- materialize 전 cross-club corruption을 별도로 먼저 검증해 조용히
-- 걸러내지 않고 하드 오류로 전체 중단한다.
-- ============================================================

begin;

-- ============================================================
-- 1) event_participants
-- ============================================================
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  club_id uuid not null,
  participant_type text not null,
  member_id uuid,
  guest_id uuid,
  display_name_snapshot text not null,
  source_type text not null default 'manual',
  source_attendance_session_id uuid,
  source_record_id uuid,
  status text not null default 'pending',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_participants_participant_type_check
    check (participant_type in ('member', 'guest')),
  constraint event_participants_member_xor_guest_check
    check (
      (participant_type = 'member' and member_id is not null and guest_id is null)
      or (participant_type = 'guest' and guest_id is not null and member_id is null)
    ),
  constraint event_participants_status_check
    check (status in ('pending', 'confirmed', 'withdrawn', 'excluded')),
  constraint event_participants_status_active_consistency_check
    check (
      (status in ('pending', 'confirmed') and is_active)
      or (status in ('withdrawn', 'excluded') and not is_active)
    ),
  constraint event_participants_source_type_check
    check (source_type in ('manual', 'attendance_member', 'session_guest')),
  constraint event_participants_source_consistency_check
    check (
      (source_type = 'manual' and source_attendance_session_id is null and source_record_id is null)
      or (source_type in ('attendance_member', 'session_guest')
          and source_attendance_session_id is not null and source_record_id is not null)
    ),
  constraint event_participants_display_name_not_blank_check
    check (btrim(display_name_snapshot) <> ''),
  constraint event_participants_source_participant_type_consistency_check
    check (
      (source_type = 'manual')
      or (source_type = 'attendance_member' and participant_type = 'member')
      or (source_type = 'session_guest' and participant_type = 'guest')
    ),

  constraint event_participants_id_event_club_uniq unique (id, event_id, club_id),
  constraint event_participants_event_club_fk
    foreign key (event_id, club_id) references public.events (id, club_id),
  constraint event_participants_member_club_fk
    foreign key (club_id, member_id) references public.members (club_id, id),
  constraint event_participants_guest_club_fk
    foreign key (club_id, guest_id) references public.guests (club_id, id)
);

comment on table public.event_participants is
  'Match System 2.0 — Event 참가자(0052). attendance_sessions/attendance/
   session_guests는 이 테이블의 소스로 "읽히기만" 할 뿐 어떤 FK/트리거로도
   연결되지 않는다(D안 — 영속 브리지 없음). identity는 event_id+member_id
   또는 event_id+guest_id이고 is_active 무관 완전 유니크 — 이벤트당 회원/
   게스트 1명당 평생 1행이며, 비활성(withdrawn) 후 재추가는 새 행이 아니라
   기존 행 복구다. excluded는 운영자 명시 제외 상태라 import가 자동으로
   되살리지 않는다. 삭제 RPC 없음 — is_active=false(withdrawn/excluded)로만
   비활성화.';

create unique index event_participants_member_uniq
  on public.event_participants (event_id, member_id) where member_id is not null;
create unique index event_participants_guest_uniq
  on public.event_participants (event_id, guest_id) where guest_id is not null;
create index event_participants_event_roster_idx
  on public.event_participants (event_id, is_active, status);

alter table public.event_participants enable row level security;
-- 정책 0개 — anon/authenticated는 GRANT 자체가 없어 정책 여부와 무관하게 접근 불가.
revoke all on public.event_participants from public, anon, authenticated, service_role;
grant select on public.event_participants to service_role;
-- INSERT/UPDATE/DELETE는 어떤 role에도 부여하지 않는다 — 쓰기는 아래 RPC 전용.

-- ============================================================
-- 2) 비공개 helper — identity 매칭 후 insert/skip/reactivate 공통 로직
--    (SECURITY DEFINER 아님, EXECUTE 전부 revoke). create_event_participant와
--    import_event_participants_from_attendance가 동일 분기(없음/active/
--    excluded/withdrawn)를 중복 구현하지 않도록 공유한다. 0045/0051의
--    private helper 패턴과 동일 원리.
-- ============================================================
create function public._event_participant_upsert(
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
    insert into public.event_participants (
      event_id, club_id, participant_type, member_id, guest_id, display_name_snapshot,
      source_type, source_attendance_session_id, source_record_id, status, is_active
    ) values (
      p_event_id, p_club_id, p_participant_type, p_member_id, p_guest_id, p_display_name,
      p_source_type, p_source_attendance_session_id, p_source_record_id, 'pending', true
    )
    returning id into v_new_id;

    return query select v_new_id, 'inserted'::text;
  elsif v_existing.is_active then
    return query select v_existing.id, 'skipped_active'::text;
  elsif v_existing.status = 'excluded' then
    return query select v_existing.id, 'skipped_excluded'::text;
  else
    -- withdrawn -> 재활성화. snapshot/source는 이번 호출 기준으로 갱신한다
    -- (재활성화도 "지금 다시 추가되는 사건"이라는 원칙).
    update public.event_participants set
      status = 'pending',
      is_active = true,
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

-- ============================================================
-- 3) import_event_participants_from_attendance
-- ============================================================
create function public.import_event_participants_from_attendance(
  p_event_id uuid,
  p_club_id uuid,
  p_attendance_session_id uuid
) returns table(
  inserted_count integer,
  reactivated_count integer,
  skipped_duplicate_count integer,
  skipped_excluded_count integer,
  skipped_inactive_member_count integer,
  skipped_inactive_guest_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_session_club_id uuid;

  v_inserted integer := 0;
  v_reactivated integer := 0;
  v_skipped_duplicate integer := 0;
  v_skipped_excluded integer := 0;
  v_skipped_inactive_member integer := 0;
  v_skipped_inactive_guest integer := 0;
  v_any_change boolean := false;

  v_member_record_ids uuid[];
  v_member_ids uuid[];
  v_member_names text[];
  v_member_actives boolean[];

  v_guest_record_ids uuid[];
  v_guest_ids uuid[];
  v_guest_names text[];
  v_guest_actives boolean[];

  i integer;
  v_snapshot text;
  v_pid uuid;
  v_outcome text;
begin
  -- events FOR UPDATE — court/session 계열과 동일하게 events가 최우선 락.
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  -- attendance_session club scope 확인(잠금 없는 단순 SELECT)
  select club_id into v_session_club_id
  from public.attendance_sessions
  where id = p_attendance_session_id;

  if not found or v_session_club_id <> p_club_id then
    raise exception 'ATTENDANCE_SESSION_NOT_FOUND';
  end if;

  -- cross-club corruption 선검증(materialize 전에 먼저) — member
  perform 1 from public.attendance a
  join public.members m on m.id = a.member_id
  where a.session_id = p_attendance_session_id
    and a.status = 'attending'
    and m.club_id <> p_club_id;
  if found then
    raise exception 'ATTENDANCE_MEMBER_SCOPE_INVALID';
  end if;

  -- cross-club corruption 선검증 — guest
  perform 1 from public.session_guests sg
  join public.guests g on g.id = sg.guest_id
  where sg.session_id = p_attendance_session_id
    and g.club_id <> p_club_id;
  if found then
    raise exception 'SESSION_GUEST_SCOPE_INVALID';
  end if;

  -- member 후보 materialize(단일 쿼리, 잠금 없음) — 4개 배열 전부 member_id
  -- 오름차순으로 정렬해 인덱스가 항상 같은 후보를 가리키게 한다.
  select
    coalesce(array_agg(a.id order by a.member_id), array[]::uuid[]),
    coalesce(array_agg(a.member_id order by a.member_id), array[]::uuid[]),
    coalesce(array_agg(m.name order by a.member_id), array[]::text[]),
    coalesce(array_agg(m.is_active order by a.member_id), array[]::boolean[])
  into v_member_record_ids, v_member_ids, v_member_names, v_member_actives
  from public.attendance a
  join public.members m on m.id = a.member_id and m.club_id = p_club_id
  where a.session_id = p_attendance_session_id and a.status = 'attending';

  -- guest 후보 materialize(단일 쿼리, 잠금 없음)
  select
    coalesce(array_agg(sg.id order by sg.guest_id), array[]::uuid[]),
    coalesce(array_agg(sg.guest_id order by sg.guest_id), array[]::uuid[]),
    coalesce(array_agg(g.name order by sg.guest_id), array[]::text[]),
    coalesce(array_agg(g.is_active order by sg.guest_id), array[]::boolean[])
  into v_guest_record_ids, v_guest_ids, v_guest_names, v_guest_actives
  from public.session_guests sg
  join public.guests g on g.id = sg.guest_id and g.club_id = p_club_id
  where sg.session_id = p_attendance_session_id;

  -- 이 시점 이후 attendance/session_guests/members/guests를 다시 읽지 않는다.

  -- member 후보 처리(오름차순 고정, 0045 "member 먼저" 컨벤션)
  for i in 1 .. coalesce(array_length(v_member_ids, 1), 0) loop
    if not v_member_actives[i] then
      v_skipped_inactive_member := v_skipped_inactive_member + 1;
      continue;
    end if;

    v_snapshot := btrim(v_member_names[i]);
    if v_snapshot = '' then
      raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
    end if;

    select participant_id, outcome into v_pid, v_outcome
    from public._event_participant_upsert(
      p_event_id, p_club_id, 'member', v_member_ids[i], null, v_snapshot,
      'attendance_member', p_attendance_session_id, v_member_record_ids[i]
    );

    if v_outcome = 'inserted' then
      v_inserted := v_inserted + 1;
      v_any_change := true;
    elsif v_outcome = 'reactivated' then
      v_reactivated := v_reactivated + 1;
      v_any_change := true;
    elsif v_outcome = 'skipped_active' then
      v_skipped_duplicate := v_skipped_duplicate + 1;
    elsif v_outcome = 'skipped_excluded' then
      v_skipped_excluded := v_skipped_excluded + 1;
    end if;
  end loop;

  -- guest 후보 처리(오름차순 고정, member 다음)
  for i in 1 .. coalesce(array_length(v_guest_ids, 1), 0) loop
    if not v_guest_actives[i] then
      v_skipped_inactive_guest := v_skipped_inactive_guest + 1;
      continue;
    end if;

    v_snapshot := btrim(v_guest_names[i]);
    if v_snapshot = '' then
      raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
    end if;

    select participant_id, outcome into v_pid, v_outcome
    from public._event_participant_upsert(
      p_event_id, p_club_id, 'guest', null, v_guest_ids[i], v_snapshot,
      'session_guest', p_attendance_session_id, v_guest_record_ids[i]
    );

    if v_outcome = 'inserted' then
      v_inserted := v_inserted + 1;
      v_any_change := true;
    elsif v_outcome = 'reactivated' then
      v_reactivated := v_reactivated + 1;
      v_any_change := true;
    elsif v_outcome = 'skipped_active' then
      v_skipped_duplicate := v_skipped_duplicate + 1;
    elsif v_outcome = 'skipped_excluded' then
      v_skipped_excluded := v_skipped_excluded + 1;
    end if;
  end loop;

  if v_any_change then
    update public.events set participants_confirmed_at = null where id = p_event_id;
  end if;

  return query select
    v_inserted, v_reactivated, v_skipped_duplicate, v_skipped_excluded,
    v_skipped_inactive_member, v_skipped_inactive_guest;
end;
$$;

-- ============================================================
-- 4) create_event_participant
-- ============================================================
create function public.create_event_participant(
  p_event_id uuid,
  p_club_id uuid,
  p_member_id uuid default null,
  p_guest_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participant_type text;
  v_snapshot text;
  v_target_active boolean;
  v_pid uuid;
  v_outcome text;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  if (p_member_id is not null) = (p_guest_id is not null) then
    raise exception 'INVALID_PARTICIPANT_SELECTOR';
  end if;

  -- 대상 member/guest 자체의 존재/club/활성 여부를 identity 매칭보다 먼저 확인.
  if p_member_id is not null then
    v_participant_type := 'member';
    select name, is_active into v_snapshot, v_target_active
    from public.members
    where id = p_member_id and club_id = p_club_id;

    if not found then
      raise exception 'PARTICIPANT_MEMBER_NOT_FOUND';
    end if;
    if not v_target_active then
      raise exception 'PARTICIPANT_MEMBER_INACTIVE';
    end if;
  else
    v_participant_type := 'guest';
    select name, is_active into v_snapshot, v_target_active
    from public.guests
    where id = p_guest_id and club_id = p_club_id;

    if not found then
      raise exception 'PARTICIPANT_GUEST_NOT_FOUND';
    end if;
    if not v_target_active then
      raise exception 'PARTICIPANT_GUEST_INACTIVE';
    end if;
  end if;

  v_snapshot := btrim(v_snapshot);
  if v_snapshot = '' then
    raise exception 'PARTICIPANT_DISPLAY_NAME_BLANK';
  end if;

  select participant_id, outcome into v_pid, v_outcome
  from public._event_participant_upsert(
    p_event_id, p_club_id, v_participant_type, p_member_id, p_guest_id, v_snapshot,
    'manual', null, null
  );

  if v_outcome = 'skipped_active' then
    raise exception 'EVENT_PARTICIPANT_ALREADY_ACTIVE';
  elsif v_outcome = 'skipped_excluded' then
    raise exception 'EVENT_PARTICIPANT_EXCLUDED';
  end if;

  -- 'inserted' 또는 'reactivated' — 둘 다 실질 변경이므로 항상 무효화.
  update public.events set participants_confirmed_at = null where id = p_event_id;

  return v_pid;
end;
$$;

-- ============================================================
-- 5) update_event_participant
-- ============================================================
create function public.update_event_participant(
  p_participant_id uuid,
  p_event_id uuid,
  p_club_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participant public.event_participants%rowtype;
  v_new_is_active boolean;
begin
  select status into v_event_status
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  if p_status not in ('pending', 'confirmed', 'withdrawn', 'excluded') then
    raise exception 'INVALID_PARTICIPANT_STATUS';
  end if;

  select * into v_participant
  from public.event_participants
  where id = p_participant_id and event_id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_PARTICIPANT_NOT_FOUND';
  end if;

  if p_status = v_participant.status then
    return; -- no-op: 무효화도 하지 않는다.
  end if;

  v_new_is_active := p_status in ('pending', 'confirmed');

  update public.event_participants set
    status = p_status,
    is_active = v_new_is_active,
    updated_at = now()
  where id = p_participant_id;

  update public.events set participants_confirmed_at = null where id = p_event_id;
end;
$$;

-- ============================================================
-- 6) confirm_event_participants — strict idempotency(매 호출 timestamp
--    갱신 방식 폐기, 3-분기 확정)
-- ============================================================
create function public.confirm_event_participants(
  p_event_id uuid,
  p_club_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_confirmed_at timestamptz;
  v_active_count integer;
  v_pending_count integer;
  v_transitioned integer;
begin
  select status, participants_confirmed_at into v_event_status, v_confirmed_at
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status in ('completed', 'cancelled') then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;

  select count(*) into v_active_count
  from public.event_participants
  where event_id = p_event_id and is_active;

  if v_active_count = 0 then
    raise exception 'EVENT_NO_ACTIVE_PARTICIPANTS';
  end if;

  select count(*) into v_pending_count
  from public.event_participants
  where event_id = p_event_id and is_active and status = 'pending';

  if v_pending_count > 0 then
    update public.event_participants
    set status = 'confirmed', updated_at = now()
    where event_id = p_event_id and is_active and status = 'pending';

    get diagnostics v_transitioned = row_count;

    update public.events set participants_confirmed_at = now() where id = p_event_id;

    return v_transitioned;
  end if;

  -- pending = 0: 참가자 row는 절대 건드리지 않는다.
  if v_confirmed_at is null then
    -- 최초 확정 — 개별 참가자가 이미 다 confirmed 상태(수동 전환 등)였더라도
    -- Event 레벨 확정 타임스탬프는 아직 없었으므로 지금 찍는다.
    update public.events set participants_confirmed_at = now() where id = p_event_id;
  end if;
  -- v_confirmed_at is not null: 완전 no-op(타임스탬프도 건드리지 않음).

  return 0;
end;
$$;

-- ============================================================
-- 7) RPC 권한
-- ============================================================
revoke all on function public.import_event_participants_from_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.import_event_participants_from_attendance(uuid, uuid, uuid)
  to service_role;

revoke all on function public.create_event_participant(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_event_participant(uuid, uuid, uuid, uuid)
  to service_role;

revoke all on function public.update_event_participant(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_event_participant(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.confirm_event_participants(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_event_participants(uuid, uuid)
  to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- attendance/events 스키마는 이 migration이 전혀 건드리지 않았으므로
-- 복원할 다른 테이블/함수가 없다 — event_participants 관련 객체만 제거.
-- ============================================================
-- begin;
--
-- drop function if exists public.confirm_event_participants(uuid, uuid);
-- drop function if exists public.update_event_participant(uuid, uuid, uuid, text);
-- drop function if exists public.create_event_participant(uuid, uuid, uuid, uuid);
-- drop function if exists public.import_event_participants_from_attendance(uuid, uuid, uuid);
-- drop function if exists public._event_participant_upsert(uuid, uuid, text, uuid, uuid, text, text, uuid, uuid);
-- drop table if exists public.event_participants;
--
-- commit;
