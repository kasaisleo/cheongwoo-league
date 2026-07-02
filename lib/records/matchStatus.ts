export type MatchStatus = "정상" | "확인 필요" | "기록 부족" | "완료 전";

export interface MatchStatusInput {
  isCompleted: boolean;
  gameCount: number;
  attendingCount: number;
  gameParticipantCount: number;
  noShowCount: number;
}

export function judgeMatchStatus(s: MatchStatusInput): MatchStatus {
  if (!s.isCompleted) return "완료 전";
  if (s.gameCount === 0) return "기록 부족";
  if (s.noShowCount > 0) return "확인 필요";
  if (s.attendingCount > 0 && s.gameParticipantCount === 0) return "확인 필요";
  return "정상";
}
