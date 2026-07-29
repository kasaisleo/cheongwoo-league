-- ============================================================
-- 0047: 출석 세션(attendance_sessions) 생성 idempotency + 원자화
--        (Match Engine P3, 설계안 A — matches 0046과 동일 패턴)
--
-- 배경:
--   app/api/admin/sessions/route.ts("+ 매치 직접 추가")는 attendance_sessions
--   insert와 활성 회원 전체 attendance insert를 별도의 두 PostgREST 호출로
--   수행하며, (1) 서버 측 중복 방지가 전혀 없고 (2) attendance insert 실패를
--   무시한다(insertError 미확인) — 두 번째 문제는 P1이 matches에서 고친 것과
--   동일한 유형의 원자성 결함이다.
--
-- 설계안 A(matches 0046과 동일한 A+ 패턴):
--   1) attendance_sessions.idempotency_key uuid nullable +
--      (club_id, idempotency_key) partial unique index.
--   2) 같은 key로 재요청이 오면 저장된 행과 요청 payload(title/session_date/
--      session_day)를 전부 비교한다. 동일하면 기존 session_id를 반환(멱등),
--      하나라도 다르면 SESSION_IDEMPOTENCY_CONFLICT로 실패시킨다(route에서 409).
--   3) attendance_sessions insert + 활성 회원 attendance insert를 단일 함수
--      호출(=단일 트랜잭션)로 묶어 원자성 결함도 함께 해소한다.
--
-- 회원 선정 범위는 기존 route.ts 동작과 정확히 동일하게 유지한다(정책 변경
-- 없음): m.club_id = p_club_id and m.is_active = true 뿐 — is_dormant,
-- deleted_at(애초에 컬럼 없음), member_type, permission_role 조건 추가 없음.
-- attendance.club_id 컬럼은 존재하지 않으므로 insert 대상에 포함하지 않는다.
--
-- 클럽 활성 판정은 clubs.status = 'active'를 쓴다(clubs.is_active 컬럼은
-- 애초에 존재하지 않음 — matches 0045/0046의 CLUB_INACTIVE 판정과 동일 조건).
--
-- 이번 migration이 하는 일:
--   1) attendance_sessions.idempotency_key 컬럼 + partial unique index 추가.
--   2) _session_idempotency_payload_matches 비공개 helper 신설.
--   3) create_session_with_attendance(신규 함수) 생성 — 기존 시그니처를
--      바꾸는 것이 아니므로 DROP-then-CREATE 불필요(순수 신규).
--   4) REVOKE/GRANT(service_role 전용) + NOTIFY pgrst.
--
-- 이번 migration이 하지 않는 일:
--   - attendance_sessions/attendance 테이블 자체의 GRANT/RLS 정책 변경 없음.
--   - weekly/custom/archive 세 엔드포인트는 무변경(이번 P3 범위 밖).
--   - 콘텐츠 기반 "같은 날짜+구분 중복 금지" 정책 추가 없음(요청-재시도
--     안전성과는 별개 concern — 별도 논의 필요, 이번엔 다루지 않는다).
--   - is_dormant 회원 제외, created_by 채우기: 전부 범위 밖.
--   - 데이터 변경(DML) 없음. 기존 행의 idempotency_key는 전부 null이며
--     partial index 대상이 아니라 서로 충돌하지 않는다 — backfill 불필요.
--
-- 알려진 한계(수용됨):
--   세션이 삭제/보관되어도(현재 API에 세션 삭제 자체가 없음) idempotency_key는
--   테이블에 남는다. 영구 tombstone이 필요해지면 별도 ledger를 후속 설계한다.
--   attendance_sessions.club_id 컬럼 자체가 어느 migration 파일에도 ALTER로
--   기록되어 있지 않은 기존 gap(0011~0019 결번 구간)이 있으나, 라이브 스키마에
--   이미 존재함을 별도로 확인했다(이번 migration은 이 gap을 다루지 않는다).
-- ============================================================

begin;

-- ============================================================
-- 1) attendance_sessions.idempotency_key + partial unique index
-- ============================================================

alter table public.attendance_sessions
  add column if not exists idempotency_key uuid;

