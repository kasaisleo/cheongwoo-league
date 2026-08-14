/**
 * 전적 요약(승·패·무·경기수·승률)의 단일 정의.
 *
 * 2A-8D-4에서 도입. Client Component와 서버가 함께 쓰므로 의존성을 두지 않는다
 * (import 0건 — Node 전용 모듈, Supabase client, next/headers 모두 없음).
 * match-engine.ts에는 서버 전용 RPC 오류 매핑이 함께 있어 client bundle로
 * 끌려가지 않도록 이 파일로 분리했다.
 *
 *   draws         = winner_team='D'인 참여 Match 수
 *   totalMatches  = wins + losses + draws
 *   winRate       = wins / totalMatches * 100  (totalMatches = 0 이면 0)
 *
 * DB 쪽 정의(supabase/migrations/0067 — member_stats 뷰,
 * get_public_member_list / get_public_member_detail / get_public_guest_list)와
 * 반드시 같은 식이어야 한다. 화면마다 다시 계산해 정의가 갈라지는 것을 막기
 * 위해 matches를 직접 집계하는 소비처는 전부 이 helper를 쓴다.
 */
export interface MatchRecordSummary {
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  /** 0~100. 소수점 처리는 화면의 기존 표시 스타일에 맡긴다(반올림하지 않는다). */
  winRate: number;
}

export function buildMatchRecord(wins: number, losses: number, draws: number): MatchRecordSummary {
  const totalMatches = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    totalMatches,
    winRate: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
  };
}

/**
 * 2A-8D-4 전이 호환: 0067 적용 전의 구 RPC 응답도 안전하게 정규화한다.
 *
 * Git push가 Vercel 배포를 자동 시작하므로 현실적인 순서는
 * "코드 배포 → 0067 적용"이다. 그 사이에는 RPC가 draws / total_matches를
 * 돌려주지 않는다. 구 응답에는 무승부 정보 자체가 없으므로 draws = 0으로 보고
 * 기존 win_rate를 그대로 쓰는 것이 전이 기간의 올바른 해석이다.
 *
 * 반환값은 전부 필수 number다 — undefined / null / NaN을 앱 내부로 흘리지 않는다.
 */
export interface RawStatRow {
  wins: number;
  losses: number;
  win_rate: number;
  /** 0067 적용 후에만 존재한다. */
  draws?: number | null;
  /** 0067 적용 후에만 존재한다. */
  total_matches?: number | null;
}

export function normalizeStatRow(row: RawStatRow): MatchRecordSummary {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const wins = num(row.wins, 0);
  const losses = num(row.losses, 0);
  const draws = num(row.draws, 0);
  // total_matches가 없거나 null이면 wins + losses + draws로 되살린다.
  const totalMatches = num(row.total_matches, wins + losses + draws);
  // 구 응답의 win_rate는 draws를 모르지만, 그 응답에는 draws도 없으므로
  // (draws = 0) 두 값이 서로 모순되지 않는다. 그대로 쓰는 것이 맞다.
  const winRate = num(row.win_rate, buildMatchRecord(wins, losses, draws).winRate);

  return { wins, losses, draws, totalMatches, winRate };
}
