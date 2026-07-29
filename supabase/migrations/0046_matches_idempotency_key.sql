-- ============================================================
-- 0046: 경기 생성 idempotency (Match Engine P2, 설계안 A+)
--
-- 배경:
--   POST /api/matches에는 서버 측 중복 방지가 전혀 없어, 네트워크 재시도·
--   브라우저 재전송·응답 유실 후 재시도가 실제 경기와 LP/wins/losses를
--   2배로 반영할 수 있다(P1 Phase 1에서 P0로 분류된 잔여 항목).
--
-- 설계안 A+ (A안 + payload 비교 강제):
--   1) matches.idempotency_key uuid nullable + (club_id, idempotency_key)
--      partial unique index.
--   2) 같은 key로 재요청이 오면 저장된 matches 행과 요청 payload를 **전부**
--      비교한다. 동일하면 기존 match_id를 반환(멱등), 하나라도 다르면
--      IDEMPOTENCY_CONFLICT로 실패시킨다(조용한 무시 금지 — route에서 409).
--   3) nullable 필드 비교는 전부 IS NOT DISTINCT FROM.
--
-- 이번 migration이 하는 일:
--   1) matches.idempotency_key 컬럼 + partial unique index 추가.
--   2) _match_idempotency_payload_matches 비공개 helper 신설 —
--      payload 비교 술어를 단 한 곳에만 두어 두 호출 지점(early-return /
--      ON CONFLICT 이후 재조회) 간 로직 drift를 원천 차단한다.
--   3) 기존 17인자 create_match_with_effects를 **정확한 시그니처로 DROP**한 뒤
--      18인자 신규 함수를 CREATE — CREATE OR REPLACE만 쓰면 구/신 두 개가
--      overload로 공존해 PostgREST가 어느 쪽을 호출할지 모호해진다.
--   4) 신규 시그니처 기준으로 REVOKE/GRANT 재설정(service_role 전용).
--   5) NOTIFY pgrst — PostgREST 스키마 캐시 갱신(시그니처가 바뀌었으므로 필수).
--
-- 이번 migration이 하지 않는 일:
--   - update/delete_match_with_effects 및 기존 helper 3개: 전부 무변경.
--   - 테이블 GRANT/RLS 정책 변경 없음.
--   - 데이터 변경(DML) 없음. 기존 행의 idempotency_key는 전부 null이며,
--     partial index(where idempotency_key is not null) 대상이 아니라
--     서로 충돌하지 않는다 — backfill 불필요.
--
-- 알려진 한계(수용됨):
--   경기가 삭제되면 idempotency_key도 함께 사라진다. 삭제 후 장기 지연된
--   재전송이 도착하면 다시 생성될 수 있다. 영구 tombstone이 필요해지면
--   별도 ledger 테이블을 후속 설계한다.
-- ============================================================

begin;

-- ============================================================
-- 1) matches.idempotency_key + partial unique index
-- ============================================================

alter table public.matches
  add column if not exists idempotency_key uuid;

comment on column public.matches.idempotency_key is
  '경기 생성 요청 식별자. 클라이언트가 crypto.randomUUID()로 발급해 전달한다.
   (club_id, idempotency_key) partial unique로 중복 생성을 DB 레벨에서 차단한다.
   기존 행과 key 미전달 호출은 null이며 partial index 대상이 아니다.';

create unique index if not exists matches_club_idempotency_key_uniq
  on public.matches (club_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================
-- 2) 비공개 helper — payload 비교 술어 (SECURITY DEFINER 아님)
-- ============================================================
-- 비교 대상: club_id, session_id, played_at, score_a/b,
--            **정규화된** tiebreak a/b, winner_team, 참가자 슬롯 8개.
-- p_created_by는 제외한다 — 운영 메타데이터일 뿐 경기의 의미를 구성하지 않고,
-- 현재 항상 null이다.
-- winner_team은 enum이 아니라 text로 비교한다 — 'X' 같은 무효값을 enum으로
-- 캐스팅하면 비교에 도달하기 전에 raw 캐스팅 오류가 터진다.
create function public._match_idempotency_payload_matches(
  p_existing public.matches,
  p_club_id uuid,
  p_session_id uuid,
  p_played_at date,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak_norm integer,
  p_score_b_tiebreak_norm integer,
  p_winner_team text,
  p_team_a_player1_member uuid, p_team_a_player1_guest uuid,
  p_team_a_player2_member uuid, p_team_a_player2_guest uuid,
  p_team_b_player1_member uuid, p_team_b_player1_guest uuid,
  p_team_b_player2_member uuid, p_team_b_player2_guest uuid
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select
        p_existing.club_id               is not distinct from p_club_id
    and p_existing.session_id            is not distinct from p_session_id
    and p_existing.played_at             is not distinct from p_played_at
    and p_existing.score_a               is not distinct from p_score_a
    and p_existing.score_b               is not distinct from p_score_b
    and p_existing.score_a_tiebreak      is not distinct from p_score_a_tiebreak_norm
    and p_existing.score_b_tiebreak      is not distinct from p_score_b_tiebreak_norm
    and p_existing.winner_team::text     is not distinct from p_winner_team
    and p_existing.team_a_player1_member is not distinct from p_team_a_player1_member
    and p_existing.team_a_player1_guest  is not distinct from p_team_a_player1_guest
    and p_existing.team_a_player2_member is not distinct from p_team_a_player2_member
    and p_existing.team_a_player2_guest  is not distinct from p_team_a_player2_guest
    and p_existing.team_b_player1_member is not distinct from p_team_b_player1_member
    and p_existing.team_b_player1_guest  is not distinct from p_team_b_player1_guest
    and p_existing.team_b_player2_member is not distinct from p_team_b_player2_member
    and p_existing.team_b_player2_guest  is not distinct from p_team_b_player2_guest;
$$;

revoke all on function public._match_idempotency_payload_matches(
  public.matches, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

-- ============================================================
-- 3) 기존 17인자 함수 DROP (overload 방지 — 정확한 시그니처 지정)
-- ============================================================
drop function if exists public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
);

