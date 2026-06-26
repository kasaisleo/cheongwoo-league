/**
 * timeline_type → TimelineSchema 레지스트리.
 *
 * 새 종류를 추가할 때 이 파일에서 건드릴 부분은 import 한 줄과
 * map에 한 줄 추가하는 것뿐이다. 그 외 UI 코드(EditTimelineModal 등)는
 * getTimelineSchema()만 호출하므로 수정할 필요가 없다.
 *
 * career/system은 신규 입력 타입에서는 제거됐지만(회원 속성과 중복이라
 * 회원등록/수정 폼으로 일원화), 기존 row가 깨지지 않도록 schema 파일
 * 자체(career.ts, system.ts)는 남겨두고 레지스트리 등록만 제외했다.
 * 필요해지면 다시 등록 한 줄만 추가하면 복원된다.
 */

import {
  isLegacyTimelineType,
  type AnyTimelineType,
  type LegacyTimelineType,
} from "@/lib/constants/member-timeline";
import type { TimelineSchema } from "./types";
import { joinSchema } from "./join";
import { competitionSchema } from "./competition";
import { leagueSchema } from "./league";
import { customSchema } from "./custom";
import { legacySchema } from "./legacy";

export type { TimelineSchema, TimelineFormValues, TimelineFieldKey } from "./types";
export { NO_ASSOCIATION } from "./shared";

const TIMELINE_SCHEMAS: Record<string, TimelineSchema> = {
  join: joinSchema,
  competition: competitionSchema,
  league: leagueSchema,
  custom: customSchema,
};

/**
 * timeline_type에 맞는 입력 폼 schema를 반환한다.
 * 신규 4종(join/competition/league/custom)은 정적으로 등록되어 있고,
 * legacy 값(career/system/achievement/attendance)이거나 알 수 없는 값이
 * 들어오면 보수적인 fallback schema를 즉석에서 만들어 반환한다
 * (목록이 더 늘어나도 깨지지 않도록 안전망 역할).
 */
export function getTimelineSchema(type: AnyTimelineType | string): TimelineSchema {
  const known = TIMELINE_SCHEMAS[type];
  if (known) return known;

  if (isLegacyTimelineType(type)) {
    return legacySchema(type);
  }

  // 알 수 없는 값(향후 또 다른 legacy 값이 생기는 경우 대비) — 가장 단순한
  // 폼을 보여준다. type은 실제 값을 그대로 유지해 라벨 표시가 깨지지 않게 한다.
  return { ...legacySchema("achievement" as LegacyTimelineType), type: type as AnyTimelineType };
}
