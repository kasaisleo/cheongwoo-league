import type { MemberTimeline } from "@/lib/supabase/database.types";

/**
 * 공개 Timeline 응답 계약 (Phase 2A-8E-1E).
 *
 * GET /api/members/timeline 은 서비스 롤로 조회하므로 RLS가 걸리지 않는다.
 * `select("*")` 를 쓰면 앞으로 member_timeline 에 내부용 컬럼이 추가될 때마다
 * 아무도 의도하지 않은 채 공개 API로 새어 나간다. 그래서 공개 필드를 여기서
 * 한 번만 선언하고, 조회 select 와 응답 타입이 같은 목록을 공유하게 한다.
 *
 * 포함 기준은 "공개 회원 상세가 실제로 소비하는 필드"다.
 *   렌더           timeline_type / event_year / event_month / title /
 *                  association / division / result / memo / is_highlight
 *   정렬 tiebreak  created_at        (MemberCareerProvider)
 *   편집 폼 채우기 competition_name / league_name / role
 *   식별           id
 *
 * 제외한 필드와 이유:
 *   member_id   client 가 쓰지 않는다. 이미 memberId 로 조회한 결과다.
 *   event_date  event_year/event_month 로부터 합성된 호환용 컬럼이고
 *               화면 표시에 쓰지 않는다(database.types.ts 주석 참조).
 *   description 소비처 0건.
 *   updated_at  소비처 0건.
 *
 * memo 는 공개 회원 상세에 의도적으로 렌더되므로 유지한다.
 */
export const PUBLIC_TIMELINE_FIELDS = [
  "id",
  "timeline_type",
  "event_year",
  "event_month",
  "title",
  "competition_name",
  "league_name",
  "role",
  "association",
  "division",
  "result",
  "memo",
  "is_highlight",
  "created_at",
] as const;

/** Supabase `.select()` 에 그대로 넘기는 컬럼 목록. */
export const PUBLIC_TIMELINE_SELECT = PUBLIC_TIMELINE_FIELDS.join(", ");

/** 공개 API가 반환하는 Timeline 항목. MemberTimeline 의 공개 부분집합이다. */
export type PublicMemberTimelineItem = Pick<
  MemberTimeline,
  (typeof PUBLIC_TIMELINE_FIELDS)[number]
>;

/**
 * 관리자 mutation 응답(row 전체)을 공개 항목으로 좁힌다.
 *
 * POST/PUT 은 운영진 전용 경로라 전체 row 를 돌려주지만, 그 값이 그대로
 * 공개 화면의 state 로 들어가면 공개 타입과 실제 담긴 값이 어긋난다.
 * 여기서 한 번 좁혀 두면 GET 으로 받은 항목과 저장 직후 반영된 항목이
 * 같은 모양을 갖는다.
 */
export function toPublicTimelineItem(
  row: Partial<MemberTimeline> & { id: string }
): PublicMemberTimelineItem {
  return {
    id: row.id,
    timeline_type: row.timeline_type ?? "",
    event_year: row.event_year ?? null,
    event_month: row.event_month ?? null,
    title: row.title ?? "",
    competition_name: row.competition_name ?? null,
    league_name: row.league_name ?? null,
    role: row.role ?? null,
    association: row.association ?? null,
    division: row.division ?? null,
    result: row.result ?? null,
    memo: row.memo ?? null,
    is_highlight: row.is_highlight ?? false,
    created_at: row.created_at ?? "",
  };
}
