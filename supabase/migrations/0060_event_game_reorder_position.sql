-- ============================================================
-- 0060: reorder_event_games의 position 충돌 수정 (Phase 2A-7B-2C)
--
-- ------------------------------------------------------------
-- 문제 (격리 DB에서 실측 재현)
-- ------------------------------------------------------------
-- reorder_event_games(0054 신설, 0058 재정의)는 재정렬 대상을
--   status = 'draft' AND event_session_id IS NULL
-- 로 좁힌 뒤, 그 부분집합에 1..N 을 "절대값"으로 다시 부여했다. 큐 밖으로
-- 빠진 게임(completed / cancelled)의 기존 position은 예약하지 않았고,
-- 유일성 인덱스 event_games_unplaced_position_uniq의 predicate도
-- draft·미배치로 한정돼 있어 교차 상태 중복을 잡지 못했다.
--
--   A(draft,1) B(draft,2) C(draft,3)  →  A에 결과 저장 → A(completed,1)
--   → reorder [C,B] → C(draft,1) B(draft,2)
--   → A와 C가 모두 position=1  ★ 중복
--
-- 이 중복은 표시 문제로 끝나지 않는다. clear_event_game_result(0059)는
-- position을 건드리지 않고 status만 'draft'로 되돌리므로, 위 상태에서 A의
-- 결과를 초기화하면 A가 partial unique scope로 재진입하면서
--   SQLSTATE 23505 / event_games_unplaced_position_uniq
-- 로 실패한다(lib/event-engine.ts에 매칭이 없어 500 "경기 결과 초기화에
-- 실패했습니다."로 노출). 즉 한번 이 상태에 빠지면 결과를 되돌릴 수 없다.
--
-- ------------------------------------------------------------
-- 수정 계약 — Event 전체 최대 position 위의 새 구간으로 이동
-- ------------------------------------------------------------
--   eventMax     = 같은 (event_id, club_id) 전체 게임의 max(position)
--   new position = eventMax + row_number(입력 순서)
--   → 대상 큐는 eventMax + 1 .. eventMax + N 으로 이동
--
-- 이로써
--   · completed / cancelled 게임의 position은 절대 바뀌지 않는다
--     (결과 확정 게임의 구조 잠금 정책과 충돌하지 않는다)
--   · 목표 구간이 기존 모든 position보다 크므로 큐 밖 게임과 충돌 불가
--   · 구간 내부 값이 서로 달라 큐 내부 충돌도 불가
--   · completed → draft 복귀(결과 초기화) 시 23505가 구조적으로 발생 불가
--     (completed 게임의 position은 언제나 큐 최소값보다 작다)
--
-- 기존의 "임시 offset으로 전원 이동 → 다시 1..N 부여" 2단계 UPDATE는
-- 제거한다. 목표 구간이 기존 값들과 애초에 겹치지 않으므로 임시 이동이
-- 필요한 이유(큐 내부 자기 충돌 회피) 자체가 사라져, 단일 UPDATE로 끝난다.
--
-- ★ position의 의미 변경: 더 이상 1..N 연속 번호가 아니다. 사용자에게
--   노출되지 않는 Event 내부 정렬 토큰이며, 상대 순서만 의미를 갖는다.
--   (UI는 position 숫자를 표시하지 않고 배열 순서만 사용한다. 조회 측
--   결정성은 GET /games의 position ASC, id ASC 정렬이 담당한다.)
--
-- ------------------------------------------------------------
-- 유지하는 것 (0058 정의를 기준으로 재정의하며 전부 그대로 보존)
-- ------------------------------------------------------------
--   signature (uuid, uuid, uuid[]) / returns void / language plpgsql
--   SECURITY DEFINER / set search_path = '' / owner / execute ACL
--   events row FOR UPDATE  ·  cancelled Event 차단(EVENT_STRUCTURE_LOCKED)
--   slot_mode='none' 검증  ·  payload null·중복 id 검증
--   대상 집합 정확한 일치 검증(id set mismatch — 다른 Event/Club id 혼입 차단)
--   현재 순서와 동일한 payload의 no-op  ·  단일 트랜잭션
--   오류 코드 계열(EVENT_GAME_REORDER_INVALID: …) 및 API 매핑
--
-- 스키마·인덱스·제약 변경 없음. backfill 없음(이번 migration은 데이터를
-- 쓰지 않는다). 기존에 이미 중복 position이 있는 Event가 있다면 이 수정으로
-- 새 중복은 더 발생하지 않지만 기존 값이 자동 정리되지는 않는다 —
-- 적용 직전 read-only 점검으로 확인한다.
-- ============================================================

begin;

create or replace function public.reorder_event_games(
  p_event_id uuid,
  p_club_id uuid,
  p_game_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_slot_mode text;
  v_desired_ids uuid[];
  v_len integer;
  v_distinct_len integer;
  v_current_order uuid[];
  v_event_max bigint;
  v_target_count bigint;
begin
  select status, match_config->>'slot_mode' into v_event_status, v_slot_mode
  from public.events
  where id = p_event_id and club_id = p_club_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event_status = 'cancelled' then
    raise exception 'EVENT_STRUCTURE_LOCKED';
  end if;
  if v_slot_mode <> 'none' then
    raise exception 'EVENT_GAME_REORDER_INVALID: reorder is only available in none mode';
  end if;

  if p_game_ids is null then
    raise exception 'EVENT_GAME_REORDER_INVALID: game ids array is required';
  end if;

  v_desired_ids := p_game_ids;

  v_len := array_length(v_desired_ids, 1);
  if v_len is not null then
    select count(distinct x) into v_distinct_len from unnest(v_desired_ids) as x;
    if v_distinct_len <> v_len then
      raise exception 'EVENT_GAME_REORDER_INVALID: duplicate id';
    end if;
  end if;

  -- 대상(none 모드 draft 실행 큐) 집합을 id 오름차순으로 잠근다(교착 방지, 0045/0051과 동일 원리).
  perform 1
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status = 'draft' and event_session_id is null
  order by id
  for update;

  select coalesce(array_agg(id order by position, id), array[]::uuid[])
    into v_current_order
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id
    and status = 'draft' and event_session_id is null;

  if (select coalesce(array_agg(x order by x), array[]::uuid[]) from unnest(v_current_order) as x)
     is distinct from
     (select coalesce(array_agg(x order by x), array[]::uuid[]) from unnest(v_desired_ids) as x)
  then
    raise exception 'EVENT_GAME_REORDER_INVALID: id set mismatch';
  end if;

  -- no-op: 집합만이 아니라 순서까지 현재와 완전히 동일.
  if v_current_order = v_desired_ids then
    return;
  end if;

  -- ★ 0060: 큐가 아니라 Event 전체 게임의 최대 position을 기준으로 삼는다.
  -- 큐 기준으로 계산하면 completed/cancelled 게임의 position을 지나칠 수 있어
  -- 최종 1..N 부여 시 그 값과 충돌했다.
  select coalesce(max(position), 0)::bigint into v_event_max
  from public.event_games
  where event_id = p_event_id and club_id = p_club_id;

  v_target_count := coalesce(array_length(v_desired_ids, 1), 0)::bigint;

  -- overflow 검사는 offset이 아니라 "최종 최대값"을 본다. 좌변 전체가 bigint로
  -- 계산되므로 검사 도중에 int4 overflow가 먼저 터지지 않는다. 초과 시 UPDATE
  -- 이전에 예외를 던지므로 부분 update가 남지 않는다.
  if v_event_max + v_target_count > 2147483647 then
    raise exception 'EVENT_GAME_REORDER_INVALID: position overflow';
  end if;

  -- 단일 UPDATE — 목표 구간(eventMax+1 .. eventMax+N)이 기존 모든 position보다
  -- 크므로 임시 이동 단계가 필요 없다. id뿐 아니라 event_id/club_id까지 조건에
  -- 넣어 UPDATE 자체도 Club/Event 경계를 강제한다(위 집합 일치 검증과 이중 방어).
  update public.event_games eg
  set position = (v_event_max + ord.rn)::integer, updated_at = now()
  from unnest(v_desired_ids) with ordinality as ord(id, rn)
  where eg.id = ord.id
    and eg.event_id = p_event_id
    and eg.club_id = p_club_id;
end;
$$;

-- CREATE OR REPLACE는 기존 ACL과 owner를 보존하지만, 0051~0059 관례를 따라
-- 명시적으로 다시 선언한다.
revoke all on function public.reorder_event_games(uuid, uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.reorder_event_games(uuid, uuid, uuid[])
to service_role;

commit;

-- ============================================================
-- ROLLBACK (필요 시)
-- ============================================================
-- 0058_game_centered_event_foundation.sql의 reorder_event_games 정의를
-- 그대로 다시 실행하면 된다(이미 CREATE OR REPLACE 형태다). 스키마 변경이
-- 없으므로 데이터 되돌림은 필요 없다.
--
-- 주의: rollback하면 위 문제(교차 상태 position 중복과 그로 인한 결과 초기화
-- 23505)가 되살아난다. 되돌린 뒤 reorder를 실행하면 새 중복이 생길 수 있다.
