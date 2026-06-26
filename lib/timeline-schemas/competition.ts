import type { TimelineSchema } from "./types";
import { buildAssociationResultTitle } from "./shared";

/**
 * 대회(competition): 대회명 / 협회 / 디비전 / 결과 / 메모.
 * title은 "대회명 협회 디비전 결과" 형태로 자동 생성된다.
 * 예: "2025 강서오픈 KATA 오픈부 우승"
 *
 * competitionName은 title 조립 재료일 뿐 DB 컬럼으로 저장되지 않는다.
 */
export const competitionSchema: TimelineSchema = {
  type: "competition",
  fields: ["competitionName", "association", "division", "result", "title", "memo"],
  titlePlaceholder: "예: 2025 강서오픈 KATA 오픈부 우승 (위 항목 입력 시 자동 채워짐)",
  buildTitle: (values) => {
    // 대회명이 없으면 career와 동일하게(협회 디비전 결과) 합성하고,
    // 대회명이 있으면 그 앞에 붙인다.
    return buildAssociationResultTitle(values, { prefix: values.competitionName.trim() || undefined });
  },
};
