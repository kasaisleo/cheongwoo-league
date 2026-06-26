import type { TimelineSchema } from "./types";

/** 가입(join): 날짜 / 제목 / 메모. title은 자유 입력 — 자동생성하지 않는다. */
export const joinSchema: TimelineSchema = {
  type: "join",
  fields: ["eventDate", "title", "memo"],
  titlePlaceholder: "예: 청우회 가입",
  buildTitle: () => null,
};
