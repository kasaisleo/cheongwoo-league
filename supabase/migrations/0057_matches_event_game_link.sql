-- ============================================================
-- 0057: Event 결과 연결 schema (Match System 2.0 — Phase 2A-7B-1)
--
-- 확정된 기본 아키텍처(2A-7A 승인):
--   event_games          = Event 대진·배치·진행 상태의 source of truth
--   matches              = 확정된 점수·승패·기록 반영의 source of truth
--   matches.event_game_id = 두 도메인의 1:1 연결
--
--   별도 event_game_results 테이블은 만들지 않는다 — matches에 점수·승자
--   구조(score_a/score_b/score_a_tiebreak/score_b_tiebreak/winner_team)가
--   이미 있고, _match_apply_effects/_match_undo_effects(0045)가 포인트·전적
--   반영과 역적용을 이미 구현하고 있다. 결과를 양쪽에 중복 저장하면 수정·
--   취소 시 불일치 위험만 커진다. Event UI는 연결된 matches를 조회해 표시한다.
--
-- 이번 migration은 schema만 준비한다 — 결과 RPC/API/UI는 후속 단계(2A-7B-2
-- 이후)에서 구현한다. 이 파일은 함수를 하나도 만들거나 재정의하지 않는다.
--
-- ------------------------------------------------------------
-- Production read-only 실측 결과 (이 migration 작성 근거, write 0건)
-- ------------------------------------------------------------
--   matches.club_id          : uuid, NOT NULL, FK → clubs.id, null 행 0건 / 총 9건
--                              → event_game_id IS NULL OR club_id IS NOT NULL
--                                invariant CHECK는 불필요(컬럼 NOT NULL이 이미 보장).
--   matches.event_game_id    : 없음 (신규 추가 대상)
--   matches.session_id       : nullable — Event 유래 Match는 출석 세션이 없으므로
--                              null로 저장된다(출처는 event_game_id가 대신한다).
--                              현재 9건 전부 session_id non-null(전부 legacy).
--   matches.idempotency_key  : nullable, (club_id, idempotency_key) partial unique
--                              (matches_club_idempotency_key_uniq, 0046).
--                              현재 9건 전부 null.
--   event_games.completed_at : 없음 (신규 추가 대상)
--   event_games unique       : PK(id) + event_games_id_event_club_uniq
--                              (id, event_id, club_id)뿐 — (id, club_id) unique는 없음.
--   event_games 데이터        : 1건(status='draft') — backfill 대상 없음.
--   이름 충돌               : event_games_id_club_uniq / matches_event_game_club_fk /
--                              matches_event_game_uniq 세 이름 모두 기존 migration 미사용.
--
--   matches 권한: 0041이 public/anon/authenticated에서 table-level로 revoke했고
--   service_role/postgres 권한은 건드리지 않았다. column-level grant가 아니므로
--   신규 컬럼 추가로 권한이 바뀌지 않는다 — 이 migration은 grant/revoke를
--   전혀 수정하지 않는다.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) event_games.completed_at — 결과 확정 시각
-- ------------------------------------------------------------
-- 계약(2A-7B-1 확정 정책 1~3):
--   · 결과 확정(complete_event_game)     → completed_at = now()
--   · 결과 취소/reopen(reopen_event_game) → completed_at = null
--   · status='completed'인 game은 반드시 completed_at이 non-null이어야 하지만,
--     그 invariant는 CHECK로 걸지 않는다 — 기존 event_games 행(현재 draft 1건)
--     을 backfill하지 않기로 확정했고, status/completed_at을 함께 갱신하는
--     경로가 결과 RPC 단일 지점으로 제한되기 때문이다(2A-7B-2에서 구현).
--   · completed_at은 "현재 결과가 확정된 시각"만 나타낸다 — reopen 후 재확정하면
--     새 시각으로 덮인다. 감사 이력 테이블을 대신하지 않는다(확정 정책 명시).
--   · cancelled game은 결과를 가질 수 없으므로 completed_at도 항상 null이다.
alter table public.event_games
  add column completed_at timestamptz;

