import type { MatchSlotMode } from "@/lib/supabase/database.types";

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
  if (msg.startsWith("EVENT_STRUCTURE_LOCKED")) {
    return { status: 409, message: "완료되었거나 취소된 이벤트는 구조를 변경할 수 없습니다." };
  }
  // normalize_match_config(0050) — 이번 phase UI는 match_config를 편집하지
  // 않아 실사용 경로는 없지만, update_event가 받는 인자라 방어적으로 매핑.
  if (msg.startsWith("CONFIG_")) {
    return { status: 400, message: "설정값이 올바르지 않습니다." };
  }

  // event_participants (0052)
  if (msg.startsWith("EVENT_PARTICIPANT_NOT_FOUND")) {
    return { status: 404, message: "참가자를 찾을 수 없습니다." };
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

  return { status: 500, message: fallback };
}
