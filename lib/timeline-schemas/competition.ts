import type { TimelineSchema } from "./types";
import { buildAssociationResultTitle } from "./shared";

/**
 * 대회(competition): 연/월 / 대회명 / 협회 / 디비전 / 결과 / 메모.
 * title은 "연도 대회명 협회 디비전 결과" 형태로 자동 생성된다.
 * 예: eventYear=2025, competitionName="강서오픈", association="KATA",
 *     division="오픈부", result="우승" → "2025 강서오픈 KATA 오픈부 우승"
 *
 * 이전에는 대회명에 연도까지 직접 타이핑해야 했지만("2025 강서오픈"), 이제는
 * eventYear(날짜 입력)에서 연도를 가져와 자동으로 앞에 붙인다 — 대회명에는
 * "강서오픈"처럼 연도 없이 입력하면 된다.
 *
 * competitionName은 title 자동조립의 source of truth로 DB(competition_name
 * 컬럼)에 저장된다 — title은 이 값에서 파생되는 결과물이고, edit 진입 시에는
 * title을 파싱하지 않고 이 컬럼에서 그대로 복원한다.
 */
export const competitionSchema: TimelineSchema = {
  type: "competition",
  fields: ["eventYear", "eventMonth", "competitionName", "association", "division", "result", "title", "memo"],
  titlePlaceholder: "예: 2025 강서오픈 KATA 오픈부 우승 (위 항목 입력 시 자동 채워짐)",
  supportsAutoTitle: true,
  buildTitle: (values) => {
    // 대회명에 연도를 자동으로 붙인다. eventYear가 없으면 대회명만 그대로 둔다
    // (연도를 모르더라도 대회명+결과만으로는 여전히 자동생성이 가능해야 한다).
    const competitionName = values.competitionName.trim();
    const prefix = [values.eventYear || null, competitionName || null].filter(Boolean).join(" ");
    // 대회명이 없으면 career와 동일하게(협회 디비전 결과) 합성하고,
    // 대회명이 있으면 그 앞에 붙인다.
    return buildAssociationResultTitle(values, { prefix: prefix || undefined });
  },
};
