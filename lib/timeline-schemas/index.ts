/**
 * timeline_type → TimelineSchema 레지스트리.
 *
 * 새 종류를 추가할 때 이 파일에서 건드릴 부분은 import 한 줄과
 * map에 한 줄 추가하는 것뿐이다. 그 외 UI 코드(EditTimelineModal 등)는
 * getTimelineSchema()만 호출하므로 수정할 필요가 없다.
 */

import type { AnyTimelineType } from "@/lib/constants/member-timeline";
import type { TimelineSchema } from "./types";
import { joinSchema } from "./join";
import { careerSchema } from "./career";
import { competitionSchema } from "./competition";
import { leagueSchema } from "./league";
import { systemSchema } from "./system";
import { customSchema } from "./custom";
import { legacySchema } from "./legacy";

export type { TimelineSchema, TimelineFormValues, TimelineFieldKey } from "./types";
export { NO_ASSOCIATION } from "./shared";

const TIMELINE_SCHEMAS: Record<string, TimelineSchema> = {
  join: joinSchema,
  career: careerSchema,
  competition: competitionSchema,
  league: leagueSchema,
  system: systemSchema,
  custom: customSchema,
};

/**
 * timeline_type에 맞는 입력 폼 schema를 반환한다.
 * 신규 6종은 정적으로 등록되어 있고, legacy 값(achievement/attendance)이거나
 * 알 수 없는 값이 들어오면 보수적인 fallback schema를 즉석에서 만들어 반환한다
 * (목록이 더 늘어나도 깨지지 않도록 안전망 역할).
 */
export function getTimelineSchema(type: AnyTimelineType | string): TimelineSchema {
  const known = TIMELINE_SCHEMAS[type];
  if (known) return known;

  if (type === "achievement" || type === "attendance") {
    return legacySchema(type);
  }

  // 알 수 없는 값(향후 또 다른 legacy 값이 생기는 경우 대비) — custom과
  // 동일하게 가장 단순한 폼을 보여준다. type은 실제 값을 그대로 유지해
  // 라벨 표시(timelineTypeLabel)가 깨지지 않게 한다.
  return { ...legacySchema("achievement"), type: type as AnyTimelineType };
}
