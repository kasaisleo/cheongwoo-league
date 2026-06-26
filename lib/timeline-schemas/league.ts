import type { TimelineSchema } from "./types";

/**
 * 리그(league): 리그명 / 결과 / 메모. (날짜는 모든 종류 공통으로 eventYear/
 * eventMonth를 입력받으므로 별도 "시즌" 필드를 따로 두지 않는다 — 리그의
 * "시즌"은 곧 eventYear와 같은 정보라 중복 입력을 피한다.)
 * title은 "연도 리그명 결과" 형태로 자동 생성된다.
 * 예: eventYear=2025, leagueName="청우회 리그", result="준우승"
 *     → "2025 청우회 리그 준우승"
 *
 * leagueName은 title 조립 재료일 뿐 DB 컬럼으로 저장되지 않는다.
 * result는 기존 RESULT_OPTIONS를 그대로 쓰고 DB result 컬럼에 저장된다.
 */
export const leagueSchema: TimelineSchema = {
  type: "league",
  fields: ["eventYear", "eventMonth", "leagueName", "result", "title", "memo"],
  titlePlaceholder: "예: 2025 청우회 리그 준우승 (연도/리그명/결과 입력 시 자동 채워짐)",
  buildTitle: (values) => {
    const parts = [values.eventYear || null, values.leagueName.trim(), values.result || null].filter(
      (part): part is string => Boolean(part && part.trim())
    );
    if (parts.length === 0) return null;
    return parts.join(" ");
  },
};
