/**
 * Timeline 입력 폼 스키마 공통 타입.
 *
 * timeline_type마다 필요한 입력 필드가 다르다(가입은 제목만, 대회는
 * 협회/디비전/결과까지). 이를 switch문으로 분기하면 종류가 늘어날 때마다
 * 분기가 계속 커지므로, 대신 "종류 하나 = 설정(config) 하나"로 관리한다.
 *
 * 새 timeline_type을 추가하려면:
 *   1. lib/constants/member-timeline.ts에 TIMELINE_TYPE_OPTIONS 추가
 *   2. lib/timeline-schemas/<type>.ts 파일 하나 추가
 *   3. lib/timeline-schemas/index.ts의 TIMELINE_SCHEMAS map에 등록
 * 이외의 코드(EditTimelineModal 등)는 수정할 필요가 없는 것이 목표다.
 */

import type { AnyTimelineType } from "@/lib/constants/member-timeline";

/**
 * 폼에서 다루는 입력값 전체. 전부 DB 컬럼에 그대로 저장된다(association,
 * division, result, memo, title, eventYear, eventMonth, competitionName,
 * leagueName, role). competitionName/leagueName/role은 title 자동조립의
 * source of truth로, edit 진입 시 title을 파싱하지 않고 이 컬럼들에서
 * 그대로 복원한다 — title은 이 값들로부터 파생되는 결과물이다.
 */
export interface TimelineFormValues {
  /** 연도. 정책상 필수 — 빈 문자열은 "아직 선택 안 함"을 의미한다. */
  eventYear: string;
  /** 월(1~12). 선택값 — 빈 문자열은 "모름"을 의미한다. */
  eventMonth: string;
  title: string;
  /** 대회명 (competition). title 조립 재료, DB에는 저장하지 않음. */
  competitionName: string;
  association: string; // NO_ASSOCIATION 센티널 포함
  division: string;
  result: string;
  /** 리그명 (league). title 조립 재료, DB에는 저장하지 않음. */
  leagueName: string;
  /** 직책 (system). title 조립 재료, DB에는 저장하지 않음. */
  role: string;
  memo: string;
  isHighlight: boolean;
}

/** 폼에 렌더링할 수 있는 필드 종류. */
export type TimelineFieldKey =
  | "eventYear"
  | "eventMonth"
  | "title"
  | "competitionName"
  | "association"
  | "division"
  | "result"
  | "leagueName"
  | "role"
  | "memo";

/**
 * timeline_type 하나에 대한 전체 설정.
 * - fields: 이 종류를 선택했을 때 보여줄 필드와 순서
 * - buildTitle: 자동생성 가능하면 문자열을 반환, 재료가 부족하면 null
 *     (null이면 모달이 title을 비워두지 않고 기존/직접입력 값을 유지한다)
 */
export interface TimelineSchema {
  type: AnyTimelineType;
  /** 이 종류를 선택했을 때 노출할 필드 목록 (순서대로 렌더링됨). */
  fields: TimelineFieldKey[];
  /** title 입력칸의 placeholder. */
  titlePlaceholder: string;
  /**
   * 현재 폼 값으로 title을 자동 조립한다. 재료가 충분하지 않으면 null을
   * 반환하며, 이 경우 모달은 사용자가 입력한 title을 그대로 둔다.
   */
  buildTitle: (values: TimelineFormValues) => string | null;
  /**
   * 이 종류가 title 자동생성을 "지원"하는지 나타내는 정적 플래그
   * (competition/league는 true, join/custom/legacy는 false).
   *
   * "현재 값으로 buildTitle을 호출했더니 null이 나왔다"처럼 런타임에 추측하지
   * 않고 schema 정의 자체에 명시한다 — 추측 기반 판단은 "이 title이 한때는
   * 자동생성이었는지"를 알아낼 수 없다는 근본적 한계가 있다(필드가 바뀌면
   * 과거 title과 안 맞는 게 당연하므로, 그걸로 auto/manual을 가르면 오판한다).
   * true인 종류는 title 입력칸을 기본적으로 읽기 전용으로 보여주고, 사용자가
   * "직접 수정" 버튼을 눌러야만 manual로 전환되어 입력 가능해진다.
   */
  supportsAutoTitle: boolean;
}
