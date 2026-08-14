-- ============================================================
-- 0066: legacy Match 동점 차단 + 기존 5:5 1건 무승부 정합화 (Phase 2A-8D-3A)
--
-- ⚠️ 선행 조건 — 0064 → 0065 순서로 적용된 뒤에만 실행할 수 있다.
--    · 0064: winner_team_type에 'D' 추가 (enum 트랜잭션 제약 때문에 단독 실행)
--    · 0065: chk_match_outcome_consistent(NOT VALID) + _match_apply_draw_effects
--    이 파일은 둘 다를 precondition으로 확인하고, 하나라도 없으면 전체 롤백한다.
--
-- ------------------------------------------------------------
-- 왜 필요한가
-- ------------------------------------------------------------
-- Production 조사(2A-8D-3)에서 legacy Match 1건이 발견되었다.
--   id     81f3bc20-a104-4864-89dd-b642d1d3f36d
--   club   cheongwoo
--   score  5:5   winner_team 'B'   tiebreak null/null   event_game_id null
-- legacy 경로(API·RPC 양쪽)에 동점 거부 검증이 전혀 없어 만들어진 행이다.
-- 새 정책상 5:5는 무승부이므로 이 행은 chk_match_outcome_consistent를 위반한다.
--
-- ------------------------------------------------------------
-- 이 파일이 하는 일 (단일 트랜잭션)
-- ------------------------------------------------------------
--   [1] create_match_with_effects  0046 기준 재정의 + 동점 guard
--   [2] update_match_with_effects  0059 기준 재정의 + 동점 guard + 무승부 undo 분기
--   [3] delete_match_with_effects  0059 기준 재정의 + 무승부 undo 분기
--   [4] 대상 1건: 기존 B팀 승리 효과 undo → winner_team='D' → draw 효과 apply
--   [5] chk_match_outcome_consistent VALIDATE
--
-- ★★ [3]과 [2]의 "무승부 undo 분기"는 2A-8D-3A에서 추가로 발견한 P1 때문이다.
--    이 backfill이 만드는 행은 event_game_id가 null인 "최초의 무승부 legacy
--    Match"다. Event-linked 무승부는 EVENT_GAME_MATCH_MANAGED_SEPARATELY가
--    막아주지만 이 행은 legacy 수정·삭제 경로로 그대로 도달한다.
--    0045의 _match_undo_effects는 p_member_won boolean[] 2값 모델이라 'D'를
--    표현하지 못해, old winner가 'D'면 won 배열이 전부 false가 되어
--      · 무승부 +5가 회수되지 않고 그대로 남고
--      · 실제로는 없던 "패"를 원복한다며 losses를 잘못 -1 한다
--    격리 DB 실측(무승부 → 6:2 A 수정): 김진규 5→15 (정상값 10),
--    이효성 +5 잔존, 홍명보 타 경기 패가 -1. 삭제 시에는 +5 ×3 = 15점이
--    영구히 남았다. 0065의 _match_undo_draw_effects로 분기해 정확히 되돌린다.
--
-- 세 함수 본문은 손으로 재작성하지 않았다. 최신 정의를 프로그램으로 추출해
-- guard와 undo 분기만 기계적으로 삽입하고 줄 단위 multiset으로 대조해
-- "삭제·변형된 코드 줄 0건"을 검증했다. 그래서 기존 계약이 전부 그대로다:
--   A/B winner만 허용 · Event Match managed separately · idempotency ·
--   Club scope · participant 검증·잠금 · 기존 effect undo/apply ·
--   signature·return · owner·SECURITY DEFINER·search_path·ACL
--
-- 건드리지 않는 것:
--   _match_apply_effects / _match_undo_effects / _match_validate_and_lock_participants(0045),
--   _match_apply_draw_effects / _match_undo_draw_effects /
--   save_event_game_result / clear_event_game_result / _event_game_result_score(0065),
--   0064의 enum.
--
-- ------------------------------------------------------------
-- backfill 계약
-- ------------------------------------------------------------
-- · 대상 Match를 FOR UPDATE로 잠그고 8개 slot UUID·score·tiebreak·winner·
--   club·session·event_game_id를 전부 정확히 대조한다. 하나라도 다르면
--   BACKFILL_PRECONDITION_FAILED로 전체 롤백한다(이름이 아니라 UUID로 고정).
-- · 단, 대상 id가 "아예 없는" DB(신규 환경·CI·로컬)에서는 backfill을 건너뛴다.
--   그러지 않으면 migration 폴더 전체를 새 DB에 적용할 수 없다. 이때도
--   위반 행이 하나라도 있으면 건너뛰지 않고 실패한다. "있는데 값이 다름"은
--   엉뚱한 행을 고치는 위험한 상황이므로 항상 전체 롤백이다.
-- · 기존 point_history는 한 행도 삭제하지 않는다. rollback/draw 행만 append.
-- · Match id·played_at·created_at·session_id·player slot·score·tiebreak 유지.
--   matches에는 updated_at 컬럼이 없으므로 갱신 대상도 없다.
-- · 효과는 기존 helper로만 적용한다 — members/guests/point_history를 직접
--   UPDATE/INSERT하지 않는다.
-- · undo 직후와 최종 상태를 snapshot 대비 delta로 검증하고, 예상과 다르면
--   BACKFILL_POSTCONDITION_FAILED로 전체 롤백한다.
--
-- 예상 delta (Production 사전 조사값 기준)
--   김진규   lp 0 →5    w 0→0   l 1→0     (패 원복 + 무승부 +5)
--   이효성   lp 10→5    w 1→0   l 0→0     (승 원복 -10 + 무승부 +5)
--   홍명보   lp 20→15   w 2→1   l 1→1     (승 원복 -10 + 무승부 +5)
--   게스트 김갑환        w 0→0   l 1→0     (패 원복 — 무승부에는 패가 없다)
--   point_history        신규 5행 (rollback -10 ×2, draw +5 ×3), 삭제 0행
-- ============================================================

