-- ============================================================
-- 0061: 빈 draft Game 일괄 확보 (Phase 2A-8B)
--
-- ------------------------------------------------------------
-- 배경
-- ------------------------------------------------------------
-- 2A-8A 조사 결과, Game 생성 경로는 create_event_game(0054/0058) 단건뿐이고
-- 이 함수는 _event_game_validate_players로 정원(복식 4명)을 강제하므로
-- "선수를 나중에 배정할 빈 Game"을 만들 수 없었다. 목표 게임 수를 먼저
-- 확보하고 선수를 채우는 운영 흐름이 DB 레벨에서 막혀 있던 셈이다.
--
-- 이 migration은 그 공백만 채운다. create_event_game의 계약은 건드리지
-- 않는다(선수 필수 그대로).
--
-- ------------------------------------------------------------
-- 계약 요약 (2A-8B 확정 정책)
-- ------------------------------------------------------------
--   · "목표 수까지 채운다"는 멱등 연산이다. 이미 목표에 도달했으면 DML을
--     한 건도 실행하지 않고 카운터만 반환한다(완전한 no-op).
--   · 목표 수는 어디에도 저장하지 않는다 — 요청 인자로만 쓴다.
--     events.match_config은 읽지도 쓰지도 않는다(court_count 등 기존 미사용
--     키도 그대로 둔다).
--   · 현재 수 = 같은 (event_id, club_id)의 status <> 'cancelled' 전체.
--     draft / in_progress / completed를 모두 포함하고, format과 배치 여부는
--     따지지 않는다.
--   · 생성 수 = greatest(target - current, 0). 목표가 현재보다 작아도
--     기존 Game을 취소·삭제하지 않는다(cancel은 되돌릴 수 없는 종료이므로
--     자동화하지 않는다 — 2A-8A 권장 운영 정책).
--   · 신규 Game: format='doubles' / status='draft' / source='manual' /
--     court·session = null / event_game_players 미생성.
--   · 참가자 확정(participants_confirmed_at)과 active confirmed 4명을
--     요구한다. 이 두 guard는 create_event_game에는 없는 이 함수 고유
--     계약이다(빈 Game은 "이 인원으로 몇 판 돌린다"는 선언이므로 인원이
--     정해지지 않은 상태에서 만들 이유가 없다).
--
-- ------------------------------------------------------------
-- Event 상태 계약 — 여기만 0058과 다르다
-- ------------------------------------------------------------
-- 0058은 Event 전체 구조 잠금을 cancelled 하나로 축소했고, 그래서
-- create_event_game은 completed Event에서도 성공한다. 그러나 "완료된
-- 이벤트에 빈 게임을 더 만든다"는 조작은 운영상 의미가 없으므로 이
-- 함수는 completed도 명시적으로 차단한다(2A-8B 확정 정책 2).
--
-- 오류 코드는 EVENT_STRUCTURE_LOCKED를 재사용하되, completed일 때만
-- 하위 이유를 붙여 API가 정확한 문구를 고를 수 있게 한다. 기존 함수들은
-- 이 코드를 접미사 없이 올리므로(0058 전수 확인) 기존 매핑과 충돌하지
-- 않는다.
--
-- ------------------------------------------------------------
-- position 계약 (0060 유지)
-- ------------------------------------------------------------
-- position은 화면용 연속 번호가 아니라 Event 내부 정렬 토큰이다. 기준값은
-- cancelled를 포함한 Event 전체 max(position)이며, 신규 행은
-- max+1 .. max+N 을 받는다.
--   · 기존 모든 position보다 크므로 partial unique
--     event_games_unplaced_position_uniq(draft·미배치)와 충돌 불가.
--   · reorder_event_games(0060)도 같은 기준(Event 전체 max)을 쓰므로
--     두 연산이 섞여도 교차 상태 중복이 생기지 않는다.
-- 최종 최대값을 bigint로 검사해 int4 범위를 넘으면 INSERT 전에 예외를
-- 던진다(부분 생성이 남지 않는다).
--
-- ------------------------------------------------------------
-- 목표 수 상한 200 — 근거
-- ------------------------------------------------------------
-- 1) 코드 근거(하드 상한): reorder_event_games의 API 라우트가
--    MAX_GAME_IDS = 500으로 배열 크기를 제한하고, reorder RPC는 draft·미배치
--    집합 "전체"를 한 배열로 요구한다. 따라서 미배치 큐가 500을 넘으면
--    순서 변경 기능 자체가 동작하지 않는다 → 상한은 반드시 500 미만이어야
--    한다.
-- 2) 운영 근거: 코트 4개 × 4시간 × 경기당 30분 = 32경기가 하루 운영의
--    현실적 최대치다. 200은 그 6배 이상이며, 재호출·취소가 섞여도 1)의
--    한계에 도달하지 않는 여유를 남긴다.
-- 임의로 큰 값(10000 등)을 두지 않는 이유는 오타 한 번으로 되돌릴 수 없는
-- 대량 행이 생기고(삭제 RPC가 없다) 미배치 큐 UI가 붕괴하기 때문이다.
--
-- 스키마·인덱스·제약 변경 없음. 기존 함수 재정의 없음. backfill 없음.
-- ============================================================

begin;

