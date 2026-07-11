"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

/**
 * MemberList v3 — Step 18 Rankingification.
 *
 * Ranking 페이지 문법을 Members에 번역:
 *   - 필터 기본 접힘 (Ranking에 필터 없음 → 콘텐츠 우선)
 *   - grid-cols-[2.5rem_1fr_auto] (Ranking Table과 동일)
 *   - 순위 색상 계층: #1=gold, #2/#3=clay-400, #4~=line-500
 *   - 필터 chip rounded-sm (rounded-full 제거)
 *   - 잔존 코드 정리 (statCardClassName, isXxxCardActive)
 *
 * 유지:
 *   - Champion/Contender Block 없음 — Members는 전체 Roster 탐색 목적
 *   - 검색/필터 기능 로직 변경 없음
 *   - DB/API 변경 없음
 */

interface MemberListProps {
  members: MemberWithStats[];
  /** 클럽 slug. 있으면 /c/[slug]/members/[id] 링크, 없으면 /members/[id] (legacy). */
  slug?: string;
}

/** 순위 번호에 Ranking 색상 계층 적용 */
function rankColor(rank: number): string {
  if (rank === 1) return "text-gold font-bold";
  if (rank <= 3)  return "text-clay-400 font-bold";
  return "text-line-500";
}

export function MemberList({ members, slug }: MemberListProps) {
  const [query, setQuery] = useState("");
  const [mapoFilter, setMapoFilter] = useState<MapoScoreFilter>("all");
  const [memberTypeFilter, setMemberTypeFilter] = useState<MemberTypeFilter>("all");
  const [dormantFilter, setDormantFilter] = useState<MemberDormantFilter>("all");
  const [sortBy, setSortBy] = useState<MemberSortOption>("league_point");
  // 기본 접힘 — Members 첫 화면은 선수 리스트가 먼저 보여야 함
  const [showFilters, setShowFilters] = useState(false);

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

  // 공통 chip 스타일 (active/inactive)
  function chipClass(active: boolean): string {
    return `rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
      active
        ? "border-clay-400 bg-clay-400 text-line-25"
        : "border-line-200/40 bg-line-50 text-line-500 hover:border-line-300"
    }`;
  }

  return (
    <>
      {/* ── 검색창 + 필터 토글 — 한 줄 ──────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색"
          className="box-border block h-9 min-w-0 flex-1 rounded-sm border border-line-200/40 bg-line-50 px-3 text-sm text-line-900 placeholder:text-line-500"
        />
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex shrink-0 items-center gap-1 rounded-sm border border-line-200/40 bg-line-50 px-3 py-2 text-xs font-bold text-line-500 transition-colors hover:border-line-300 hover:text-line-700"
        >
          <span className="font-display uppercase tracking-wider">Filter</span>
          <span aria-hidden className="text-[10px]">{showFilters ? "↑" : "↓"}</span>
        </button>
      </div>

      {/* ── 필터 영역 — 기본 접힘 ────────────────────────── */}
      {showFilters && (
        <div className="mb-3 space-y-2.5 rounded-[14px] border border-line-200/40 bg-line-50 p-3">
          {/* 정렬 */}
          <div className="flex items-center justify-between">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MemberSortOption)}
              className="h-8 rounded-sm border border-line-200/40 bg-line-100 px-2 text-xs font-semibold text-line-800"
            >
              {MEMBER_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 지역점수 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {MAPO_SCORE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMapoFilter(option.value)}
                className={chipClass(mapoFilter === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 회원 유형 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {MEMBER_TYPE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMemberTypeFilter(option.value)}
                className={chipClass(memberTypeFilter === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 활동/휴면 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {MEMBER_DORMANT_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDormantFilter(option.value)}
                className={chipClass(dormantFilter === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Ranking Table ─────────────────────────────────── */}
      {filteredMembers.length === 0 ? (
        <EmptyState message={members.length === 0 ? "등록된 선수가 없어요." : "검색 결과가 없습니다."} />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

          {/* 테이블 헤더 — Ranking 페이지와 동일 */}
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-line-200/40 bg-line-100/40 px-4 py-2">
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
            const rank = idx + 1;
            const isLast = idx === filteredMembers.length - 1;

            return (
              <Link key={member.id} href={slug ? `/c/${slug}/members/${member.id}` : `/members/${member.id}`}>
                <div
                  className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-line-100/40 ${
                    isLast ? "" : "border-b border-line-200/30"
                  }`}
                >
                  {/* 순위 — #1=gold, #2/#3=clay, #4~=line-500 */}
                  <span
                    className={`font-display text-sm tabular-nums text-center ${rankColor(rank)}`}
                  >
                    {rank}
                  </span>

                  {/* 이름 + 전적 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="name-kr-sm truncate text-line-900">
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
                          활동 제외
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px]">
                      <span className="text-gold">{member.wins}W</span>
                      <span className="mx-0.5 text-line-400">·</span>
                      <span className="text-line-500">{member.losses}L</span>
                      {member.mapo_score !== null && (
                        <span className="ml-1.5 text-line-500">지역 {member.mapo_score}점</span>
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
