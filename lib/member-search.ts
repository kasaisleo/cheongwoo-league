import type { MemberType, MemberWithStats } from "@/lib/supabase/database.types";

export type MapoScoreFilter = "all" | "le3" | "le4" | "le5" | "none";

export const MAPO_SCORE_FILTER_OPTIONS: { value: MapoScoreFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "le3", label: "3점 이하" },
  { value: "le4", label: "4점 이하" },
  { value: "le5", label: "5점 이하" },
  { value: "none", label: "점수 없음" },
];

/** 회원구분(member_type) 필터. "all"이면 정회원/준회원/게스트 구분 없이 전부 통과. */
export type MemberTypeFilter = "all" | MemberType;

export const MEMBER_TYPE_FILTER_OPTIONS: { value: MemberTypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "정회원", label: "정회원" },
  { value: "준회원", label: "준회원" },
  { value: "게스트", label: "게스트" },
];

/** 휴면 여부(is_dormant) 필터. is_active(삭제/숨김)와는 무관 — 휴면회원도 항상 목록에 노출되고, 이 필터로만 활동/휴면을 나눠 본다. */
export type MemberDormantFilter = "all" | "active" | "dormant";

export const MEMBER_DORMANT_FILTER_OPTIONS: { value: MemberDormantFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "활동" },
  { value: "dormant", label: "휴면" },
];

/**
 * 검색어 하나로 회원의 핵심 식별 정보를 매칭한다.
 * 대상: 이름/닉네임/전화번호 (주소/district/LP/마포점수는 검색 대상에서 제외).
 *
 * 향후 확장 예정(이번 작업 범위 아님): 선수 출신 정보, 대회 이력(연도/협회·대회구분/
 * 부서/결과/대회명/메모) 등을 검색하려면, 그 데이터를 별도로 조회해서 이 함수에
 * 추가 필드로 넘기거나, 매칭 대상 배열을 합치는 방식으로 확장할 수 있다.
 * 지금은 그 데이터 자체가 없으므로 구현하지 않는다.
 */
export function matchesMemberSearch(member: MemberWithStats, query: string): boolean {
  if (!query.trim()) return true;

  const normalized = query.trim().toLowerCase();

  const searchableFields = [member.name, member.nickname, member.phone];

  return searchableFields.some((field) => field?.toLowerCase().includes(normalized));
}

/** 마포구 점수 필터 조건에 맞는지 확인 */
export function matchesMapoScoreFilter(member: MemberWithStats, filter: MapoScoreFilter): boolean {
  if (filter === "all") return true;
  if (filter === "none") return member.mapo_score === null;
  if (member.mapo_score === null) return false;
  if (filter === "le3") return member.mapo_score <= 3;
  if (filter === "le4") return member.mapo_score <= 4;
  if (filter === "le5") return member.mapo_score <= 5;
  return true;
}

/** 회원구분(member_type) 필터 조건에 맞는지 확인 */
export function matchesMemberTypeFilter(member: MemberWithStats, filter: MemberTypeFilter): boolean {
  if (filter === "all") return true;
  return member.member_type === filter;
}

/**
 * 휴면 여부(is_dormant) 필터 조건에 맞는지 확인.
 * is_active(삭제/숨김)는 이 필터의 대상이 아니다 — 휴면회원은 정책상 항상
 * 목록에 노출되어야 하므로(Step 7-2/7-3), 이 필터는 그 노출된 목록 안에서
 * "활동 중인지/휴면인지"만 한 번 더 나눠 보는 용도다.
 */
export function matchesDormantFilter(member: MemberWithStats, filter: MemberDormantFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return !member.is_dormant;
  return member.is_dormant;
}

export type MemberSortOption = "league_point" | "name" | "mapo_score" | "win_rate" | "matches_played";

export const MEMBER_SORT_OPTIONS: { value: MemberSortOption; label: string }[] = [
  { value: "league_point", label: "LP순" },
  { value: "name", label: "이름순" },
  { value: "mapo_score", label: "지역점수순" },
  { value: "win_rate", label: "승률순" },
  { value: "matches_played", label: "경기수순" },
];

/**
 * 회원 목록 정렬. 기본은 LP 내림차순.
 * 마포구 점수가 없는(null) 회원은 항상 점수 있는 회원보다 뒤로 보낸다.
 * 향후 대회 운영 화면에서도 이 정렬 함수를 그대로 재사용할 수 있다.
 */
export function sortMembers(members: MemberWithStats[], sortBy: MemberSortOption): MemberWithStats[] {
  const sorted = [...members];

  switch (sortBy) {
    case "league_point":
      return sorted.sort((a, b) => b.league_point - a.league_point);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    case "mapo_score":
      return sorted.sort((a, b) => {
        if (a.mapo_score === null && b.mapo_score === null) return 0;
        if (a.mapo_score === null) return 1;
        if (b.mapo_score === null) return -1;
        return b.mapo_score - a.mapo_score;
      });
    case "win_rate":
      return sorted.sort((a, b) => b.win_rate - a.win_rate);
    case "matches_played":
      return sorted.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
    default:
      return sorted;
  }
}
