import type { TimelineSchema } from "./types";
import { buildAssociationResultTitle } from "./shared";

/**
 * ⚠️ 현재 미사용 (index.ts의 TIMELINE_SCHEMAS에서 제외됨, 2024-XX).
 *
 * 선수출신(career)은 신규 Timeline 입력 타입에서 제거되었다. 선수출신
 * 정보는 회원등록/회원수정 폼(members.player_background)에 회원 속성으로
 * 이미 존재하고, LP 계산과도 연결되어 있어 Timeline(회원의 사건/이력 기록)
 * 에 같은 개념을 또 두면 두 곳의 값이 어긋날 수 있다.
 *
 * 기존에 career로 저장된 row는 lib/timeline-schemas/legacy.ts의 fallback
 * schema로 처리된다. 이 파일은 향후 career를 다시 활성화하게 될 경우를
 * 위해 남겨두었다 — index.ts에 등록 한 줄만 추가하면 복원된다.
 */

/**
 * 선수출신(career): 연/월 / 협회 / 디비전 / 결과 / 메모.
 * title은 "협회 디비전 결과" 형태로 자동 생성된다.
 * 예: "KATA 오픈부 우승"
 */
export const careerSchema: TimelineSchema = {
  type: "career",
  fields: ["eventYear", "eventMonth", "association", "division", "result", "title", "memo"],
  titlePlaceholder: "예: KATA 오픈부 우승 (협회/결과 선택 시 자동 채워짐)",
  supportsAutoTitle: true,
  buildTitle: (values) => buildAssociationResultTitle(values),
};
