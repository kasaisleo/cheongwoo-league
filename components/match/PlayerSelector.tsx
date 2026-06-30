"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { getMemberDisplayLabel } from "@/lib/member-display";
import type { Member, Guest } from "@/lib/supabase/database.types";

export interface SelectedPlayer {
  id: string;
  name: string;
  isGuest: boolean;
}

interface PlayerSelectorProps {
  members: Member[];
  guests: Guest[];
  /** 해당 세션 참석 확정 회원 ID 목록 (attending status) */
  attendingMemberIds?: string[];
  /** 해당 세션 미정 회원 ID 목록 (undecided status) */
  undecidedMemberIds?: string[];
  selectedKeys: string[];
  excludeKeys: string[];
  value: SelectedPlayer | null;
  onChange: (player: SelectedPlayer) => void;
  onRequestAddGuest: () => void;
  label: string;
}

export function playerKey(id: string, isGuest: boolean): string {
  return `${isGuest ? "guest" : "member"}:${id}`;
}

/**
 * PlayerSelector v2 — Step 18 UX 개선 + Design System 통일.
 *
 * 변경:
 *   - 참석자 우선 노출: attending → undecided → 전체(검색) → 게스트
 *   - court-400 완전 제거 → clay/gold/gray 체계
 *   - rounded-full → rounded-sm
 *   - 회원/게스트 탭 compact (rounded-sm, muted 기본)
 *   - 검색창 우선 배치
 *   - attending 칩: gold 강조
 *   - undecided 칩: clay 강조
 *   - 선택됨: gold (참석자), clay (기타)
 *   - 게스트 탭은 기존 기능 유지
 */
export function PlayerSelector({
  members,
  guests,
  attendingMemberIds = [],
  undecidedMemberIds = [],
  selectedKeys,
  excludeKeys,
  value,
  onChange,
  onRequestAddGuest,
  label,
}: PlayerSelectorProps) {
  const [tab, setTab] = useState<"member" | "guest">("member");
  const [query, setQuery] = useState("");

  // 그룹 분류
  const attendingMembers = members.filter((m) => attendingMemberIds.includes(m.id));
  const undecidedMembers = members.filter((m) => undecidedMemberIds.includes(m.id));
  const otherMembers = members.filter(
    (m) => !attendingMemberIds.includes(m.id) && !undecidedMemberIds.includes(m.id)
  );

  // 검색 필터 (전체 회원 대상)
  const filteredOthers = query.trim()
    ? members.filter((m) => {
        const q = query.trim().toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.nickname.toLowerCase().includes(q)
        );
      })
    : null; // null = 검색 전 상태

  function MemberChip({ member, groupType }: { member: Member; groupType: "attending" | "undecided" | "other" }) {
    const key = playerKey(member.id, false);
    const isSelected = value !== null && playerKey(value.id, value.isGuest) === key;
    const isTakenByOther = excludeKeys.includes(key) && !isSelected;
    const displayLabel = getMemberDisplayLabel(member);

    // 색상 결정
    let chipClass: string;
    if (isTakenByOther) {
      chipClass = "cursor-not-allowed border-line-200/40 bg-line-50 text-line-500 opacity-40";
    } else if (isSelected) {
      chipClass = groupType === "attending"
        ? "border-gold bg-gold/15 text-gold"
        : "border-clay-400 bg-clay-400/10 text-clay-400";
    } else if (groupType === "attending") {
      chipClass = "border-gold/30 bg-gold/5 text-line-800 hover:border-gold/60";
    } else if (groupType === "undecided") {
      chipClass = "border-clay-400/30 bg-clay-400/5 text-line-700 hover:border-clay-400/60";
    } else {
      chipClass = "border-line-200/40 bg-line-50 text-line-700 hover:border-line-300";
    }

    return (
      <button
        key={key}
        type="button"
        disabled={isTakenByOther}
        onClick={() => onChange({ id: member.id, name: displayLabel, isGuest: false })}
        className={clsx(
          "inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
          chipClass
        )}
      >
        {displayLabel}
      </button>
    );
  }

  return (
    <div>
      {/* 라벨 + 회원/게스트 탭 토글 */}
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          {label}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("member")}
            className={clsx(
              "rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
              tab === "member"
                ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                : "border-line-200/40 text-line-500"
            )}
          >
            회원
          </button>
          <button
            type="button"
            onClick={() => setTab("guest")}
            className={clsx(
              "rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
              tab === "guest"
                ? "border-line-400 bg-line-200 text-line-700"
                : "border-line-200/40 text-line-500"
            )}
          >
            게스트
          </button>
        </div>
      </div>

      {tab === "member" ? (
        <div className="space-y-2">
          {/* 1. 참석 확정 그룹 */}
          {attendingMembers.length > 0 && (
            <div>
              <p className="mb-1 font-display text-[9px] font-bold uppercase tracking-wider text-gold/80">
                참석
              </p>
              <div className="flex flex-wrap gap-1.5">
                {attendingMembers.map((m) => (
                  <MemberChip key={m.id} member={m} groupType="attending" />
                ))}
              </div>
            </div>
          )}

          {/* 2. 미정 그룹 */}
          {undecidedMembers.length > 0 && (
            <div>
              <p className="mb-1 font-display text-[9px] font-bold uppercase tracking-wider text-clay-400/70">
                미정
              </p>
              <div className="flex flex-wrap gap-1.5">
                {undecidedMembers.map((m) => (
                  <MemberChip key={m.id} member={m} groupType="undecided" />
                ))}
              </div>
            </div>
          )}

          {/* 3. 검색창 + 전체 회원 */}
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={attendingMembers.length > 0 ? "전체 회원 검색..." : "이름 검색"}
              className="box-border block h-8 w-full rounded-sm border border-line-200/40 bg-line-50 px-2.5 text-xs text-line-900 placeholder:text-line-500"
            />
            {/* 검색 결과 또는 세션 미선택 시 전체 노출 */}
            {(filteredOthers !== null || attendingMembers.length === 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(filteredOthers ?? otherMembers).map((m) => (
                  <MemberChip key={m.id} member={m} groupType="other" />
                ))}
                {filteredOthers !== null && filteredOthers.length === 0 && (
                  <p className="text-xs text-line-500">검색 결과가 없어요.</p>
                )}
              </div>
            )}
          </div>

          {members.length === 0 && (
            <p className="text-xs text-line-500">등록된 회원이 없어요.</p>
          )}
        </div>
      ) : (
        /* 게스트 탭 — 기능 유지, 스타일만 정리 */
        <div className="flex flex-wrap gap-1.5">
          {guests.map((guest) => {
            const key = playerKey(guest.id, true);
            const isSelected = value !== null && playerKey(value.id, value.isGuest) === key;
            const isTakenByOther = excludeKeys.includes(key) && !isSelected;
            return (
              <button
                key={key}
                type="button"
                disabled={isTakenByOther}
                onClick={() => onChange({ id: guest.id, name: guest.name, isGuest: true })}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "border-line-400 bg-line-200 text-line-800"
                    : isTakenByOther
                    ? "cursor-not-allowed border-line-200/40 text-line-500 opacity-40"
                    : "border-line-200/40 bg-line-50 text-line-700 hover:border-line-300"
                )}
              >
                {guest.name}
                <span className="text-[9px] text-line-500">G</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRequestAddGuest}
            className="rounded-sm border border-dashed border-line-300 px-2.5 py-1 text-xs font-semibold text-line-500 hover:border-line-400"
          >
            + 게스트 등록
          </button>
        </div>
      )}
    </div>
  );
}
