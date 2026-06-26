import type { TimelineSchema } from "./types";

/**
 * ⚠️ 현재 미사용 (index.ts의 TIMELINE_SCHEMAS에서 제외됨, 2024-XX).
 *
 * 운영(system)은 신규 Timeline 입력 타입에서 제거되었다(검토 단계).
 * 직책(회장/총무/경기이사 등) 정보는 회원등록/회원수정 폼에 회원 속성으로
 * 이미 존재해서, Timeline에 또 입력받으면 중복될 수 있다는 판단이다.
 *
 * 기존에 system으로 저장된 row는 lib/timeline-schemas/legacy.ts의 fallback
 * schema로 처리된다. 이 파일은 향후 system을 다시 활성화하게 될 경우를
 * 위해 남겨두었다 — index.ts에 등록 한 줄만 추가하면 복원된다.
 */

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
