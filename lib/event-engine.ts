import type {
  EventGameFormat,
  EventGameGenderCategory,
  EventGameTeam,
  MatchSlotMode,
} from "@/lib/supabase/database.types";

export interface EventRpcErrorInfo {
  status: number;
  message: string;
}

/** slot_mode(0050) → 사용자 노출 문구(2A-5B 확정). 클럽명/원시 enum을 노출하지 않는다. */
export const SLOT_MODE_LABEL: Record<MatchSlotMode, string> = {
  none: "실시간 순차 운영",
  ordered: "순번 슬롯 운영",
  timed: "시간 슬롯 운영",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** API route에서 path param/body의 uuid 필드를 RPC에 넘기기 전에 형식만 검증(2A-5B). */
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** event_sessions.starts_at/ends_at 등 timestamptz 필드용 ISO 문자열 형식 검증(2A-5B). */
export function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_TIMESTAMP_RE.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** event_courts.name/event_sessions.label 등 자유 입력 텍스트 필드의 길이 상한(UX용 — DB는 not-blank만 강제). */
export function isValidBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/** event_courts/event_sessions position 인자 — DB는 int4(>=1)만 강제, 상한은 오버플로 방지용 여유값. */
export function isValidPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100000;
}

/**
 * 대진 라인업 입력(2A-6B) — API는 읽기 쉬운 객체 배열로 받고, RPC 계약(3개
 * 병렬 배열)으로 변환한다. 정원(singles 2 / doubles 4)·중복·자리 중복은 RPC가
 * 최종 검증하지만, 형식 오류는 DB 왕복 없이 여기서 먼저 걸러 400으로 돌려준다.
 */
/** 0076: Game 종류 표시 문구. 원시 값을 화면에 노출하지 않는다. */
export const GENDER_CATEGORY_LABEL: Record<EventGameGenderCategory, string> = {
  mens: "남복",
  womens: "여복",
  mixed: "혼복",
  open: "잡복",
};

/** 0076: gender_category 미분류(null) 표시 문구. */
export const GENDER_CATEGORY_UNSET_LABEL = "미분류";

export const GENDER_CATEGORIES: readonly EventGameGenderCategory[] = [
  "mens",
  "womens",
  "mixed",
  "open",
] as const;

/**
 * 0076: PATCH .../gender-category 의 genderCategory 값 검증.
 *
 * null 은 "해제"라는 명시적 의미다 — 완성된 lineup 이 있으면 RPC 가 즉시
 * 재판정해 inferred 로 두고, lineup 이 없으면 종류와 source 를 모두 지운다.
 * key 자체가 없으면(undefined) 무엇을 하려는지 알 수 없으므로 거부한다.
 */
export function parseGenderCategory(
  raw: unknown
): { ok: true; value: EventGameGenderCategory | null } | { ok: false; message: string } {
  if (raw === undefined) {
    return { ok: false, message: "게임 종류 값이 필요합니다." };
  }
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw === "string" && (GENDER_CATEGORIES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as EventGameGenderCategory };
  }
  return { ok: false, message: "게임 종류 값이 올바르지 않습니다." };
}

export interface GameLineupInput {
  participantIds: string[];
  teams: EventGameTeam[];
  slots: number[];
}

