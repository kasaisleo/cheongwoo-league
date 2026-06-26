import type { TimelineSchema } from "./types";

/**
 * 리그(league): 리그명 / 시즌(연도) / 결과 / 메모.
 * title은 "시즌년도 리그명 결과" 형태로 자동 생성된다.
 * 예: "2025 청우회 리그 준우승"
 *
 * leagueName, seasonYear는 title 조립 재료일 뿐 DB 컬럼으로 저장되지 않는다.
 * result는 기존 RESULT_OPTIONS를 그대로 쓰고 DB result 컬럼에 저장된다.
 */
export const leagueSchema: TimelineSchema = {
  type: "league",
  fields: ["leagueName", "seasonYear", "result", "title", "memo"],
  titlePlaceholder: "예: 2025 청우회 리그 준우승 (위 항목 입력 시 자동 채워짐)",
  buildTitle: (values) => {
    const parts = [values.seasonYear, values.leagueName.trim(), values.result || null].filter(
      (part): part is string => Boolean(part && part.trim())
    );
    if (parts.length === 0) return null;
    return parts.join(" ");
  },
};
