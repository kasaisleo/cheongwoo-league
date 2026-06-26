import type { TimelineSchema } from "./types";

/** 기타(custom): 제목 / 메모. title은 자유 입력 — 자동생성하지 않는다. */
export const customSchema: TimelineSchema = {
  type: "custom",
  fields: ["title", "memo"],
  titlePlaceholder: "예: 자유 입력",
  buildTitle: () => null,
};