export function parseGameLineup(
  raw: unknown,
  format: EventGameFormat
): { ok: true; lineup: GameLineupInput } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "선수 목록이 필요합니다." };
  }
  const required = format === "singles" ? 2 : 4;
  if (raw.length !== required) {
    return { ok: false, message: `${format === "singles" ? "단식은 2명" : "복식은 4명"}을 지정해야 합니다.` };
  }

  const participantIds: string[] = [];
  const teams: EventGameTeam[] = [];
  const slots: number[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, message: "선수 정보 형식이 올바르지 않습니다." };
    }
    const { eventParticipantId, team, slot } = entry as {
      eventParticipantId?: unknown;
      team?: unknown;
      slot?: unknown;
    };
    if (!isValidUuid(eventParticipantId)) {
      return { ok: false, message: "참가자 정보가 올바르지 않습니다." };
    }
    if (team !== "A" && team !== "B") {
      return { ok: false, message: "팀 값이 올바르지 않습니다." };
    }
    if (slot !== 1 && slot !== 2) {
      return { ok: false, message: "자리 값이 올바르지 않습니다." };
    }
    if (format === "singles" && slot !== 1) {
      return { ok: false, message: "단식에서는 2번 자리를 사용할 수 없습니다." };
    }
    participantIds.push(eventParticipantId);
    teams.push(team);
    slots.push(slot);
  }

  if (new Set(participantIds).size !== participantIds.length) {
    return { ok: false, message: "같은 참가자를 중복해서 넣을 수 없습니다." };
  }
  if (new Set(teams.map((t, i) => `${t}:${slots[i]}`)).size !== teams.length) {
    return { ok: false, message: "같은 팀·자리에 두 명을 넣을 수 없습니다." };
  }

  return { ok: true, lineup: { participantIds, teams, slots } };
}

/**
 * events/event_participants RPC(supabase/migrations/0050/0052)가 던지는 예외
 * 접두사를 HTTP 응답으로 변환한다. session-engine.ts/match-engine.ts와 동일한
 * "msg.startsWith(CODE)" 패턴 — 알려진 코드는 4xx로, 그 외는 fallback(500).
 *
 * confirm_event_participants(EVENT_NO_ACTIVE_PARTICIPANTS)와 import_event_
 * participants_from_attendance(ATTENDANCE_SESSION_NOT_FOUND/ATTENDANCE_MEMBER_
 * SCOPE_INVALID/SESSION_GUEST_SCOPE_INVALID)의 코드도 함께 매핑해두지만,
 * 이 두 RPC를 실제로 호출하는 API route는 Phase 2A-4A 범위 밖(2A-4B)이라
 * 아직 어디서도 쓰이지 않는다 — 미리 정의만 해둔다.
 */
