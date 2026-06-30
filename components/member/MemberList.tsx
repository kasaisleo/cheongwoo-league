"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/SectionHeader";
import { CallButton } from "@/components/member/CallButton";
import {
  MAPO_SCORE_FILTER_OPTIONS,
  MEMBER_SORT_OPTIONS,
  MEMBER_TYPE_FILTER_OPTIONS,
  MEMBER_DORMANT_FILTER_OPTIONS,
  matchesMapoScoreFilter,
  matchesMemberSearch,
  matchesMemberTypeFilter,
  matchesDormantFilter,
  sortMembers,
  type MapoScoreFilter,
  type MemberSortOption,
  type MemberTypeFilter,
  type MemberDormantFilter,
} from "@/lib/member-search";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface MemberListProps {
  members: MemberWithStats[];
}

export function MemberList({ members }: MemberListProps) {
  const [query, setQuery] = useState("");
  const [mapoFilter, setMapoFilter] = useState<MapoScoreFilter>("all");
  const [memberTypeFilter, setMemberTypeFilter] = useState<MemberTypeFilter>("all");
  const [dormantFilter, setDormantFilter] = useState<MemberDormantFilter>("all");
  const [sortBy, setSortBy] = useState<MemberSortOption>("league_point");
  // 필터 영역(정렬/마포점수/회원구분/활동·휴면) 접기/펼치기. 검색창과 통계
  // 카드는 이 상태와 무관하게 항상 노출된다 — 기본값은 펼침이다.
  const [showFilters, setShowFilters] = useState(true);

  // 상단 통계는 검색/필터 적용 전 전체 members 기준으로 고정한다 — 필터를
  // 바꿔도 숫자가 따라 바뀌지 않아야 "전체 중 몇 명이 정회원/휴면인지"를
  // 일관되게 볼 수 있다. filteredMembers와는 별개의 계산이다.
  const stats = useMemo(
    () => ({
      total: members.length,
      regular: members.filter((m) => m.member_type === "정회원").length,
      associate: members.filter((m) => m.member_type === "준회원").length,
      guest: members.filter((m) => m.member_type === "게스트").length,
      dormant: members.filter((m) => m.is_dormant).length,
    }),
    [members]
  );

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(
      (member) =>
        matchesMemberSearch(member, query) &&
        matchesMapoScoreFilter(member, mapoFilter) &&
        matchesMemberTypeFilter(member, memberTypeFilter) &&
        matchesDormantFilter(member, dormantFilter)
    );
    return sortMembers(filtered, sortBy);
  }, [members, query, mapoFilter, memberTypeFilter, dormantFilter, sortBy]);

  // 통계 카드의 "선택됨" 표시는 그 카드가 의미하는 조건과 현재 필터 state가
  // 정확히 일치할 때만 켜진다. "전체" 카드는 검색어/마포점수까지 포함해
  // 모든 필터가 기본값일 때만 active다 — 그래야 "전체를 눌렀다"는 게 곧
  // "아무 필터도 안 걸려 있다"는 뜻과 정확히 같아진다.
  const isAllCardActive =
    query.trim() === "" && mapoFilter === "all" && memberTypeFilter === "all" && dormantFilter === "all";
  const isRegularCardActive = memberTypeFilter === "정회원";
  const isAssociateCardActive = memberTypeFilter === "준회원";
  const isGuestCardActive = memberTypeFilter === "게스트";
  const isDormantCardActive = dormantFilter === "dormant";

  function statCardClassName(active: boolean): string {
    return `rounded-xl border p-2 text-center transition-colors ${
      active ? "border-clay-400 bg-clay-400/10" : "border-line-200 bg-line-100 hover:border-clay-400"
    }`;
  }

  return (
    <>
      {/* 검색/필터와 무관하게 항상 전체 members 기준 숫자만 보여준다(stats 참고).
          각 카드는 버튼이다 — 클릭하면 그 구분에 맞는 필터로 실제 바뀌고,
          현재 필터 상태와 정확히 일치하는 카드만 선택됨으로 표시된다. */}
      <div className="mb-4 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setMapoFilter("all");
            setMemberTypeFilter("all");
            setDormantFilter("all");
          }}
          className={statCardClassName(isAllCardActive)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">전체</p>
          <p className="font-score text-lg font-bold text-line-900">{stats.total}</p>
        </button>
        <button
          type="button"
          onClick={() => setMemberTypeFilter("정회원")}
          className={statCardClassName(isRegularCardActive)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">정회원</p>
          <p className="font-score text-lg font-bold text-line-900">{stats.regular}</p>
        </button>
        <button
          type="button"
          onClick={() => setMemberTypeFilter("준회원")}
          className={statCardClassName(isAssociateCardActive)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">준회원</p>
          <p className="font-score text-lg font-bold text-line-900">{stats.associate}</p>
        </button>
        <button
          type="button"
          onClick={() => setMemberTypeFilter("게스트")}
          className={statCardClassName(isGuestCardActive)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">게스트</p>
          <p className="font-score text-lg font-bold text-line-900">{stats.guest}</p>
        </button>
        <button
          type="button"
          onClick={() => setDormantFilter("dormant")}
          className={statCardClassName(isDormantCardActive)}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-line-500">휴면</p>
          <p className="font-score text-lg font-bold text-line-600">{stats.dormant}</p>
        </button>
      </div>

      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 닉네임, 전화번호로 검색"
          className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((prev) => !prev)}
        className="mb-2 flex w-full items-center justify-between rounded-lg border border-line-200 bg-line-100 px-3 py-2 text-xs font-semibold text-line-700"
      >
        {showFilters ? "필터 숨기기" : "필터 보기"}
        <span aria-hidden>{showFilters ? "▲" : "▼"}</span>
      </button>

      {showFilters && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-line-500">정렬</p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MemberSortOption)}
              className="h-9 rounded-lg border border-line-200 bg-line-100 px-2 text-xs font-semibold text-line-800"
            >
              {MEMBER_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {MAPO_SCORE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMapoFilter(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mapoFilter === option.value
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 bg-line-50 text-line-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {MEMBER_TYPE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMemberTypeFilter(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  memberTypeFilter === option.value
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 bg-line-50 text-line-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {MEMBER_DORMANT_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDormantFilter(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  dormantFilter === option.value
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200 bg-line-50 text-line-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      {filteredMembers.length === 0 ? (
        <EmptyState message={members.length === 0 ? "등록된 회원이 없어요." : "검색 결과가 없습니다."} />
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`}>
              <Card className="flex items-center justify-between p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-line-900">
                    {member.name}
                    {member.nickname && member.nickname !== member.name && (
                      <span className="ml-1 text-xs font-normal text-line-400">{member.nickname}</span>
                    )}
                    {member.role !== null && (
                      <span className="rounded-full bg-line-200 px-1.5 py-0.5 text-[10px] font-semibold text-line-700">
                        {member.role}
                      </span>
                    )}
                    {member.is_dormant && (
                      <span className="rounded-full bg-line-200 px-1.5 py-0.5 text-[10px] font-semibold text-line-600">
                        휴면
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    <span className="text-clay-400">LP {member.league_point}</span>
                    {member.mapo_score !== null && (
                      <span className="text-line-600"> · 마포 {member.mapo_score}점</span>
                    )}
                    <span className="text-line-500">
                      {" "}
                      · {member.wins}승 {member.losses}패
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.phone && <CallButton phone={member.phone} />}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
