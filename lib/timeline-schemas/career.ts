import type { TimelineSchema } from "./types";
import { buildAssociationResultTitle } from "./shared";

/**
 * 선수출신(career): 협회 / 디비전 / 결과 / 메모.
 * title은 "협회 디비전 결과" 형태로 자동 생성된다.
 * 예: "KATA 오픈부 우승"
 */
export const careerSchema: TimelineSchema = {
  type: "career",
  fields: ["association", "division", "result", "title", "memo"],
  titlePlaceholder: "예: KATA 오픈부 우승 (협회/결과 선택 시 자동 채워짐)",
  buildTitle: (values) => buildAssociationResultTitle(values),
};