export function mapEventRpcError(errorMessage: string | undefined, fallback: string): EventRpcErrorInfo {
  const msg = errorMessage ?? "";

  // events (0050)
  if (msg.startsWith("EVENT_NOT_FOUND")) {
    return { status: 404, message: "이벤트를 찾을 수 없습니다." };
  }
  if (msg.startsWith("CLUB_NOT_FOUND") || msg.startsWith("CLUB_INACTIVE")) {
    return { status: 403, message: "클럽 컨텍스트가 올바르지 않습니다." };
  }
  if (msg.startsWith("INVALID_TITLE")) {
    return { status: 400, message: "이벤트명을 입력해주세요." };
  }
  if (msg.startsWith("INVALID_EVENT_DATE")) {
    return { status: 400, message: "날짜를 선택해주세요." };
  }
  if (msg.startsWith("CREATED_BY_CLUB_MISMATCH")) {
    return { status: 400, message: "작성자 정보가 올바르지 않습니다." };
  }
  if (msg.startsWith("EVENT_STATUS_TERMINAL")) {
    return { status: 409, message: "취소된 이벤트는 상태를 변경할 수 없습니다." };
  }
  if (msg.startsWith("INVALID_STATUS_TRANSITION")) {
    return { status: 409, message: "허용되지 않는 상태 변경입니다." };
  }
  // completed Event 구조 잠금(0061 ensure + 0062의 구조 mutation 6개)은 하위
  // 이유를 붙여 올린다. 0062 이후 이 접미사를 쓰는 함수가 여러 개이므로 문구를
  // "게임 추가" 전용이 아닌 구조 변경 일반으로 둔다 — 순서 변경·선수 배정·
  // 취소에도 같은 문구가 맞아야 한다. 반드시 무접미사 매핑보다 먼저 검사한다.
  if (msg.startsWith("EVENT_STRUCTURE_LOCKED: event is completed")) {
    return { status: 409, message: "완료된 이벤트는 대진 구조를 변경할 수 없습니다." };
  }
  // 접미사 없이 이 코드를 올리는 조건은 status='cancelled' 하나뿐이다
  // (0058이 completed를 잠금에서 제외했고, 0062가 completed를 위 접미사 형태로
  // 되돌려 넣었으므로 무접미사는 여전히 cancelled 전용이다).
  if (msg.startsWith("EVENT_STRUCTURE_LOCKED")) {
    return { status: 409, message: "취소된 이벤트는 변경할 수 없습니다." };
  }
  // Event 완료 전제조건 (0062) — 상태 전환 실패이므로 409.
  if (msg.startsWith("EVENT_COMPLETION_NO_GAMES")) {
    return { status: 409, message: "완료할 게임이 없습니다." };
  }
  if (msg.startsWith("EVENT_COMPLETION_GAMES_INCOMPLETE")) {
    return { status: 409, message: "모든 게임의 결과를 입력해야 이벤트를 완료할 수 있습니다." };
  }
  // 운영 방식(slot_mode) 전환 잠금 (0063, 2A-8C)
  //
  // 하위 이유가 있는 것을 먼저 검사한다 — 관리자가 "무엇을 정리해야 바꿀 수
  // 있는지"를 문구만 보고 알 수 있어야 한다. completed/cancelled는 위의
  // EVENT_STRUCTURE_LOCKED 매핑(0062)을 그대로 재사용한다.
  if (msg.startsWith("EVENT_SLOT_MODE_LOCKED: active sessions exist")) {
    return {
      status: 409,
      message: "활성 슬롯이 있어 운영 방식을 변경할 수 없습니다. 슬롯을 먼저 비활성화해 주세요.",
    };
  }
  if (msg.startsWith("EVENT_SLOT_MODE_LOCKED: games are assigned to sessions")) {
    return { status: 409, message: "슬롯에 배정된 게임이 있어 운영 방식을 변경할 수 없습니다." };
  }
  // 0058 update_event가 접미사 없이 올리는 경우까지 포함.
  if (msg.startsWith("EVENT_SLOT_MODE_LOCKED")) {
    return { status: 409, message: "현재 구성에서는 운영 방식을 변경할 수 없습니다." };
  }
  // 0063: update_event(p_match_config)로 slot_mode를 바꾸려 한 경우.
  // 그 경로는 전환 잠금(활성 슬롯·슬롯 배정 게임)을 우회하므로 차단하고
  // 전용 설정 화면으로 유도한다.
  if (msg.startsWith("EVENT_SLOT_MODE_DEDICATED_PATH_REQUIRED")) {
    return { status: 409, message: "운영 방식은 전용 설정에서 변경해 주세요." };
  }
  // 0063 update_event_slot_mode / 0050 normalize_match_config 공통.
  // 일반 CONFIG_ 매핑보다 먼저 검사해 구체적인 문구를 준다.
  if (msg.startsWith("CONFIG_INVALID_SLOT_MODE")) {
    return { status: 400, message: "운영 방식이 올바르지 않습니다." };
  }
  // normalize_match_config(0050) — update_event가 받는 인자라 방어적으로 매핑.
  if (msg.startsWith("CONFIG_")) {
    return { status: 400, message: "설정값이 올바르지 않습니다." };
  }

  // event_participants (0052)
  if (msg.startsWith("EVENT_PARTICIPANT_NOT_FOUND")) {
    return { status: 404, message: "참가자를 찾을 수 없습니다." };
  }
  // 0074: 자동 대진용 snapshot 값 검증. API가 먼저 거르지만 RPC도 자체 검증한다.
  if (msg.startsWith("EVENT_PARTICIPANT_PROFILE_INVALID")) {
    return { status: 400, message: "참가자 정보 값이 올바르지 않습니다." };
  }
  if (msg.startsWith("PARTICIPANT_MEMBER_NOT_FOUND")) {
    return { status: 404, message: "회원을 찾을 수 없습니다." };
  }
  if (msg.startsWith("PARTICIPANT_GUEST_NOT_FOUND")) {
    return { status: 404, message: "게스트를 찾을 수 없습니다." };
  }
  if (msg.startsWith("PARTICIPANT_MEMBER_INACTIVE")) {
    return { status: 400, message: "비활성 회원은 추가할 수 없습니다." };
  }
  if (msg.startsWith("PARTICIPANT_GUEST_INACTIVE")) {
    return { status: 400, message: "비활성 게스트는 추가할 수 없습니다." };
  }
  if (msg.startsWith("PARTICIPANT_DISPLAY_NAME_BLANK")) {
    return { status: 400, message: "표시 이름이 비어 있습니다." };
  }
  if (msg.startsWith("INVALID_PARTICIPANT_SELECTOR")) {
    return { status: 400, message: "회원 또는 게스트 중 하나만 선택해주세요." };
  }
  if (msg.startsWith("INVALID_PARTICIPANT_STATUS")) {
    return { status: 400, message: "허용되지 않는 참가자 상태입니다." };
  }
  if (msg.startsWith("EVENT_PARTICIPANT_ALREADY_ACTIVE")) {
    return { status: 409, message: "이미 참가 중입니다." };
  }
  if (msg.startsWith("EVENT_PARTICIPANT_EXCLUDED")) {
    return {
      status: 409,
      message: "제외 처리된 참가자입니다. 다시 추가하려면 명단에서 먼저 제외를 해제해주세요.",
    };
  }
  // 2A-4B(import/confirm) 전용 — 아직 호출부 없음, 정의만 선반영.
  if (msg.startsWith("ATTENDANCE_SESSION_NOT_FOUND")) {
    return { status: 404, message: "출석 세션을 찾을 수 없습니다." };
  }
  if (msg.startsWith("ATTENDANCE_MEMBER_SCOPE_INVALID") || msg.startsWith("SESSION_GUEST_SCOPE_INVALID")) {
    return { status: 400, message: "출석 데이터가 이 클럽 소속이 아닙니다." };
  }
  if (msg.startsWith("EVENT_NO_ACTIVE_PARTICIPANTS")) {
    return { status: 409, message: "활성 참가자가 없어 확정할 수 없습니다." };
  }

  // event_courts (0051)
  if (msg.startsWith("EVENT_COURT_NOT_FOUND")) {
    return { status: 404, message: "코트를 찾을 수 없습니다." };
  }
  if (msg.startsWith("EVENT_COURT_INACTIVE")) {
    return { status: 409, message: "비활성화된 코트에는 슬롯을 추가하거나 되돌릴 수 없습니다." };
  }
  if (msg.startsWith("EVENT_COURT_HAS_ACTIVE_SESSIONS")) {
    return { status: 409, message: "이 코트를 사용 중인 슬롯이 있어 비활성화할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_COURT_NAME_TAKEN")) {
    return { status: 409, message: "이미 사용 중인 코트 이름입니다." };
  }
  if (msg.startsWith("INVALID_EVENT_COURT_NAME")) {
    return { status: 400, message: "코트 이름을 입력해주세요." };
  }
  if (msg.startsWith("EVENT_COURT_POSITION_TAKEN")) {
    return { status: 409, message: "이미 사용 중인 순서입니다." };
  }
  if (msg.startsWith("INVALID_EVENT_COURT_POSITION")) {
    return { status: 400, message: "올바르지 않은 순서 값입니다." };
  }
  if (msg.startsWith("EVENT_COURT_POSITION_OVERFLOW")) {
    return { status: 409, message: "코트 순서 값이 한도를 초과했습니다." };
  }
  if (msg.startsWith("EVENT_COURT_REORDER_TOO_LARGE")) {
    return { status: 400, message: "한 번에 재정렬할 수 있는 코트 수를 초과했습니다." };
  }
  if (msg.startsWith("EVENT_COURT_REORDER_DUPLICATE_ID")) {
    return { status: 400, message: "재정렬 요청에 중복된 코트가 있습니다." };
  }
  if (msg.startsWith("EVENT_COURT_REORDER_SET_MISMATCH")) {
    return { status: 409, message: "코트 목록이 최신 상태와 일치하지 않습니다. 새로고침 후 다시 시도해주세요." };
  }

  // event_sessions (0051) — TIME_RANGE_INCOMPLETE가 TIME_RANGE의 접두사이므로 먼저 검사.
  if (msg.startsWith("EVENT_SESSION_NOT_FOUND")) {
    return { status: 404, message: "슬롯을 찾을 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_TIME_RANGE_INCOMPLETE")) {
    return { status: 400, message: "시작 시각과 종료 시각을 모두 입력해주세요." };
  }
  if (msg.startsWith("EVENT_SESSION_TIME_RANGE")) {
    return { status: 400, message: "종료 시각은 시작 시각보다 늦어야 합니다." };
  }
  if (msg.startsWith("EVENT_SLOT_MODE_NONE_NO_SESSIONS")) {
    return { status: 409, message: "실시간 순차 운영에서는 슬롯을 만들 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_TIMESTAMPS_NOT_ALLOWED")) {
    return { status: 400, message: "순번 슬롯 운영에서는 시작·종료 시각을 입력할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_TIMESTAMPS_REQUIRED")) {
    return { status: 400, message: "시간 슬롯 운영에서는 시작·종료 시각이 필요합니다." };
  }
  if (msg.startsWith("EVENT_SESSION_OVERLAP")) {
    return { status: 409, message: "같은 코트에 시간이 겹치는 슬롯이 있습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_POSITION_TAKEN")) {
    return { status: 409, message: "이미 사용 중인 순서입니다." };
  }
  if (msg.startsWith("EVENT_SESSION_POSITION_OVERFLOW")) {
    return { status: 409, message: "슬롯 순서 값이 한도를 초과했습니다." };
  }
  if (msg.startsWith("INVALID_EVENT_SESSION_LABEL")) {
    return { status: 400, message: "슬롯 라벨을 입력해주세요." };
  }
  if (msg.startsWith("INVALID_EVENT_SESSION_POSITION")) {
    return { status: 400, message: "올바르지 않은 순서 값입니다." };
  }
  if (msg.startsWith("EVENT_SESSION_CLEAR_TIMES_WITH_VALUE")) {
    return { status: 400, message: "시각을 지우면서 동시에 새 값을 지정할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_CLEAR_LABEL_WITH_VALUE")) {
    return { status: 400, message: "라벨을 지우면서 동시에 새 값을 지정할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_REORDER_TOO_LARGE")) {
    return { status: 400, message: "한 번에 재정렬할 수 있는 슬롯 수를 초과했습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_REORDER_DUPLICATE_ID")) {
    return { status: 400, message: "재정렬 요청에 중복된 슬롯이 있습니다." };
  }
  if (msg.startsWith("EVENT_SESSION_REORDER_SET_MISMATCH")) {
    return { status: 409, message: "슬롯 목록이 최신 상태와 일치하지 않습니다. 새로고침 후 다시 시도해주세요." };
  }

  // confirm_event_scheduling (2A-5C)
  if (msg.startsWith("EVENT_PARTICIPANTS_NOT_CONFIRMED")) {
    return { status: 409, message: "참가자 명단을 먼저 확정해야 스케줄을 확정할 수 있습니다." };
  }
  if (msg.startsWith("EVENT_SCHEDULING_NO_ACTIVE_COURTS")) {
    return { status: 409, message: "활성 코트가 없어 스케줄을 확정할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_SCHEDULING_COURT_MISSING_SESSIONS")) {
    return { status: 409, message: "슬롯이 없는 코트가 있어 스케줄을 확정할 수 없습니다." };
  }

  // event_games / event_game_players (0054, 2A-6B)
  if (msg.startsWith("EVENT_GAME_NOT_FOUND")) {
    return { status: 404, message: "게임을 찾을 수 없습니다." };
  }
  if (msg.startsWith("EVENT_GAME_STRUCTURE_LOCKED")) {
    return { status: 409, message: "진행·완료·취소된 게임은 변경할 수 없습니다." };
  }
  // 0058 이후 배정 자격은 is_active 하나뿐이다(status='confirmed' 요구 제거).
  if (msg.startsWith("EVENT_GAME_PARTICIPANT_UNAVAILABLE")) {
    return {
      status: 409,
      message: "참가 중인 참가자만 대진에 넣을 수 있습니다. 참가자 명단을 확인해주세요.",
    };
  }
  if (msg.startsWith("EVENT_GAME_INVALID_PLAYERS")) {
    return { status: 400, message: "선수 구성이 올바르지 않습니다. 단식은 2명, 복식은 4명이어야 합니다." };
  }
  if (msg.startsWith("EVENT_GAME_COURT_UNAVAILABLE")) {
    return { status: 409, message: "사용할 수 없는 코트입니다. 코트 상태를 확인해주세요." };
  }
  if (msg.startsWith("EVENT_GAME_SESSION_UNAVAILABLE")) {
    return { status: 409, message: "사용할 수 없는 슬롯입니다. 운영 방식과 슬롯 상태를 확인해주세요." };
  }
  if (msg.startsWith("EVENT_GAME_SESSION_CONFLICT")) {
    return { status: 409, message: "이 슬롯에는 이미 다른 게임이 배치되어 있습니다." };
  }
  if (msg.startsWith("EVENT_GAME_PLAYER_TIME_CONFLICT")) {
    return { status: 409, message: "같은 시간대에 이미 배정된 선수가 있습니다." };
  }
  // 0076: ordered 모드 동시 출전. 시간 개념이 없으므로 TIME_CONFLICT를 재사용하지
  // 않고 별도 코드를 쓴다 — "같은 시간대"라는 문구가 순서형 운영에서는 틀리다.
  if (msg.startsWith("EVENT_GAME_PLAYER_SLOT_CONFLICT")) {
    return {
      status: 409,
      message: "같은 순번의 다른 코트에 이미 배정된 선수가 있습니다.",
    };
  }
  // 0076: Game 종류 값 자체가 틀린 경우와, lineup이 지정된 종류의 조건을
  // 어기는 경우를 구분한다. 조건 부족을 잡복으로 자동 완화하지 않는다.
  if (msg.startsWith("EVENT_GAME_CATEGORY_INVALID")) {
    return { status: 400, message: "게임 종류 값이 올바르지 않습니다." };
  }
  if (msg.startsWith("EVENT_GAME_CATEGORY_MISMATCH")) {
    return {
      status: 409,
      message:
        "선수 구성이 지정한 게임 종류와 맞지 않습니다. 남복은 남성 4명, 여복은 여성 4명, 혼복은 복식에서 각 팀 남녀 1명씩이어야 합니다.",
    };
  }
  if (msg.startsWith("EVENT_GAME_REORDER_INVALID")) {
    return { status: 409, message: "게임 순서 정보가 최신 상태와 일치하지 않습니다. 새로고침 후 다시 시도해주세요." };
  }

  // 빈 draft Game 일괄 확보 (0061, 2A-8B)
  //
  // EVENT_NOT_FOUND / EVENT_STRUCTURE_LOCKED는 위에서 이미 매핑된다.
  // 하위 이유별로 코드를 나눠 두었으므로 사용자가 무엇을 고쳐야 하는지
  // 문구만 보고 알 수 있다.
  if (msg.startsWith("EVENT_GAME_BULK_TARGET_INVALID")) {
    return { status: 400, message: "목표 게임 수를 1 ~ 200 사이 정수로 입력해주세요." };
  }
  if (msg.startsWith("EVENT_GAME_BULK_PARTICIPANTS_NOT_CONFIRMED")) {
    return { status: 409, message: "참가자 명단을 먼저 확정해야 게임을 일괄 생성할 수 있습니다." };
  }
  if (msg.startsWith("EVENT_GAME_BULK_PARTICIPANTS_INSUFFICIENT")) {
    return { status: 409, message: "복식 게임을 만들려면 확정된 참가자가 4명 이상이어야 합니다." };
  }
  if (msg.startsWith("EVENT_GAME_BULK_POSITION_OVERFLOW")) {
    return {
      status: 409,
      message: "게임 정렬 값이 한계에 도달해 더 생성할 수 없습니다. 관리자에게 문의해주세요.",
    };
  }

  // 결과 저장·초기화 (0059, 2A-7B-2C)
  //
  // EVENT_GAME_PARTICIPANT_UNAVAILABLE / EVENT_GAME_INVALID_PLAYERS /
  // EVENT_NOT_FOUND / EVENT_GAME_NOT_FOUND / EVENT_STRUCTURE_LOCKED는 위에서
  // 이미 매핑된 코드를 그대로 재사용한다(취소된 이벤트는 EVENT_STRUCTURE_LOCKED로
  // 올라오고, 0058 이후 그 코드가 뜻하는 것은 "취소된 이벤트"뿐이다).
  if (msg.startsWith("EVENT_GAME_CANCELLED_NO_RESULT")) {
    return { status: 409, message: "취소된 게임에는 결과를 저장하거나 초기화할 수 없습니다." };
  }
  // completed Event 결과 정책 (0062) — 정정만 허용, 최초 입력·초기화는 차단.
  if (msg.startsWith("EVENT_RESULT_FIRST_SAVE_LOCKED")) {
    return {
      status: 409,
      message:
        "완료된 이벤트에는 새로운 경기 결과를 입력할 수 없습니다. 이벤트를 진행 중으로 변경한 뒤 입력해 주세요.",
    };
  }
  if (msg.startsWith("EVENT_RESULT_CLEAR_LOCKED")) {
    return {
      status: 409,
      message:
        "완료된 이벤트의 결과는 초기화할 수 없습니다. 이벤트를 진행 중으로 변경한 뒤 초기화해 주세요.",
    };
  }
  if (msg.startsWith("EVENT_GAME_RESULT_FORMAT_UNSUPPORTED")) {
    return { status: 409, message: "현재 결과 입력은 복식 게임만 지원합니다." };
  }
  // 2A-8D: 5:5는 무승부로 허용되므로 이 코드는 "그 밖의 동점"에만 올라온다.
  if (msg.startsWith("EVENT_GAME_RESULT_DRAW_TIEBREAK_NOT_ALLOWED")) {
    return { status: 400, message: "5:5 무승부에는 타이브레이크 점수를 입력할 수 없습니다." };
  }
  if (msg.startsWith("EVENT_GAME_RESULT_TIE_NOT_ALLOWED")) {
    return { status: 400, message: "동점 결과는 5:5 무승부만 저장할 수 있습니다." };
  }
  if (msg.startsWith("EVENT_GAME_RESULT_INCONSISTENT")) {
    return {
      status: 409,
      message: "결과 기록이 서로 맞지 않습니다. 임의로 지우지 않았으니 운영자에게 확인을 요청해주세요.",
    };
  }
  if (msg.startsWith("EVENT_GAME_MATCH_MANAGED_SEPARATELY")) {
    return {
      status: 409,
      message: "이 경기 기록은 게임 결과 저장·초기화로만 변경할 수 있습니다.",
    };
  }
  if (msg.startsWith("INVALID_SCORE")) {
    return { status: 400, message: "점수는 0에서 7 사이여야 합니다." };
  }
  if (msg.startsWith("INVALID_TIEBREAK")) {
    return { status: 400, message: "7-6 경기는 양 팀의 타이브레이크 점수를 모두 입력해야 합니다." };
  }
  if (msg.startsWith("PARTICIPANT_CLUB_MISMATCH")) {
    return { status: 409, message: "선수 정보가 클럽과 일치하지 않습니다. 명단을 확인해주세요." };
  }
  if (msg.startsWith("EFFECT_UPDATE_FAILED")) {
    return { status: 500, message: "기록 반영에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return { status: 500, message: fallback };
}
