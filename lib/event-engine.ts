export interface EventRpcErrorInfo {
  status: number;
  message: string;
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
    return { status: 409, message: "완료되었거나 취소된 이벤트는 참가자 명단을 변경할 수 없습니다." };
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

  return { status: 500, message: fallback };
}