create function public.ensure_event_game_count(
  p_event_id uuid,
  p_club_id uuid,
  p_target_count integer
) returns table(
  target_count integer,
  previous_count integer,
  created_count integer,
  final_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_participants_confirmed_at timestamptz;
  v_active_confirmed integer;
  v_prev integer;
  v_event_max bigint;
  v_created bigint;
begin
  -- ----------------------------------------------------------
  -- [1] 인자 범위 검증 — DB 왕복과 잠금 이전에 fail-fast.
  --     API도 같은 범위를 검사하지만 여기가 최종 방어선이다.
  -- ----------------------------------------------------------
  if p_target_count is null then
    raise exception 'EVENT_GAME_BULK_TARGET_INVALID: target count is required';
  end if;
  if p_target_count < 1 or p_target_count > 200 then
    raise exception 'EVENT_GAME_BULK_TARGET_INVALID: %', p_target_count;
  end if;

  -- ----------------------------------------------------------
  -- [2] Event row 잠금 — id + club_id scope.
  --     create_event_game / reorder_event_games / save_event_game_result가
  --     모두 같은 row를 FOR UPDATE로 잡으므로, 같은 Event에 대한 동시
  --     요청은 여기서 직렬화된다. 현재 수와 max(position)을 이 잠금
  --     "이후에" 계산하므로 두 요청이 같은 previous_count를 보고 중복
  --     생성하는 일이 구조적으로 발생하지 않는다.
  -- ----------------------------------------------------------
  select status, participants_confirmed_at
    into v_event_status, v_participants_confirmed_at
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  -- 하위 이유를 붙이는 유일한 지점 — 0058의 무접미사 사용과 구분된다.
  if v_event_status = 'completed' then
    raise exception 'EVENT_STRUCTURE_LOCKED: event is completed';
  end if;

  -- ----------------------------------------------------------
  -- [3] 참가자 확정 guard.
  --     event_participants의 status_active_consistency CHECK(0052) 때문에
  --     confirmed는 항상 is_active지만, 계약을 코드로 명시해 이후 상태
  --     체계가 바뀌어도 의도가 남게 한다.
  -- ----------------------------------------------------------
  if v_participants_confirmed_at is null then
    raise exception 'EVENT_GAME_BULK_PARTICIPANTS_NOT_CONFIRMED';
  end if;

  select count(*) into v_active_confirmed
  from public.event_participants
  where event_id = p_event_id and club_id = p_club_id
    and status = 'confirmed' and is_active;

  if v_active_confirmed < 4 then
    raise exception 'EVENT_GAME_BULK_PARTICIPANTS_INSUFFICIENT: %', v_active_confirmed;
  end if;

  -- ----------------------------------------------------------
  -- [4] 현재 수 — cancelled만 제외. 배치 여부·format 무관.
  -- ----------------------------------------------------------
  select count(*) into v_prev
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status <> 'cancelled';

  v_created := greatest(p_target_count - v_prev, 0)::bigint;

  -- 목표에 이미 도달(또는 초과) — DML 없이 카운터만 반환한다.
  -- 목표 수 감소도 이 경로로 흘러 데이터가 전혀 바뀌지 않는다.
  if v_created = 0 then
    return query select p_target_count, v_prev, 0, v_prev;
    return;
  end if;

  -- ----------------------------------------------------------
  -- [5] position 기준 — cancelled 포함 Event 전체 max (0060과 동일 기준).
  -- ----------------------------------------------------------
  select coalesce(max(position), 0)::bigint into v_event_max
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id;

  -- 좌변 전체가 bigint로 계산되므로 검사 도중 int4 overflow가 먼저 터지지
  -- 않는다. 초과 시 INSERT 이전에 예외 → 부분 생성이 남지 않는다.
  if v_event_max + v_created > 2147483647 then
    raise exception 'EVENT_GAME_BULK_POSITION_OVERFLOW';
  end if;

  -- ----------------------------------------------------------
  -- [6] 부족분만 단일 set-based INSERT.
  --     event_game_players는 만들지 않는다 — 선수 배정은 기존
  --     set_event_game_players 경로가 담당한다.
  -- ----------------------------------------------------------
  insert into public.event_games (
    event_id, club_id, event_court_id, event_session_id,
    format, status, source, position
  )
  select
    p_event_id, p_club_id, null, null,
    'doubles', 'draft', 'manual', (v_event_max + g)::integer
  from generate_series(1, v_created) as g;

  return query select
    p_target_count,
    v_prev,
    v_created::integer,
    (v_prev + v_created)::integer;
end;
$$;

-- 0051~0060 관례와 동일 — service_role만 실행 가능.
revoke all on function public.ensure_event_game_count(uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.ensure_event_game_count(uuid, uuid, integer)
to service_role;

comment on function public.ensure_event_game_count(uuid, uuid, integer) is
'Event의 non-cancelled Game 수를 목표치까지 채운다(2A-8B). 부족분만큼 빈
doubles draft Game을 생성하고 event_game_players는 만들지 않는다. 목표에
도달했거나 목표가 더 작으면 DML 없이 카운터만 반환한다(멱등). 목표 수는
저장하지 않는다. completed/cancelled Event는 차단하며, participants_confirmed_at
과 active confirmed 4명을 요구한다. position은 cancelled 포함 Event 전체
max(position) 다음부터 배정한다(0060 계약).';

commit;

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
--   drop function public.ensure_event_game_count(uuid, uuid, integer);
--
-- 이 migration은 스키마를 변경하지 않고 데이터도 쓰지 않으므로 함수만
-- 제거하면 0060 상태로 완전히 되돌아간다. 단 이 함수로 이미 생성된 빈
-- Game은 남는다 — 삭제 RPC가 없으므로 개별 cancel로만 정리할 수 있다.
