import type { TimelineFormValues } from "./types";

export const NO_ASSOCIATION = "__none__";

/**
 * association/division/result를 공백으로 이어 title을 만든다.
 * career, competition이 공유하는 합성 규칙.
 *
 * 예: "KATA" + "오픈부" + "우승" → "KATA 오픈부 우승"
 *     "KATA" + "" + "우승"     → "KATA 우승" (division 비어있으면 생략)
 *
 * association 자체가 선택되지 않았으면(NO_ASSOCIATION) 재료가 없다고
 * 보고 null을 반환한다 — 이 경우 자동생성을 시도하지 않는다.
 */
export function buildAssociationResultTitle(
  values: TimelineFormValues,
  options?: { prefix?: string }
): string | null {
  const hasAssociation = values.association !== NO_ASSOCIATION && Boolean(values.association);

  if (!hasAssociation) {
    // 협회를 아직 선택하지 않았어도, 대회명(prefix)만으로는 자동생성할 수 있다.
    const prefixOnly = options?.prefix?.trim();
    return prefixOnly || null;
  }

  const parts = [options?.prefix, values.association, values.division || null, values.result || null].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  if (parts.length === 0) return null;
  return parts.join(" ");
}
