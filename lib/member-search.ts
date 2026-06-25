import type { MemberWithStats } from "@/lib/supabase/database.types";

export type MapoScoreFilter = "all" | "le3" | "le4" | "le5" | "none";

export const MAPO_SCORE_FILTER_OPTIONS: { value: MapoScoreFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "le3", label: "3점 이하" },
  { value: "le4", label: "4점 이하" },
  { value: "le5", label: "5점 이하" },
  { value: "none", label: "점수 없음" },
];

/**
 * 검색어 하나로 회원의 여러 필드를 한 번에 매칭한다.
 * 현재 대상: 이름/닉네임/전화번호/주소/district/LP(league_point)/마포구점수.
 *
 * 향후 확장 예정(이번 작업 범위 아님): 선수 출신 정보, 대회 이력(연도/협회·대회구분/
 * 부서/결과/대회명/메모) 등을 검색하려면, 그 데이터를 별도로 조회해서 이 함수에
 * 추가 필드로 넘기거나, 매칭 대상 배열을 합치는 방식으로 확장할 수 있다.
 * 지금은 그 데이터 자체가 없으므로 구현하지 않는다.
 */
export function matchesMemberSearch(member: MemberWithStats, query: string): boolean {
  if (!query.trim()) return true;

  const normalized = query.trim().toLowerCase();

  const searchableFields = [
    member.name,
    member.nickname,
    member.phone,
    member.address_full,
    member.district,
    String(member.league_point),
    member.mapo_score !== null ? String(member.mapo_score) : null,
  ];

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

export type MemberSortOption = "league_point" | "name" | "mapo_score" | "win_rate" | "matches_played";

export const MEMBER_SORT_OPTIONS: { value: MemberSortOption; label: string }[] = [
  { value: "league_point", label: "LP순" },
  { value: "name", label: "이름순" },
  { value: "mapo_score", label: "마포구 점수순" },
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
