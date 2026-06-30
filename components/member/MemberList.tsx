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
      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 닉네임, 전화번호로 검색"
          className="box-border block h-11 w-full min-w-0 max-w-full rounded-[14px] border border-line-200/50 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((prev) => !prev)}
        className="mb-2 flex w-full items-center justify-between rounded-[14px] border border-line-200/40 bg-line-50 px-3 py-2 text-xs font-semibold text-line-600"
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
              className="h-9 rounded-sm border border-line-200/60 bg-line-100 px-2 text-xs font-semibold text-line-800"
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
        /* Ranking Table 문법: rounded-[14px], bg-line-50, border-line-200/40, 행 구분선 */
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {/* Ranking Table 헤더: # / Player / LP */}
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-line-200/40 bg-line-100/40 px-4 py-2">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500 text-center">
              #
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Player
            </span>
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500 text-right">
              LP
            </span>
          </div>

          {filteredMembers.map((member, idx) => {
            const isLast = idx === filteredMembers.length - 1;
            return (
              <Link key={member.id} href={`/members/${member.id}`}>
                <div className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${
                  isLast ? "" : "border-b border-line-200/30"
                }`}>
                  {/* 순위 번호 — Ranking Table 문법 */}
                  <span className="font-display text-sm font-bold tabular-nums text-line-500 text-center">
                    {idx + 1}
                  </span>

                  {/* 이름 + 전적 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-line-900">
                        {member.name}
                      </p>
                      {member.nickname && member.nickname !== member.name && (
                        <span className="shrink-0 text-xs text-line-500">{member.nickname}</span>
                      )}
                      {member.role !== null && (
                        <span className="shrink-0 rounded-sm bg-line-200 px-1.5 py-0.5 text-[9px] font-semibold text-line-600">
                          {member.role}
                        </span>
                      )}
                      {member.is_dormant && (
                        <span className="shrink-0 rounded-sm bg-line-200 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
                          휴면
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px]">
                      <span className="text-gold">{member.wins}W</span>
                      <span className="mx-0.5 text-line-400">·</span>
                      <span className="text-line-500">{member.losses}L</span>
                      {member.mapo_score !== null && (
                        <span className="ml-1.5 text-line-500">마포 {member.mapo_score}점</span>
                      )}
                    </p>
                  </div>

                  {/* LP + 전화 */}
                  <div className="flex shrink-0 items-center gap-2">
                    {member.phone && <CallButton phone={member.phone} />}
                    <div className="text-right">
                      <span className="font-score text-sm font-bold tabular-nums text-line-800">
                        {member.league_point}
                      </span>
                      <span className="ml-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-line-500">
                        LP
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
