export interface SessionRpcErrorInfo {
  status: number;
  message: string;
}

/**
 * create_session_with_attendance(supabase/migrations/0047_attendance_sessions_idempotency.sql)가
 * 던지는 예외 접두사를 HTTP 응답으로 변환한다.
 */
export function mapSessionRpcError(errorMessage: string | undefined, fallback: string): SessionRpcErrorInfo {
  const msg = errorMessage ?? "";

  if (msg.startsWith("INVALID_TITLE")) {
    return { status: 400, message: "매치명을 입력해주세요." };
  }
  if (msg.startsWith("INVALID_SESSION_DATE")) {
    return { status: 400, message: "날짜를 선택해주세요." };
  }
  if (msg.startsWith("CLUB_NOT_FOUND") || msg.startsWith("CLUB_INACTIVE")) {
    return { status: 403, message: "클럽 컨텍스트가 올바르지 않습니다." };
  }
  if (msg.startsWith("SESSION_IDEMPOTENCY_CONFLICT")) {
    // 같은 requestId로 이미 다른 내용의 세션이 저장된 경우(0047) — RPC 원문은
    // 노출하지 않고 고정 메시지만 반환한다. 409는 프런트가 자동 재시도하면
    // 안 된다는 신호이므로, 클라이언트는 requestId를 폐기하고 사용자에게
    // 목록 확인을 안내해야 한다.
    return {
      status: 409,
      message: "같은 저장 요청이 다른 내용으로 이미 처리되었습니다. 목록을 확인한 뒤 다시 시도해주세요.",
    };
  }
  // SESSION_IDEMPOTENCY_RESOLUTION_FAILED(0047): ON CONFLICT DO NOTHING 이후
  // 재조회에서 행을 못 찾은 내부 이상 상황 — 노출할 구체적 메시지가 없어
  // 의도적으로 별도 분기 없이 기본 fallback(500)으로 떨어지게 둔다.

  return { status: 500, message: fallback };
}