comment on column public.attendance_sessions.idempotency_key is
  '세션 생성 요청 식별자. 클라이언트가 crypto.randomUUID()로 발급해 전달한다.
   (club_id, idempotency_key) partial unique로 중복 생성을 DB 레벨에서 차단한다.
   기존 행과 key 미전달 호출은 null이며 partial index 대상이 아니다.';

create unique index if not exists attendance_sessions_club_idempotency_key_uniq
  on public.attendance_sessions (club_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================
-- 2) 비공개 helper — payload 비교 술어 (SECURITY DEFINER 아님)
-- ============================================================
-- 비교 대상: club_id, session_date, session_day, title(트림 후 값).
-- title은 호출자가 이미 btrim한 값을 넘긴다는 전제 — 이 함수 자체는
-- 정규화를 하지 않고 순수 비교만 한다(정규화 위치를 한 곳으로 고정).
create function public._session_idempotency_payload_matches(
  p_existing public.attendance_sessions,
  p_club_id uuid,
  p_session_date date,
  p_session_day public.session_day_type,
  p_title text
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select
        p_existing.club_id      is not distinct from p_club_id
    and p_existing.session_date is not distinct from p_session_date
    and p_existing.session_day  is not distinct from p_session_day
    and p_existing.title        is not distinct from p_title;
$$;

revoke all on function public._session_idempotency_payload_matches(
  public.attendance_sessions, uuid, date, public.session_day_type, text
) from public, anon, authenticated, service_role;

-- ============================================================
-- 3) create_session_with_attendance — 신규 함수(기존 시그니처 변경 아님)
-- ============================================================
create function public.create_session_with_attendance(
  p_club_id uuid,
  p_session_date date,
  p_session_day public.session_day_type,
  p_title text,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.attendance_sessions%rowtype;
  v_title text;
  v_session_id uuid;
  v_rows integer;
begin
  -- ----------------------------------------------------------
  -- [1] 정규화 — title은 여기서 한 번만 trim한다. 이후 idempotency 비교,
  --     insert, 반환까지 전부 이 정규화된 값을 쓴다.
  -- ----------------------------------------------------------
  v_title := btrim(p_title);
  if v_title is null or v_title = '' then
    raise exception 'INVALID_TITLE: title must not be blank';
  end if;

  if p_session_date is null then
    raise exception 'INVALID_SESSION_DATE: session_date is required';
  end if;

  -- ----------------------------------------------------------
  -- [2] idempotency early lookup — 검증보다 먼저 두는 이유는 0046과 동일:
  --     첫 요청 성공 후 클럽이 비활성화된 상태에서 재시도가 와도, 이미
  --     저장된 세션이 있다면 CLUB_INACTIVE보다 멱등 반환이 우선해야 한다.
  -- ----------------------------------------------------------
  if p_idempotency_key is not null then
    select * into v_existing
    from public.attendance_sessions
    where attendance_sessions.club_id = p_club_id
      and attendance_sessions.idempotency_key = p_idempotency_key;

    if found then
      if public._session_idempotency_payload_matches(
           v_existing, p_club_id, p_session_date, p_session_day, v_title
         ) then
        return v_existing.id;
      end if;

      raise exception
        'SESSION_IDEMPOTENCY_CONFLICT: request key already used for a different session payload';
    end if;
  end if;

  -- ----------------------------------------------------------
  -- [3] 클럽 활성 검증 — clubs.status = 'active' (clubs.is_active 컬럼은
  --     존재하지 않는다. matches 0045/0046의 CLUB_NOT_FOUND/CLUB_INACTIVE와
  --     동일한 조건).
  -- ----------------------------------------------------------
  perform 1 from public.clubs where clubs.id = p_club_id;
  if not found then
    raise exception 'CLUB_NOT_FOUND: club % does not exist', p_club_id;
  end if;

  perform 1 from public.clubs where clubs.id = p_club_id and clubs.status = 'active';
  if not found then
    raise exception 'CLUB_INACTIVE: club % is not active', p_club_id;
  end if;

  -- ----------------------------------------------------------
  -- [4] insert — ON CONFLICT DO NOTHING으로 idempotency 인덱스 충돌만
  --     흡수한다(0046과 동일 근거 — 광범위 unique_violation catch 금지).
  -- ----------------------------------------------------------
  insert into public.attendance_sessions (
    session_date, session_day, title, status, club_id, idempotency_key
  ) values (
    p_session_date, p_session_day, v_title, 'open', p_club_id, p_idempotency_key
  )
  on conflict (club_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning attendance_sessions.id into v_session_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    if p_idempotency_key is null then
      raise exception
        'EFFECT_UPDATE_FAILED: attendance_sessions insert affected 0 rows without an idempotency key';
    end if;

    -- 동시 요청이 근소한 차이로 먼저 커밋한 경우.
    select * into v_existing
    from public.attendance_sessions
    where attendance_sessions.club_id = p_club_id
      and attendance_sessions.idempotency_key = p_idempotency_key;

    if not found then
      raise exception
        'SESSION_IDEMPOTENCY_RESOLUTION_FAILED: conflicting row not found after on conflict do nothing';
    end if;

    if public._session_idempotency_payload_matches(
         v_existing, p_club_id, p_session_date, p_session_day, v_title
       ) then
      return v_existing.id;
    end if;

    raise exception
      'SESSION_IDEMPOTENCY_CONFLICT: request key already used for a different session payload';
  elsif v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: attendance_sessions insert affected % rows', v_rows;
  end if;

  -- ----------------------------------------------------------
  -- [5] 활성 회원 전체 attendance 행 생성 — 기존 route.ts와 정확히 동일한
  --     범위(club_id + is_active = true 뿐). 이 INSERT...SELECT는 단일
  --     문(statement)이므로, 한 건이라도 제약 위반이 나면 문 전체가 실패
  --     하고 예외가 그대로 전파된다 — EXCEPTION 블록으로 감싸지 않으므로
  --     함수를 호출한 트랜잭션 전체(=이 함수 호출 1회)가 자동 롤백된다.
  --     attendance.club_id 컬럼은 존재하지 않으므로 삽입 대상에 없다.
  -- ----------------------------------------------------------
  insert into public.attendance (member_id, session_id, event_date, status)
  select m.id, v_session_id, p_session_date, 'undecided'
  from public.members m
  where m.club_id = p_club_id
    and m.is_active = true;

  return v_session_id;
end;
$$;

-- ============================================================
-- 4) 권한 설정 — service_role 전용
-- ============================================================
revoke all on function public.create_session_with_attendance(
  uuid, date, public.session_day_type, text, uuid
) from public, anon, authenticated;

grant execute on function public.create_session_with_attendance(
  uuid, date, public.session_day_type, text, uuid
) to service_role;

-- ============================================================
-- 5) PostgREST 스키마 캐시 갱신 — 신규 함수가 노출되도록 필수.
-- ============================================================
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 적용 후 검증 (별도 실행 — 읽기 전용)
-- ============================================================
-- -- (1) 함수가 정확히 1개, 인자 5개인지
-- select p.oid::regprocedure as signature, p.pronargs as arg_count
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_session_with_attendance';
-- -- 기대: 1행, arg_count = 5
--
-- -- (2) 권한 — 외부 함수는 service_role만, helper는 전부 false
-- select p.oid::regprocedure as signature,
--        p.prosecdef as security_definer,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_exec
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('create_session_with_attendance', '_session_idempotency_payload_matches')
-- order by p.proname;
-- -- 기대: create_session_with_attendance → secdef=true, anon/authenticated=false, service_role=true
-- --       _session_idempotency_payload_matches → secdef=false, 세 역할 모두 false
--
-- -- (3) 인덱스 확인
-- select indexname, indexdef from pg_indexes
-- where schemaname = 'public' and tablename = 'attendance_sessions'
-- order by indexname;
-- -- 기대: attendance_sessions_club_idempotency_key_uniq가 UNIQUE + WHERE 절 포함

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
-- begin;
-- drop function if exists public.create_session_with_attendance(
--   uuid, date, public.session_day_type, text, uuid
-- );
-- drop function if exists public._session_idempotency_payload_matches(
--   public.attendance_sessions, uuid, date, public.session_day_type, text
-- );
-- drop index if exists public.attendance_sessions_club_idempotency_key_uniq;
-- alter table public.attendance_sessions drop column if exists idempotency_key;
-- notify pgrst, 'reload schema';
-- commit;
