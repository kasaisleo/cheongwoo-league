import type { LegacyTimelineType } from "@/lib/constants/member-timeline";
import type { TimelineSchema } from "./types";

/**
 * career/system/achievement/attendance처럼 더 이상 신규 선택지에는 없지만
 * 기존 row에는 남아있는 legacy 값을 위한 fallback. 어떤 형태로 입력됐었는지
 * 종류별로 정확히 알 수 없으므로 가장 보수적으로 기존 전체 필드
 * (association/division/result 포함)를 그대로 노출하고, title 자동생성은
 * 하지 않는다 — 사용자가 직접 새 종류를 선택하면 그 즉시 해당 schema로
 * 교체된다.
 */
export function legacySchema(type: LegacyTimelineType): TimelineSchema {
  return {
    type,
    fields: ["association", "division", "result", "title", "memo"],
    titlePlaceholder: "예: 2025 강서오픈, 청우회 가입",
    buildTitle: () => null,
  };
}
