/** 일반 경기 승리 시 적용되는 리그 포인트. supabase/migrations/0045의 v_league_point_win과 동기화 필수(수동 관리). */
export const LEAGUE_POINT_WIN = 10;
/**
 * 2A-8D: 5:5 무승부 포인트. DB의 _match_apply_draw_effects
 * (v_league_point_draw)와 수동 동기화 필수 — LEAGUE_POINT_WIN과 같은 관례다.
 * 실제 포인트 반영은 DB RPC가 하고, 이 상수는 화면 표시용 계산에만 쓴다.
 */
export const LEAGUE_POINT_DRAW = 5;

export interface MatchRpcErrorInfo {
  status: number;
  message: string;
}

/**
 * create_match_with_effects/update_match_with_effects/delete_match_with_effects
 * (supabase/migrations/0045_create_atomic_match_functions.sql)가 던지는 예외
 * 접두사를 HTTP 응답으로 변환한다. route.ts가 이미 대부분(선수 존재/중복,
 * 세션 archived 등)을 사전에 걸러내므로, 대다수 접두사는 방어선 밖(레이스
 * 컨디션, RPC 내부 재검증)에서만 실제로 발생한다.
 */
export function mapMatchRpcError(errorMessage: string | undefined, fallback: string): MatchRpcErrorInfo {
  const msg = errorMessage ?? "";

  if (msg.startsWith("MATCH_NOT_FOUND")) {
    return { status: 404, message: "경기를 찾을 수 없습니다." };
  }
  if (msg.startsWith("SESSION_NOT_FOUND")) {
    return { status: 404, message: "세션을 찾을 수 없습니다." };
  }
  if (msg.startsWith("SESSION_ARCHIVED")) {
    return { status: 400, message: "보관된 세션에는 경기를 등록/수정할 수 없습니다." };
  }
  if (msg.startsWith("CLUB_NOT_FOUND") || msg.startsWith("CLUB_INACTIVE")) {
    return { status: 403, message: "클럽 컨텍스트가 올바르지 않습니다." };
  }
  if (msg.startsWith("INVALID_WINNER_TEAM") || msg.startsWith("INVALID_SCORE")) {
    return { status: 400, message: "점수와 승리팀 정보가 올바르지 않습니다." };
  }
  if (msg.startsWith("INVALID_TIEBREAK")) {
    return { status: 400, message: "7-6 스코어에는 타이브레이크 점수를 입력해주세요." };
  }
  if (msg.startsWith("INVALID_SLOT")) {
    return { status: 400, message: "선수 정보가 올바르지 않습니다." };
  }
  if (msg.startsWith("DUPLICATE_PARTICIPANT")) {
    return { status: 400, message: "4명의 선수가 모두 달라야 합니다." };
  }
  if (msg.startsWith("PARTICIPANT_CLUB_MISMATCH") || msg.startsWith("PARTICIPANT_NOT_FOUND")) {
    return { status: 500, message: "선수 정보를 확인하지 못했습니다." };
  }
  if (msg.startsWith("IDEMPOTENCY_CONFLICT")) {
    // 같은 requestId로 이미 다른 내용의 경기가 저장된 경우(0046) — RPC 원문은
    // 노출하지 않고 고정 메시지만 반환한다. 409는 프런트가 자동 재시도하면
    // 안 된다는 신호이므로, 클라이언트는 requestId를 폐기하고 사용자에게
    // 목록 확인을 안내해야 한다.
    return {
      status: 409,
      message: "같은 저장 요청이 다른 내용으로 이미 처리되었습니다. 목록을 확인한 뒤 다시 시도해주세요.",
    };
  }
  // IDEMPOTENCY_RESOLUTION_FAILED(0046): ON CONFLICT DO NOTHING 이후 재조회에서
  // 행을 못 찾은 내부 이상 상황 — 사용자에게 노출할 구체적 메시지가 없어
  // 의도적으로 별도 분기 없이 기본 fallback(500)으로 떨어지게 둔다.

  return { status: 500, message: fallback };
}
