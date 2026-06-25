"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CallButton } from "@/components/member/CallButton";
import {
  MAPO_SCORE_FILTER_OPTIONS,
  MEMBER_SORT_OPTIONS,
  matchesMapoScoreFilter,
  matchesMemberSearch,
  sortMembers,
  type MapoScoreFilter,
  type MemberSortOption,
} from "@/lib/member-search";
import type { MemberWithStats } from "@/lib/supabase/database.types";

interface MemberListProps {
  members: MemberWithStats[];
  isAdmin: boolean;
}

export function MemberList({ members, isAdmin }: MemberListProps) {
  const [query, setQuery] = useState("");
  const [mapoFilter, setMapoFilter] = useState<MapoScoreFilter>("all");
  const [sortBy, setSortBy] = useState<MemberSortOption>("league_point");

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(
      (member) => matchesMemberSearch(member, query) && matchesMapoScoreFilter(member, mapoFilter)
    );
    return sortMembers(filtered, sortBy);
  }, [members, query, mapoFilter, sortBy]);

  return (
    <>
      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 닉네임, 전화번호, 주소, LP, 마포구 점수로 검색"
          className="box-border block h-11 w-full min-w-0 max-w-full rounded-lg border border-line-200 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>

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

      <div className="mb-4 flex flex-wrap gap-1.5">
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

      {filteredMembers.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          {members.length === 0 ? "등록된 회원이 없어요. 첫 회원을 등록해보세요." : "검색 결과가 없습니다"}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`}>
              <Card className="flex items-center justify-between p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-line-900">
                    {member.nickname}
                    {member.role !== "정회원" && (
                      <span className="rounded-full bg-line-200 px-1.5 py-0.5 text-[10px] font-semibold text-line-700">
                        {member.role}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-line-500">{member.name}</p>
                  <p className="mt-1 text-xs font-semibold">
                    <span className="text-clay-400">LP {member.league_point}</span>
                    {member.mapo_score !== null && (
                      <span className="text-court-400"> · 마포 {member.mapo_score}점</span>
                    )}
                    <span className="text-line-500">
                      {" "}
                      · {member.wins}승 {member.losses}패
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && member.phone && <CallButton phone={member.phone} />}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
