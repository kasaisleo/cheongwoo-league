/** 일반 경기 승리 시 적용되는 리그 포인트. supabase/migrations/0045의 v_league_point_win과 동기화 필수(수동 관리). */
export const LEAGUE_POINT_WIN = 10;

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

  return { status: 500, message: fallback };
}