comment on column public.event_games.completed_at is
  '결과가 확정된 시각(0057). complete_event_game이 now()로 기록하고
   reopen_event_game이 null로 되돌린다. 재확정 시 새 시각으로 덮이므로
   확정 이력이 아니라 "현재 확정 시각"만 의미한다 — 감사 이력 테이블을
   대신하지 않는다. cancelled game은 항상 null.';

-- ------------------------------------------------------------
-- 2) event_games (id, club_id) unique — 복합 FK 참조 대상
-- ------------------------------------------------------------
-- id가 PK이므로 (id, club_id)는 자명하게 unique다. 이 제약의 목적은 유일성
-- 확보가 아니라, matches가 club 경계를 담은 복합 FK로 참조할 수 있는 key를
-- 제공하는 것이다(0052/0054가 events/event_courts/event_sessions에 대해
-- 이미 쓴 것과 동일한 관례 — 기존 event_games_id_event_club_uniq도 같은
-- 이유로 존재한다). 기존 3컬럼 unique는 (id, event_id, club_id)라서
-- 2컬럼 FK의 참조 대상이 될 수 없어 새 key가 필요하다.
alter table public.event_games
  add constraint event_games_id_club_uniq unique (id, club_id);

-- ------------------------------------------------------------
-- 3) matches.event_game_id + 복합 FK
-- ------------------------------------------------------------
alter table public.matches
  add column event_game_id uuid;

comment on column public.matches.event_game_id is
  'Match System 2.0 — 이 Match가 확정한 Event 게임(0057). Event 유래 Match만
   채워지고 legacy 경기(출석 세션 기반)는 null로 남는다. Event game당 Match는
   최대 1건(matches_event_game_uniq). club 경계는 (event_game_id, club_id)
   복합 FK가 DB 레벨에서 강제한다.';

-- club 경계를 FK 자체에 담는다 — 단일 컬럼 FK(event_game_id → event_games.id)
-- 로는 "다른 클럽의 Event game에 이 클럽 Match를 연결"하는 cross-club 오류를
-- 막을 수 없다. matches.club_id가 NOT NULL이므로(위 실측) 이 FK에서 null이
-- 될 수 있는 컬럼은 event_game_id 하나뿐이고, MATCH SIMPLE(기본값) 규칙상
-- event_game_id가 null이면 FK 검사 자체가 생략된다 → 기존 legacy Match 9건과
-- 앞으로 생성되는 legacy 경기는 전부 그대로 통과한다.
--
-- ON DELETE / ON UPDATE는 모두 NO ACTION(기본값)이다. CASCADE는 사용하지
-- 않는다 — 확정된 경기 기록과 그에 딸린 포인트·전적이 Event game 삭제로
-- 조용히 사라지는 구조를 만들지 않기 위함이다. event_games에는 삭제 RPC가
-- 애초에 없고(종료는 status='cancelled', 행은 영구 보존) DML도 전 role에서
-- revoke되어 있으므로, 이 FK는 "직접 SQL로 삭제를 시도하면 거부"하는
-- 최종 방어선으로 동작한다.
alter table public.matches
  add constraint matches_event_game_club_fk
  foreign key (event_game_id, club_id)
  references public.event_games (id, club_id);

-- ------------------------------------------------------------
-- 4) Event game당 Match 최대 1건
-- ------------------------------------------------------------
-- partial unique여야 한다 — event_game_id가 null인 legacy Match가 이미 9건
-- 있고 계속 생성되므로, 일반 unique index는 두 번째 legacy 경기부터 실패한다
-- (null은 unique에서 서로 충돌하지 않지만, 조건을 명시해 의도를 남긴다).
--
-- 이 index는 결과 확정의 최종 방어선이다. complete_event_game의 status 검사와
-- 멱등 조회를 통과한 동시 요청 두 건이 남아도, 두 번째 INSERT가 이 index에서
-- 실패한다 → 2A-7B-2에서 constraint 이름으로 판별해
-- EVENT_GAME_RESULT_EXISTS로 변환한다(get stacked diagnostics 방식,
-- 0054 create_event_game이 event_games_active_session_uniq에 대해 쓴 것과 동일).
--
-- Event 상세에서 game → 연결 Match를 역방향 조회하는 인덱스 역할도 겸한다.
create unique index matches_event_game_uniq
  on public.matches (event_game_id)
  where event_game_id is not null;