begin;


-- ============================================================
-- [1] create_match_with_effects — 0046 기준 재정의 + 동점 guard
-- ============================================================
create or replace function public.create_match_with_effects(
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
  -- [2A-8D-3A] 동점 금지 — legacy 경기 기록에는 무승부가 없다.
  -- ----------------------------------------------------------
  -- Event Game의 5:5 무승부(winner_team='D')는 save_event_game_result만
  -- 만든다. legacy 경로는 A/B 승자만 다루므로 모든 동점을 거부한다.
  -- 이 검증이 없던 탓에 과거 5:5 + winner='B' 행이 만들어졌다.
  -- 주 방어선은 API의 400 검증이고 여기는 최종 방어선이다.
  -- 어떤 Match/member DML보다 앞에 있어야 한다.
  if p_score_a = p_score_b then
    raise exception 'LEGACY_MATCH_TIE_NOT_ALLOWED: score_a=% equals score_b=%', p_score_a, p_score_b;
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

revoke all on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_match_with_effects(
  uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;


-- ============================================================
-- [2] update_match_with_effects — 0059 기준 재정의 + 동점 guard + 무승부 undo
-- ============================================================
create or replace function public.update_match_with_effects(
  p_match_id uuid,
  p_club_id uuid,
  p_session_id uuid, -- null이면 기존 session_id 유지 — 현재 PUT의 `sessionId ?? existingMatch.session_id`와 동일 의미
  p_played_at date,
  p_score_a integer,
  p_score_b integer,
  p_score_a_tiebreak integer,
  p_score_b_tiebreak integer,
  p_winner_team text,
  p_team_a_player1_member uuid, p_team_a_player1_guest uuid,
  p_team_a_player2_member uuid, p_team_a_player2_guest uuid,
  p_team_b_player1_member uuid, p_team_b_player1_guest uuid,
  p_team_b_player2_member uuid, p_team_b_player2_guest uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.matches%rowtype;
  v_session_status text;
  v_final_session_id uuid;
  v_keys text[];
  v_rows integer;
  v_is_tiebreak_set boolean;
  v_final_score_a_tiebreak integer;
  v_final_score_b_tiebreak integer;
  v_old_team_a_won boolean;
  v_old_team_b_won boolean;
  v_new_team_a_won boolean;
  v_new_team_b_won boolean;
  v_old_member_ids uuid[] := array[]::uuid[];
  v_old_member_won boolean[] := array[]::boolean[];
  v_old_guest_ids uuid[] := array[]::uuid[];
  v_old_guest_won boolean[] := array[]::boolean[];
  v_new_member_ids uuid[] := array[]::uuid[];
  v_new_member_won boolean[] := array[]::boolean[];
  v_new_guest_ids uuid[] := array[]::uuid[];
  v_new_guest_won boolean[] := array[]::boolean[];
  v_lock_member_ids uuid[];
  v_lock_guest_ids uuid[];
begin
  select * into v_old
  from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND: match % not found in club', p_match_id;
  end if;

  -- ★ 0059 신규: Event Game에 연결된 Match는 이 legacy 경로로 수정·삭제할 수
  -- 없다. 여기서 Match만 바꾸면 event_games.status/completed_at,
  -- event_game_players, matches.event_game_id 링크가 서로 어긋난 채 남는다
  -- (Game 쪽을 함께 갱신할 방법이 이 함수에는 없다). Event Game 결과는
  -- save_event_game_result / clear_event_game_result로만 변경한다.
  -- event_game_id가 null인 일반 legacy 경기는 기존과 완전히 동일하게 동작한다.
  if v_old.event_game_id is not null then
    raise exception 'EVENT_GAME_MATCH_MANAGED_SEPARATELY';
  end if;

  v_final_session_id := coalesce(p_session_id, v_old.session_id);

  if p_session_id is not null then
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
  end if;

  if p_winner_team not in ('A', 'B') then
    raise exception 'INVALID_WINNER_TEAM: % is not A or B', p_winner_team;
  end if;

  if p_score_a is null or p_score_a < 0 or p_score_a > 7
     or p_score_b is null or p_score_b < 0 or p_score_b > 7 then
    raise exception 'INVALID_SCORE: score_a=%, score_b=% out of range', p_score_a, p_score_b;
  end if;

  -- 타이브레이크: app/api/matches/[id]/route.ts PUT과 정확히 동일한 규칙
  -- (POST와 완전히 동일한 로직임을 확인 후 재현). 타이브레이크가 아닌 세트는
  -- tiebreak 값을 무조건 null로 clamp한다.
  v_is_tiebreak_set := (p_score_a = 7 and p_score_b = 6) or (p_score_a = 6 and p_score_b = 7);
  if v_is_tiebreak_set then
    if p_score_a_tiebreak is null or p_score_a_tiebreak < 0
       or p_score_b_tiebreak is null or p_score_b_tiebreak < 0 then
      raise exception 'INVALID_TIEBREAK: 7-6 score requires non-negative tiebreak scores for both teams';
    end if;
    v_final_score_a_tiebreak := p_score_a_tiebreak;
    v_final_score_b_tiebreak := p_score_b_tiebreak;
  else
    v_final_score_a_tiebreak := null;
    v_final_score_b_tiebreak := null;
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
  -- [2A-8D-3A] 동점 금지 — legacy 경기 기록에는 무승부가 없다.
  -- ----------------------------------------------------------
  -- Event Game의 5:5 무승부(winner_team='D')는 save_event_game_result만
  -- 만든다. legacy 경로는 A/B 승자만 다루므로 모든 동점을 거부한다.
  -- 이 검증이 없던 탓에 과거 5:5 + winner='B' 행이 만들어졌다.
  -- 주 방어선은 API의 400 검증이고 여기는 최종 방어선이다.
  -- 어떤 Match/member DML보다 앞에 있어야 한다.
  if p_score_a = p_score_b then
    raise exception 'LEGACY_MATCH_TIE_NOT_ALLOWED: score_a=% equals score_b=%', p_score_a, p_score_b;
  end if;

  -- old 참가자 추출 (잠금 전 v_old 스냅샷 기준)
  v_old_team_a_won := (v_old.winner_team::text = 'A');
  v_old_team_b_won := (v_old.winner_team::text = 'B');

  if v_old.team_a_player1_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_a_player1_member;
    v_old_member_won := v_old_member_won || v_old_team_a_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_a_player1_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_a_won;
  end if;

  if v_old.team_a_player2_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_a_player2_member;
    v_old_member_won := v_old_member_won || v_old_team_a_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_a_player2_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_a_won;
  end if;

  if v_old.team_b_player1_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_b_player1_member;
    v_old_member_won := v_old_member_won || v_old_team_b_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_b_player1_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_b_won;
  end if;

  if v_old.team_b_player2_member is not null then
    v_old_member_ids := v_old_member_ids || v_old.team_b_player2_member;
    v_old_member_won := v_old_member_won || v_old_team_b_won;
  else
    v_old_guest_ids := v_old_guest_ids || v_old.team_b_player2_guest;
    v_old_guest_won := v_old_guest_won || v_old_team_b_won;
  end if;

  -- new 참가자 추출 (파라미터 기준)
  v_new_team_a_won := (p_winner_team = 'A');
  v_new_team_b_won := (p_winner_team = 'B');

  if p_team_a_player1_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_a_player1_member;
    v_new_member_won := v_new_member_won || v_new_team_a_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_a_player1_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_a_won;
  end if;

  if p_team_a_player2_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_a_player2_member;
    v_new_member_won := v_new_member_won || v_new_team_a_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_a_player2_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_a_won;
  end if;

  if p_team_b_player1_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_b_player1_member;
    v_new_member_won := v_new_member_won || v_new_team_b_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_b_player1_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_b_won;
  end if;

  if p_team_b_player2_member is not null then
    v_new_member_ids := v_new_member_ids || p_team_b_player2_member;
    v_new_member_won := v_new_member_won || v_new_team_b_won;
  else
    v_new_guest_ids := v_new_guest_ids || p_team_b_player2_guest;
    v_new_guest_won := v_new_guest_won || v_new_team_b_won;
  end if;

  -- old ∪ new 전체를 한 번에 잠금 (helper 내부에서 중복 제거 + 정렬)
  v_lock_member_ids := v_old_member_ids || v_new_member_ids;
  v_lock_guest_ids := v_old_guest_ids || v_new_guest_ids;
  perform public._match_validate_and_lock_participants(p_club_id, v_lock_member_ids, v_lock_guest_ids);

  update public.matches set
    session_id = v_final_session_id,
    played_at = p_played_at,
    team_a_player1_member = p_team_a_player1_member, team_a_player1_guest = p_team_a_player1_guest,
    team_a_player2_member = p_team_a_player2_member, team_a_player2_guest = p_team_a_player2_guest,
    team_b_player1_member = p_team_b_player1_member, team_b_player1_guest = p_team_b_player1_guest,
    team_b_player2_member = p_team_b_player2_member, team_b_player2_guest = p_team_b_player2_guest,
    score_a = p_score_a, score_b = p_score_b,
    score_a_tiebreak = v_final_score_a_tiebreak, score_b_tiebreak = v_final_score_b_tiebreak,
    winner_team = p_winner_team::public.winner_team_type
  where matches.id = p_match_id and matches.club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches update affected % rows', v_rows;
  end if;

  -- old 전체 undo → new 전체 apply 순서로 호출 (기존 PUT의 rollback→apply 순서 재현).
  -- 공통 참가자는 undo 1회 + apply 1회가 순차 실행되어 point_history에 기존과
  -- 동일하게 rollback행 + apply행 2건이 남고, members/guests는 undo 결과 위에
  -- apply가 누적되어 최종 net 값이 정확히 맞는다(설계 검수 표 참고).
  -- [2A-8D-3A] old 결과가 무승부면 무승부 전용 undo를 쓴다.
  if v_old.winner_team::text = 'D' then
    perform public._match_undo_draw_effects(p_club_id, p_match_id, v_old_member_ids);
  else
  perform public._match_undo_effects(
    p_club_id, p_match_id, v_old_member_ids, v_old_member_won, v_old_guest_ids, v_old_guest_won
  );
  end if;
  perform public._match_apply_effects(
    p_club_id, p_match_id, v_new_member_ids, v_new_member_won, v_new_guest_ids, v_new_guest_won
  );
end;
$$;

revoke all on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.update_match_with_effects(
  uuid, uuid, uuid, date, integer, integer, integer, integer, text,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;


-- ============================================================
-- [3] delete_match_with_effects — 0059 기준 재정의 + 무승부 undo
-- ============================================================
create or replace function public.delete_match_with_effects(
  p_match_id uuid,
  p_club_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.matches%rowtype;
  v_rows integer;
  v_team_a_won boolean;
  v_team_b_won boolean;
  v_member_ids uuid[] := array[]::uuid[];
  v_member_won boolean[] := array[]::boolean[];
  v_guest_ids uuid[] := array[]::uuid[];
  v_guest_won boolean[] := array[]::boolean[];
begin
  select * into v_old
  from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND: match % not found in club', p_match_id;
  end if;

  -- ★ 0059 신규: Event Game에 연결된 Match는 이 legacy 경로로 수정·삭제할 수
  -- 없다. 여기서 Match만 바꾸면 event_games.status/completed_at,
  -- event_game_players, matches.event_game_id 링크가 서로 어긋난 채 남는다
  -- (Game 쪽을 함께 갱신할 방법이 이 함수에는 없다). Event Game 결과는
  -- save_event_game_result / clear_event_game_result로만 변경한다.
  -- event_game_id가 null인 일반 legacy 경기는 기존과 완전히 동일하게 동작한다.
  if v_old.event_game_id is not null then
    raise exception 'EVENT_GAME_MATCH_MANAGED_SEPARATELY';
  end if;

  v_team_a_won := (v_old.winner_team::text = 'A');
  v_team_b_won := (v_old.winner_team::text = 'B');

  if v_old.team_a_player1_member is not null then
    v_member_ids := v_member_ids || v_old.team_a_player1_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_a_player1_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if v_old.team_a_player2_member is not null then
    v_member_ids := v_member_ids || v_old.team_a_player2_member;
    v_member_won := v_member_won || v_team_a_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_a_player2_guest;
    v_guest_won := v_guest_won || v_team_a_won;
  end if;

  if v_old.team_b_player1_member is not null then
    v_member_ids := v_member_ids || v_old.team_b_player1_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_b_player1_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  if v_old.team_b_player2_member is not null then
    v_member_ids := v_member_ids || v_old.team_b_player2_member;
    v_member_won := v_member_won || v_team_b_won;
  else
    v_guest_ids := v_guest_ids || v_old.team_b_player2_guest;
    v_guest_won := v_guest_won || v_team_b_won;
  end if;

  perform public._match_validate_and_lock_participants(p_club_id, v_member_ids, v_guest_ids);

  -- [2A-8D-3A] 삭제 대상이 무승부면 무승부 전용 undo를 쓴다.
  if v_old.winner_team::text = 'D' then
    perform public._match_undo_draw_effects(p_club_id, p_match_id, v_member_ids);
  else
  perform public._match_undo_effects(
    p_club_id, p_match_id, v_member_ids, v_member_won, v_guest_ids, v_guest_won
  );
  end if;

  delete from public.matches
  where matches.id = p_match_id and matches.club_id = p_club_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'EFFECT_UPDATE_FAILED: matches delete affected % rows', v_rows;
  end if;
end;
$$;

revoke all on function public.delete_match_with_effects(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.delete_match_with_effects(uuid, uuid)
to service_role;


-- ============================================================
-- [4] 대상 legacy Match 1건 무승부 정합화
-- ============================================================
do $backfill$
declare
  c_match_id   constant uuid := '81f3bc20-a104-4864-89dd-b642d1d3f36d';
  c_club_id    constant uuid := '465ae133-893e-425d-a093-161f7654bd0d';
  c_session_id constant uuid := '3da9eb4b-868c-4d0d-80a2-45368af7876c';
  c_a1_guest   constant uuid := '145ab8c7-df89-401f-b9b6-5ac1e6d4f122';
  c_a2_member  constant uuid := '07b106d2-a989-4d7d-9abd-efd9487ba2a5';
  c_b1_member  constant uuid := '63b69bdd-8161-4824-83e8-6cbddab51737';
  c_b2_member  constant uuid := '9954d774-d9aa-45a5-a69b-d5bb500db21e';
  c_lp_win     constant integer := 10; -- 0045 _match_undo_effects와 동일
  c_lp_draw    constant integer := 5;  -- 0065 _match_apply_draw_effects와 동일

  v_match public.matches;
  v_slug text;
  v_convalidated boolean;
  v_count integer;
  v_ph_before integer;
  v_ph_after integer;
  -- snapshot: league_point / wins / losses
  v_a2_lp integer; v_a2_w integer; v_a2_l integer;
  v_b1_lp integer; v_b1_w integer; v_b1_l integer;
  v_b2_lp integer; v_b2_w integer; v_b2_l integer;
  v_g_w integer;   v_g_l integer;
  v_lp integer; v_w integer; v_l integer;
begin
  -- ----------------------------------------------------------
  -- precondition: 0064 enum
  -- ----------------------------------------------------------
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'winner_team_type' and e.enumlabel = 'D'
  ) then
    raise exception 'BACKFILL_PRECONDITION_FAILED: winner_team_type has no D (apply 0064 first)';
  end if;

  -- ----------------------------------------------------------
  -- precondition: 0065 constraint가 존재하고 아직 NOT VALID
  -- ----------------------------------------------------------
  select c.convalidated into v_convalidated
  from pg_constraint c
  where c.conrelid = 'public.matches'::regclass
    and c.conname = 'chk_match_outcome_consistent';
  if v_convalidated is null then
    raise exception 'BACKFILL_PRECONDITION_FAILED: chk_match_outcome_consistent missing (apply 0065 first)';
  end if;
  if v_convalidated then
    raise exception 'BACKFILL_PRECONDITION_FAILED: chk_match_outcome_consistent already validated (0066 already applied?)';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_match_apply_draw_effects'
  ) then
    raise exception 'BACKFILL_PRECONDITION_FAILED: _match_apply_draw_effects missing (apply 0065 first)';
  end if;

  -- ----------------------------------------------------------
  -- precondition: 대상 행을 잠그고 전 컬럼 대조
  -- ----------------------------------------------------------
  -- ★ "대상이 아예 없음"과 "있는데 값이 다름"을 구분한다.
  --   전자는 Production이 아닌 DB(신규 환경·CI·로컬)이므로 backfill을 건너뛴다.
  --   그러지 않으면 migration 폴더 전체를 새 DB에 적용할 수 없게 된다.
  --   후자는 "엉뚱한 행을 고치는" 위험한 상황이므로 반드시 전체 롤백한다.
  select * into v_match from public.matches where id = c_match_id for update;
  if not found then
    select count(*) into v_count from public.matches
    where not ((score_a = 5 and score_b = 5 and winner_team = 'D')
               or (score_a <> score_b and winner_team in ('A', 'B')));
    if v_count <> 0 then
      raise exception 'BACKFILL_PRECONDITION_FAILED: target match absent but % violating match(es) exist', v_count;
    end if;
    raise notice '0066 backfill skipped: target match % not present (non-production database)', c_match_id;
    return;
  end if;

  select c.slug into v_slug from public.clubs c where c.id = v_match.club_id;
  if v_slug is distinct from 'cheongwoo' then
    raise exception 'BACKFILL_PRECONDITION_FAILED: club slug is % (expected cheongwoo)', coalesce(v_slug, 'null');
  end if;
  if v_match.club_id <> c_club_id then
    raise exception 'BACKFILL_PRECONDITION_FAILED: club_id mismatch';
  end if;
  if v_match.event_game_id is not null then
    raise exception 'BACKFILL_PRECONDITION_FAILED: event_game_id is not null';
  end if;
  if v_match.session_id is distinct from c_session_id then
    raise exception 'BACKFILL_PRECONDITION_FAILED: session_id mismatch';
  end if;
  if v_match.score_a <> 5 or v_match.score_b <> 5 then
    raise exception 'BACKFILL_PRECONDITION_FAILED: score is %:% (expected 5:5)', v_match.score_a, v_match.score_b;
  end if;
  if v_match.score_a_tiebreak is not null or v_match.score_b_tiebreak is not null then
    raise exception 'BACKFILL_PRECONDITION_FAILED: tiebreak is not null/null';
  end if;
  if v_match.winner_team::text <> 'B' then
    raise exception 'BACKFILL_PRECONDITION_FAILED: winner_team is % (expected B)', v_match.winner_team::text;
  end if;

  -- 8개 slot을 UUID로 정확히 대조한다 (이름이 아니라 UUID로 고정).
  if v_match.team_a_player1_member is not null
     or v_match.team_a_player1_guest is distinct from c_a1_guest
     or v_match.team_a_player2_member is distinct from c_a2_member
     or v_match.team_a_player2_guest is not null
     or v_match.team_b_player1_member is distinct from c_b1_member
     or v_match.team_b_player1_guest is not null
     or v_match.team_b_player2_member is distinct from c_b2_member
     or v_match.team_b_player2_guest is not null then
    raise exception 'BACKFILL_PRECONDITION_FAILED: player slots do not match the surveyed values';
  end if;

  -- 대상은 정확히 1건이어야 하고, 다른 동점·위반 행이 없어야 한다.
  select count(*) into v_count from public.matches where id = c_match_id;
  if v_count <> 1 then
    raise exception 'BACKFILL_PRECONDITION_FAILED: target match count is %', v_count;
  end if;
  select count(*) into v_count from public.matches
  where score_a = score_b and id <> c_match_id;
  if v_count <> 0 then
    raise exception 'BACKFILL_PRECONDITION_FAILED: % other tie match(es) exist', v_count;
  end if;
  select count(*) into v_count from public.matches
  where not ((score_a = 5 and score_b = 5 and winner_team = 'D')
             or (score_a <> score_b and winner_team in ('A', 'B')));
  if v_count <> 1 then
    raise exception 'BACKFILL_PRECONDITION_FAILED: % constraint-violating match(es) (expected exactly 1)', v_count;
  end if;

  -- ----------------------------------------------------------
  -- snapshot (postcondition 검증 기준)
  -- ----------------------------------------------------------
  select m.league_point, m.wins, m.losses into v_a2_lp, v_a2_w, v_a2_l
  from public.members m where m.id = c_a2_member and m.club_id = c_club_id;
  select m.league_point, m.wins, m.losses into v_b1_lp, v_b1_w, v_b1_l
  from public.members m where m.id = c_b1_member and m.club_id = c_club_id;
  select m.league_point, m.wins, m.losses into v_b2_lp, v_b2_w, v_b2_l
  from public.members m where m.id = c_b2_member and m.club_id = c_club_id;
  select g.wins, g.losses into v_g_w, v_g_l
  from public.guests g where g.id = c_a1_guest and g.club_id = c_club_id;
  if v_a2_lp is null or v_b1_lp is null or v_b2_lp is null or v_g_w is null then
    raise exception 'BACKFILL_PRECONDITION_FAILED: participant row missing in club scope';
  end if;
  select count(*) into v_ph_before from public.point_history where match_id = c_match_id;

  -- ----------------------------------------------------------
  -- [3-1] 기존 B팀 승리 효과 undo — 0045 helper를 정확히 1회 호출한다.
  --       배열은 원본 slot 순서(a1,a2,b1,b2)의 won 값을 그대로 쓴다:
  --       A팀(패) = false, B팀(승) = true.
  -- ----------------------------------------------------------
  perform public._match_undo_effects(
    c_club_id,
    c_match_id,
    array[c_a2_member, c_b1_member, c_b2_member]::uuid[],
    array[false, true, true]::boolean[],
    array[c_a1_guest]::uuid[],
    array[false]::boolean[]
  );

  -- undo 직후 검증: 승자 2명은 -10/-1승, 패자는 -1패, 게스트는 -1패.
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_b1_member;
  if v_lp <> v_b1_lp - c_lp_win or v_w <> v_b1_w - 1 or v_l <> v_b1_l then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: undo b1 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_b1_lp - c_lp_win, v_b1_w - 1, v_b1_l;
  end if;
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_b2_member;
  if v_lp <> v_b2_lp - c_lp_win or v_w <> v_b2_w - 1 or v_l <> v_b2_l then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: undo b2 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_b2_lp - c_lp_win, v_b2_w - 1, v_b2_l;
  end if;
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_a2_member;
  if v_lp <> v_a2_lp or v_w <> v_a2_w or v_l <> v_a2_l - 1 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: undo a2 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_a2_lp, v_a2_w, v_a2_l - 1;
  end if;
  select g.wins, g.losses into v_w, v_l from public.guests g where g.id = c_a1_guest;
  if v_w <> v_g_w or v_l <> v_g_l - 1 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: undo guest gave %/% (expected %/%)',
      v_w, v_l, v_g_w, v_g_l - 1;
  end if;

  -- ----------------------------------------------------------
  -- [3-2] winner_team B → D. 그 밖의 컬럼은 건드리지 않는다.
  --       (5:5 + 'D'는 NOT VALID constraint도 통과한다 — NOT VALID는
  --        기존 행 검증만 생략하고 이 UPDATE에는 즉시 적용된다.)
  -- ----------------------------------------------------------
  update public.matches set winner_team = 'D' where id = c_match_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: winner update affected % rows', v_count;
  end if;

  -- ----------------------------------------------------------
  -- [3-3] 무승부 효과 apply — 0065 helper. 회원 3명 +5, 승패 불변,
  --       게스트는 대상이 아니다(helper 시그니처에 guest 인자가 없다).
  -- ----------------------------------------------------------
  perform public._match_apply_draw_effects(
    c_club_id,
    c_match_id,
    array[c_a2_member, c_b1_member, c_b2_member]::uuid[]
  );

  -- ----------------------------------------------------------
  -- 최종 검증 — snapshot 대비 delta
  -- ----------------------------------------------------------
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_a2_member;
  if v_lp <> v_a2_lp + c_lp_draw or v_w <> v_a2_w or v_l <> v_a2_l - 1 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: final a2 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_a2_lp + c_lp_draw, v_a2_w, v_a2_l - 1;
  end if;
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_b1_member;
  if v_lp <> v_b1_lp - c_lp_win + c_lp_draw or v_w <> v_b1_w - 1 or v_l <> v_b1_l then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: final b1 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_b1_lp - c_lp_win + c_lp_draw, v_b1_w - 1, v_b1_l;
  end if;
  select m.league_point, m.wins, m.losses into v_lp, v_w, v_l
  from public.members m where m.id = c_b2_member;
  if v_lp <> v_b2_lp - c_lp_win + c_lp_draw or v_w <> v_b2_w - 1 or v_l <> v_b2_l then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: final b2 gave %/%/% (expected %/%/%)',
      v_lp, v_w, v_l, v_b2_lp - c_lp_win + c_lp_draw, v_b2_w - 1, v_b2_l;
  end if;
  select g.wins, g.losses into v_w, v_l from public.guests g where g.id = c_a1_guest;
  if v_w <> v_g_w or v_l <> v_g_l - 1 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: final guest gave %/% (expected %/%)',
      v_w, v_l, v_g_w, v_g_l - 1;
  end if;

  -- point_history: 삭제 0행, 신규 5행 (rollback -10 x2, draw +5 x3)
  select count(*) into v_ph_after from public.point_history where match_id = c_match_id;
  if v_ph_after <> v_ph_before + 5 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: point_history % rows (expected % = % + 5)',
      v_ph_after, v_ph_before + 5, v_ph_before;
  end if;
  select count(*) into v_count from public.point_history
  where match_id = c_match_id and reason = 'regular_match_rollback' and point_change = -c_lp_win;
  if v_count <> 2 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: % rollback rows (expected 2)', v_count;
  end if;
  select count(*) into v_count from public.point_history
  where match_id = c_match_id and reason = 'regular_match_draw' and point_change = c_lp_draw;
  if v_count <> 3 then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: % draw rows (expected 3)', v_count;
  end if;

  -- 대상 행이 정확히 무승부 형태인지, 그 밖의 컬럼이 보존됐는지
  select * into v_match from public.matches where id = c_match_id;
  if v_match.winner_team::text <> 'D'
     or v_match.score_a <> 5 or v_match.score_b <> 5
     or v_match.score_a_tiebreak is not null or v_match.score_b_tiebreak is not null
     or v_match.event_game_id is not null
     or v_match.club_id <> c_club_id
     or v_match.session_id is distinct from c_session_id
     or v_match.team_a_player1_guest is distinct from c_a1_guest
     or v_match.team_a_player2_member is distinct from c_a2_member
     or v_match.team_b_player1_member is distinct from c_b1_member
     or v_match.team_b_player2_member is distinct from c_b2_member then
    raise exception 'BACKFILL_POSTCONDITION_FAILED: target row not in expected draw shape';
  end if;

  raise notice '0066 backfill ok: match % is now a draw', c_match_id;
end
$backfill$;


-- ============================================================
-- [5] chk_match_outcome_consistent VALIDATE
-- ============================================================
-- 위반 행이 사라졌으므로 NOT VALID를 승격한다. 남은 위반 행이 있으면
-- 여기서 실패하고 트랜잭션 전체가 롤백된다.
alter table public.matches
  validate constraint chk_match_outcome_consistent;

do $verify$
declare
  v_count integer;
  v_validated boolean;
begin
  select c.convalidated into v_validated from pg_constraint c
  where c.conrelid = 'public.matches'::regclass and c.conname = 'chk_match_outcome_consistent';
  if v_validated is not true then
    raise exception 'VALIDATE_FAILED: chk_match_outcome_consistent not validated';
  end if;

  select c.convalidated into v_validated from pg_constraint c
  where c.conrelid = 'public.matches'::regclass and c.conname = 'chk_draw_no_tiebreak';
  if v_validated is not true then
    raise exception 'VALIDATE_FAILED: chk_draw_no_tiebreak must stay VALID';
  end if;

  select count(*) into v_count from public.matches
  where not ((score_a = 5 and score_b = 5 and winner_team = 'D')
             or (score_a <> score_b and winner_team in ('A', 'B')));
  if v_count <> 0 then
    raise exception 'VALIDATE_FAILED: % violating match(es) remain', v_count;
  end if;

  -- 동점 행은 전부 무승부여야 한다. (backfill을 건너뛴 DB에서는 0건일 수 있다.)
  select count(*) into v_count from public.matches
  where score_a = score_b and winner_team <> 'D';
  if v_count <> 0 then
    raise exception 'VALIDATE_FAILED: % tie match(es) are not draws', v_count;
  end if;

  -- 대상 행이 존재한다면 무승부 상태여야 한다.
  select count(*) into v_count from public.matches
  where id = '81f3bc20-a104-4864-89dd-b642d1d3f36d'::uuid and winner_team <> 'D';
  if v_count <> 0 then
    raise exception 'VALIDATE_FAILED: target match is not a draw';
  end if;
end
$verify$;

-- PostgREST 스키마 캐시 갱신 — 함수 시그니처는 그대로지만 본문이 바뀌었다.
notify pgrst, 'reload schema';

commit;
