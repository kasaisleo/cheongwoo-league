import type { TimelineSchema } from "./types";

/**
 * 운영(system): 직책 / 메모.
 * title은 직책 그대로 사용한다. 예: "총무" → title "총무"
 * role은 title 조립 재료일 뿐 DB 컬럼으로 저장되지 않는다.
 */
export const systemSchema: TimelineSchema = {
  type: "system",
  fields: ["role", "title", "memo"],
  titlePlaceholder: "예: 총무 (직책 입력 시 자동 채워짐)",
  buildTitle: (values) => {
    const role = values.role.trim();
    return role || null;
  },
};