commit;

-- ============================================================
-- 후속 단계에 반드시 반영할 계약 (이번 migration에서는 함수를 수정하지 않음)
-- ============================================================
--
-- [2A-7B-2] complete_event_game / update_event_game_result / reopen_event_game
--
--   (a) 결과 입력 선행조건 — P0 (확정 정책):
--         events.participants_confirmed_at IS NULL → EVENT_PARTICIPANTS_NOT_CONFIRMED
--         events.scheduling_confirmed_at   IS NULL → EVENT_SCHEDULING_NOT_CONFIRMED
--       slot_mode='none'도 예외가 아니다 — confirm_event_scheduling(0053)은
--       none 모드에서 활성 코트만 요구하고 슬롯을 요구하지 않으므로 정상
--       확정 가능하며, "이 코트 구성으로 운영한다"는 확정 의미가 성립한다.
--       따라서 E2E 순서는 스케줄 확정 → 결과 입력 → Event 완료다.
--
--   (b) 멱등성 기준 — 2A-7A의 기준을 정정한 확정안:
--         조회 키는 (club_id, idempotency_key) — 기존
--         matches_club_idempotency_key_uniq(0046)와 동일한 기준이어야 한다.
--         (event_game_id, idempotency_key)로 조회하면, 같은 key가 다른 Event
--         game에 재사용된 경우를 놓치고 unique 위반으로 늦게 터진다.
--       조회 후 전체 payload를 비교한다:
--         event_game_id / score_a / score_b / score_a_tiebreak /
--         score_b_tiebreak / winner_team / 선수 슬롯 8개 / club_id /
--         played_at / session_id(Event 유래는 null)
--       · payload 동일       → 기존 Match를 그대로 반환(효과 재적용 금지)
--       · key 동일 payload 상이(다른 event_game_id 포함) → IDEMPOTENCY_CONFLICT
--       기존 _match_idempotency_payload_matches(0046)는 비교 대상에
--       event_game_id가 없으므로 그대로 쓸 수 없다 — Event 전용 helper 필요.
--
--   (c) 결과 취소 시 연결 Match는 hard delete (확정 정책 4):
--       _match_undo_effects로 포인트·전적을 역적용한 뒤 matches 행을 삭제한다.
--       point_history.match_id는 ON DELETE SET NULL(0009)이라 포인트 이력
--       (regular_match_win/loss + regular_match_rollback)은 보존된다.
--       matches에 soft-delete 컬럼이 없고 matches_event_game_uniq가 살아 있어,
--       행을 남기면 재확정이 불가능해지기 때문이다.
--
--   (d) 결과 수정 시 승자가 동일하면 undo/apply를 생략한다(확정 정책 6) —
--       점수만 갱신한다. point_history에 상쇄용 잡음을 남기지 않기 위함이다.
--
--   (e) winner_team ↔ 점수 정합성은 Event 신규 결과 경로에서만 검사한다
--       (확정 정책 5). legacy create/update_match_with_effects는 점수 범위
--       0..7과 타이브레이크 유무만 보고 승자-점수 일치를 검사하지 않지만,
--       회귀 위험 때문에 legacy 함수는 손대지 않는다.
--       승자는 점수에서 자동 계산하고 UI에서 확인한다(확정 정책 8).
--
--   (f) 단식(format='singles')은 이번 범위에서 결과 확정 불가 —
--       matches의 chk_team_a_player2_exactly_one 등 4개 XOR CHECK가 player2
--       슬롯을 비울 수 없게 만들기 때문이다(0003). 명시적으로
--       EVENT_GAME_SINGLES_RESULT_UNSUPPORTED로 거부한다. 근본 해결(matches
--       스키마 완화)은 별도 Phase.
--
--   (g) in_progress 전환·UI는 후속 Phase로 연기한다(확정 정책 7).
--       다만 complete_event_game의 game status 검사는 처음부터
--       status in ('draft','in_progress')를 허용해 확장 지점을 남긴다.
--
--   (h) 잠금 순서 — 2A-7A의 "event_games → events"를 폐기하고 다음으로 통일한다:
--         events → event_games → matches → event_participants → members/guests
--       최소한 Event 상태 전환과 결과 입력이 동일한 부모 events 행에서 먼저
--       직렬화되어야 한다. 2A-7B-2 착수 전에 기존 Event/Match mutation RPC
--       전체(0050~0054, 0045/0046)의 실제 잠금 순서를 전수 확인해 교착
--       가능성을 보고한다.
--
-- [2A-7B-4] update_event / update_event_participant
--
--   (i) → completed 전환 검증 추가:
--         participants_confirmed_at IS NULL          → EVENT_PARTICIPANTS_NOT_CONFIRMED
--         scheduling_confirmed_at   IS NULL          → EVENT_SCHEDULING_NOT_CONFIRMED
--         non-cancelled game 0건                     → EVENT_NO_ACTIVE_GAMES
--         draft/in_progress game 존재                → EVENT_GAMES_NOT_FINISHED
--         completed game 0건(cancelled만 존재)       → EVENT_NO_COMPLETED_GAMES
--         completed game의 연결 Match가 1건이 아님   → EVENT_GAME_RESULT_MISSING
--       completed_at = coalesce(completed_at, now())는 기존 동작 유지.
--
--   (j) ★ Event 취소 안전성 — P0 (2A-7A 누락분, 이번 승인에서 추가 확정):
--         completed game 또는 연결 Match가 존재하는 Event는
--         cancelled로 전환할 수 없다 → EVENT_HAS_COMPLETED_GAMES (HTTP 409,
--         "확정된 경기 결과가 있습니다. 경기 결과를 먼저 취소한 뒤
--          Event를 취소해주세요.")
--       이유: 결과 확정 시 포인트·전적이 즉시 반영되는데, 그 상태에서 부모
--       Event가 cancelled가 되면 결과 Match와 포인트가 그대로 남는다. 게다가
--       cancelled는 terminal이라(update_event: cancelled → 어떤 상태로도 전이
--       불가) 이후 결과 수정·취소 경로까지 영구 차단되어 되돌릴 방법이 없다.
--       올바른 순서: 모든 completed game을 reopen → 연결 Match 제거 →
--       Event를 cancelled로 전환.
--
--   (k) 참가자 제외 무결성 — update_event_participant가 status를
--       withdrawn/excluded(= is_active=false)로 바꾸기 전에 검사:
--         in_progress/completed game에 배정 → EVENT_PARTICIPANT_IN_FINISHED_GAME
--         draft game에 배정               → EVENT_PARTICIPANT_IN_DRAFT_GAME
--       event_game_players_participant_fk는 행 삭제만 막고 status 변경은 막지
--       못하므로 명시적 오류가 유일한 방어선이다.
--
-- [2A-7D] UI 주의사항
--
--   (l) completed Event의 상태 선택기 전체를 locked 처리하면 안 된다 —
--       completed → active 재활성화 진입은 계속 제공해야 한다. 잠가야 하는
--       것은 Event 하위 구조(참가자·코트·슬롯·대진)와 결과 편집이다.
--       cancelled Event만 terminal 읽기 전용이다.
--
-- ============================================================
-- ROLLBACK (필요 시 아래를 그대로 실행)
-- ============================================================
-- begin;
--
-- drop index if exists public.matches_event_game_uniq;
--
-- alter table public.matches
--   drop constraint if exists matches_event_game_club_fk;
--
-- alter table public.matches
--   drop column if exists event_game_id;
--
-- alter table public.event_games
--   drop constraint if exists event_games_id_club_uniq;
--
-- alter table public.event_games
--   drop column if exists completed_at;
--
-- commit;
--
-- 참고: 이 rollback은 Event 결과가 이미 확정된 뒤에 실행하면 matches와
-- event_games의 연결 정보를 잃는다(포인트·전적은 남고 출처만 사라진다).
-- 결과 확정 데이터가 존재하는 상태에서는 실행 전 별도 조사·승인이 필요하다.