-- ============================================================
-- 4) 신규 18인자 create_match_with_effects
-- ============================================================
create function public.create_match_with_effects(
  p_club_id uuid,
  p_session_id uuid,
  p_played_at date,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer,
  p_score_b_tiebreak integer,
  p_winner_team text,
  p_team_a_player1_member uuid, p_team_a_player1_guest uuid,
  p_team_a_player2_member uuid, p_team_a_player2_guest uuid,
  p_team_b_player1_member uuid, p_team_b_player1_guest uuid,
  p_team_b_player2_member uuid, p_team_b_player2_guest uuid,
  p_created_by uuid default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.matches%rowtype;
  v_session_status text;
  v_member_ids uuid[] := array[]::uuid[];
  v_member_won boolean[] := array[]::boolean[];
  v_guest_ids uuid[] := array[]::uuid[];
  v_guest_won boolean[] := array[]::boolean[];
  v_keys text[];
  v_match_id uuid;
  v_rows integer;
  v_team_a_won boolean;
  v_team_b_won boolean;
  v_is_tiebreak_set boolean;
  v_final_score_a_tiebreak integer;
  v_final_score_b_tiebreak integer;
begin
  -- ----------------------------------------------------------
  -- [1] 타이브레이크 정규화 — 순수 계산(DB 접근·검증 없음).
  --     idempotency 비교 대상이 "정규화된" tiebreak 값이므로 조회보다 먼저
  --     계산돼야 한다. score가 null이어도 여기서 터지지 않도록 coalesce로
  --     감싼다(유효성은 아래 [3]에서 판정).
  -- ----------------------------------------------------------
  v_is_tiebreak_set := coalesce(
    (p_score_a = 7 and p_score_b = 6) or (p_score_a = 6 and p_score_b = 7),
    false
  );
  if v_is_tiebreak_set then
    v_final_score_a_tiebreak := p_score_a_tiebreak;
    v_final_score_b_tiebreak := p_score_b_tiebreak;
  else
    v_final_score_a_tiebreak := null;
    v_final_score_b_tiebreak := null;
  end if;

  -- ----------------------------------------------------------
  -- [2] idempotency early lookup.
  --     검증보다 앞에 두는 이유: 첫 요청이 성공한 뒤 세션이 archived로
  --     바뀌거나 클럽이 비활성화된 상태에서 재시도가 오면, 검증-우선
  --     순서에서는 이미 저장된 경기가 있는데도 SESSION_ARCHIVED 등으로
  --     실패한다 — 멱등성의 목적에 어긋난다.
  -- ----------------------------------------------------------
  if p_idempotency_key is not null then
    select * into v_existing
    from public.matches
    where matches.club_id = p_club_id
      and matches.idempotency_key = p_idempotency_key;

    if found then
      if public._match_idempotency_payload_matches(
           v_existing, p_club_id, p_session_id, p_played_at,
           p_score_a, p_score_b,
           v_final_score_a_tiebreak, v_final_score_b_tiebreak,
           p_winner_team,
           p_team_a_player1_member, p_team_a_player1_guest,
           p_team_a_player2_member, p_team_a_player2_guest,
           p_team_b_player1_member, p_team_b_player1_guest,
           p_team_b_player2_member, p_team_b_player2_guest
         ) then
        -- 완전히 동일한 요청의 재전송 — 효과를 다시 적용하지 않고 즉시 반환.
        return v_existing.id;
      end if;

      raise exception
        'IDEMPOTENCY_CONFLICT: request key already used for a different match payload';
    end if;
  end if;

  -- ----------------------------------------------------------
  -- [3] 검증 (0045 원문 유지)
  -- ----------------------------------------------------------
  perform 1 from public.clubs where clubs.id = p_club_id;
  if not found then
    raise exception 'CLUB_NOT_FOUND: club % does not exist', p_club_id;
  end if;

  perform 1 from public.clubs where clubs.id = p_club_id and clubs.status = 'active';
  if not found then
    raise exception 'CLUB_INACTIVE: club % is not active', p_club_id;
  end if;

  select attendance_sessions.status into v_session_status
  from public.attendance_sessions
  where attendance_sessions.id = p_session_id
    and attendance_sessions.club_id = p_club_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND: session % not found in club', p_session_id;
  end if;
  if v_session_status = 'archived' then
    raise exception 'SESSION_ARCHIVED: session % is archived', p_session_id;
  end if;

  if p_winner_team not in ('A', 'B') then
    raise exception 'INVALID_WINNER_TEAM: % is not A or B', p_winner_team;
  end if;

  if p_score_a is null or p_score_a < 0 or p_score_a > 7
     or p_score_b is null or p_score_b < 0 or p_score_b > 7 then
    raise exception 'INVALID_SCORE: score_a=%, score_b=% out of range', p_score_a, p_score_b;
  end if;

  -- 타이브레이크 유효성 — 정규화는 [1]에서 이미 끝났고 여기서는 판정만 한다.
  if v_is_tiebreak_set then
    if p_score_a_tiebreak is null or p_score_a_tiebreak < 0
       or p_score_b_tiebreak is null or p_score_b_tiebreak < 0 then
      raise exception 'INVALID_TIEBREAK: 7-6 score requires non-negative tiebreak scores for both teams';
    end if;
  end if;

  if (p_team_a_player1_member is not null) = (p_team_a_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player1 must be exactly one of member/guest';
  end if;
  if (p_team_a_player2_member is not null) = (p_team_a_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_a_player2 must be exactly one of member/guest';
  end if;
  if (p_team_b_player1_member is not null) = (p_team_b_player1_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player1 must be exactly one of member/guest';
  end if;
  if (p_team_b_player2_member is not null) = (p_team_b_player2_guest is not null) then
    raise exception 'INVALID_SLOT: team_b_player2 must be exactly one of member/guest';
  end if;

  -- 4명 중복 금지 — matches.chk_no_duplicate_players가 0003에서 삭제된 뒤
  -- 재생성되지 않아, 이 함수가 DB 레벨에서 이 규칙을 강제하는 유일한 지점이다.
  v_keys := array[
    coalesce('m:' || p_team_a_player1_member::text, 'g:' || p_team_a_player1_guest::text),
    coalesce('m:' || p_team_a_player2_member::text, 'g:' || p_team_a_player2_guest::text),
    coalesce('m:' || p_team_b_player1_member::text, 'g:' || p_team_b_player1_guest::text),
    coalesce('m:' || p_team_b_player2_member::text, 'g:' || p_team_b_player2_guest::text)
  ];
  if (select count(distinct k) from unnest(v_keys) as k) <> 4 then
    raise exception 'DUPLICATE_PARTICIPANT: 4 slots must be 4 distinct participants';
  end if;

  -- ----------------------------------------------------------
  -- [4] 참가자 배열 구성 + 잠금
  -- ----------------------------------------------------------
  v_team_a_won := (p_winner_team = 'A');
  v_team_b_won := (p_winner_team = 'B');

  if p_team_a_player1_member is not null then
    v_member_ids := v_member_ids || p_team_a_player1_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || p_team_a_player1_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if p_team_a_player2_member is not null then
    v_member_ids := v_member_ids || p_team_a_player2_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || p_team_a_player2_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if p_team_b_player1_member is not null then
    v_member_ids := v_member_ids || p_team_b_player1_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || p_team_b_player1_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  if p_team_b_player2_member is not null then
    v_member_ids := v_member_ids || p_team_b_player2_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || p_team_b_player2_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  -- ----------------------------------------------------------
  -- [5] insert — ON CONFLICT DO NOTHING으로 idempotency 인덱스 충돌만
  --     흡수한다. EXCEPTION WHEN unique_violation 같은 광범위 catch를 쓰지
  --     않으므로, 다른 제약(check/FK) 위반은 그대로 위로 전파되어 트랜잭션
  --     전체를 롤백시킨다 — idempotency로 오인될 여지가 없다.
  --     arbiter를 partial index로 추론시키려면 인덱스 술어(where ...)를
  --     ON CONFLICT에 그대로 명시해야 한다.
  -- ----------------------------------------------------------
  insert into public.matches (
    session_id, club_id, played_at,
    team_a_player1_member, team_a_player1_guest,
    team_a_player2_member, team_a_player2_guest,
    team_b_player1_member, team_b_player1_guest,
    team_b_player2_member, team_b_player2_guest,
    score_a, score_b, score_a_tiebreak, score_b_tiebreak,
    winner_team, created_by, idempotency_key
  ) values (
    p_session_id, p_club_id, p_played_at,
    p_team_a_player1_member, p_team_a_player1_guest,
    p_team_a_player2_member, p_team_a_player2_guest,
    p_team_b_player1_member, p_team_b_player1_guest,
    p_team_b_player2_member, p_team_b_player2_guest,
    p_score_a, p_score_b, v_final_score_a_tiebreak, v_final_score_b_tiebreak,
    p_winner_team::public.winner_team_type, p_created_by, p_idempotency_key
  )
  on conflict (club_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning matches.id into v_match_id;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- key가 null이면 partial index 대상이 아니므로 충돌이 발생할 수 없다.
    -- 그런데도 0행이면 idempotency와 무관한 이상 상황이다.
    if p_idempotency_key is null then
      raise exception
        'EFFECT_UPDATE_FAILED: matches insert affected 0 rows without an idempotency key';
    end if;

    -- 동시 요청이 근소한 차이로 먼저 커밋한 경우. READ COMMITTED에서 이
    -- SELECT는 새 스냅샷을 보므로 커밋된 그 행을 반드시 찾는다.
    select * into v_existing
    from public.matches
    where matches.club_id = p_club_id
      and matches.idempotency_key = p_idempotency_key;

    if not found then
      raise exception
        'IDEMPOTENCY_RESOLUTION_FAILED: conflicting row not found after on conflict do nothing';
    end if;

    if public._match_idempotency_payload_matches(
         v_existing, p_club_id, p_session_id, p_played_at,
         p_score_a, p_score_b,
         v_final_score_a_tiebreak, v_final_score_b_tiebreak,
         p_winner_team,
         p_team_a_player1_member, p_team_a_player1_guest,
         p_team_a_player2_member, p_team_a_player2_guest,
         p_team_b_player1_member, p_team_b_player1_guest,
         p_team_b_player2_member, p_team_b_player2_guest
       ) then
      return v_existing.id;
    end if;

    raise exception
      'IDEMPOTENCY_CONFLICT: request key already used for a different match payload';
  elsif v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches insert affected % rows', v_rows;
  end if;

  -- ----------------------------------------------------------
  -- [6] 효과 적용 — 신규 생성 경로에서만 실행된다.
  -- ----------------------------------------------------------
  perform public._match_apply_effects(
    p_club_id, v_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );

  return v_match_id;
end;
$$;

-- ============================================================
-- 5) 신규 시그니처 기준 권한 재설정
-- ============================================================
revoke all on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

-- ============================================================
-- 6) PostgREST 스키마 캐시 갱신 — 함수 시그니처가 바뀌었으므로 필수.
--    NOTIFY는 트랜잭션이 커밋될 때 전달된다.
-- ============================================================
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 적용 후 검증 (별도 실행 — 읽기 전용)
-- ============================================================
-- -- (1) 동일 이름 함수가 정확히 1개인지 + 인자 18개인지
-- select p.oid::regprocedure as signature, p.pronargs as arg_count
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_match_with_effects';
-- -- 기대: 1행, arg_count = 18
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
--   and p.proname in (
--     'create_match_with_effects', 'update_match_with_effects', 'delete_match_with_effects',
--     '_match_validate_and_lock_participants', '_match_apply_effects', '_match_undo_effects',
--     '_match_idempotency_payload_matches'
--   )
-- order by p.proname;
-- -- 기대: create/update/delete → secdef=true, anon/authenticated=false, service_role=true
-- --       _match_* 4개      → secdef=false, 세 역할 모두 false
--
-- -- (3) 인덱스 확인
-- select indexname, indexdef from pg_indexes
-- where schemaname = 'public' and tablename = 'matches'
-- order by indexname;
-- -- 기대: matches_club_idempotency_key_uniq가 UNIQUE + WHERE 절 포함

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
-- begin;
-- drop function if exists public.create_match_with_effects(
--   uuid, uuid, date, integer, integer, integer, integer, text,
--   uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
-- );
-- drop function if exists public._match_idempotency_payload_matches(
--   public.matches, uuid, uuid, date, integer, integer, integer, integer, text,
--   uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
-- );
-- drop index if exists public.matches_club_idempotency_key_uniq;
-- alter table public.matches drop column if exists idempotency_key;
-- -- 0045의 17인자 create_match_with_effects 정의를 그대로 재실행한 뒤
-- -- revoke/grant를 다시 적용하고 notify pgrst, 'reload schema'; 를 실행할 것.
-- commit;
