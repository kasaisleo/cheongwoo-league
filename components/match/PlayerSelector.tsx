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
  /** 세션 참석 확정 회원 ID (attending) */
  attendingMemberIds?: string[];
  /** 세션 미정 회원 ID (undecided) */
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
 * PlayerSelector v3 — 참석자 우선, 미정 접힘, 전체 검색 시만 노출.
 *
 * 기본 노출:
 *   1) 참석자 (attending) — 항상 표시
 *   2) 미정 — 기본 접힘, "미정 N명 ↓" 클릭 시 펼침
 *   3) 전체 회원 — 검색어 입력 시에만 결과 표시 (빈 상태 = 숨김)
 *   4) 게스트 탭 — 기존 기능 유지
 *
 * 세션 미선택 상태:
 *   attendingMemberIds가 비어있으면 검색창만 표시하고
 *   "세션을 먼저 선택하면 참석자 목록이 표시됩니다" 안내
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
  const [showUndecided, setShowUndecided] = useState(false);

  const sessionSelected = attendingMemberIds.length > 0 || undecidedMemberIds.length > 0;

  const attendingMembers = members.filter((m) => attendingMemberIds.includes(m.id));
  const undecidedMembers = members.filter((m) => undecidedMemberIds.includes(m.id));

  // 전체 회원 검색 — 검색어 있을 때만
  const searchResults = query.trim().length > 0
    ? members.filter((m) => {
        const q = query.trim().toLowerCase();
        return m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q);
      })
    : null;

  function MemberChip({
    member,
    variant,
  }: {
    member: Member;
    variant: "attending" | "undecided" | "search";
  }) {
    const key = playerKey(member.id, false);
    const isSelected = value !== null && playerKey(value.id, value.isGuest) === key;
    const isTaken = excludeKeys.includes(key) && !isSelected;
    const displayLabel = getMemberDisplayLabel(member);

    let cls: string;
    if (isTaken) {
      cls = "cursor-not-allowed border-[color:var(--control-muted-bg)] bg-[color:var(--control-bg)] text-[color:var(--control-placeholder)] opacity-30";
    } else if (isSelected) {
      cls = variant === "attending"
        ? "border-gold bg-gold/15 text-gold"
        : "border-[color:var(--control-border-focus)] bg-[color:var(--control-border-focus)]/10 text-[color:var(--control-border-focus)]";
    } else if (variant === "attending") {
      cls = "border-gold/30 bg-gold/5 text-line-800 hover:border-gold/60";
    } else if (variant === "undecided") {
      cls = "border-[color:var(--control-border-focus)]/30 bg-[color:var(--control-border-focus)]/5 text-[color:var(--control-text)] hover:border-[color:var(--control-border-focus)]/50";
    } else {
      cls = "border-[color:var(--control-border)] bg-[color:var(--control-bg)] text-[color:var(--control-placeholder)] hover:border-[color:var(--control-border-hover)]";
    }

    return (
      <button
        type="button"
        disabled={isTaken}
        onClick={() => onChange({ id: member.id, name: displayLabel, isGuest: false })}
        className={clsx(
          "inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
          cls
        )}
      >
        {displayLabel}
      </button>
    );
  }

  return (
    <div>
      {/* 라벨 + 탭 토글 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold text-line-500">{label}</p>
          {value && (
            <span className="text-[13px] font-semibold tracking-normal text-[color:var(--control-border-focus)]">{value.name}</span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("member")}
            className={clsx(
              "rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
              tab === "member"
                ? "border-[color:var(--control-border-focus)]/60 bg-[color:var(--control-border-focus)]/10 text-[color:var(--control-border-focus)]"
                : "border-[color:var(--control-border)] text-[color:var(--control-placeholder)]"
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
                ? "border-[color:var(--control-border-hover)] bg-[color:var(--control-muted-bg)] text-[color:var(--control-text)]"
                : "border-[color:var(--control-border)] text-[color:var(--control-placeholder)]"
            )}
          >
            게스트
          </button>
        </div>
      </div>

      {tab === "member" ? (
        <div className="space-y-2">

          {/* ── 1. 참석자 (기본 노출) ──────────────────────── */}
          {sessionSelected ? (
            <>
              {attendingMembers.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[9px] font-bold text-gold/70">
                    참석 {attendingMembers.length}명
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {attendingMembers.map((m) => (
                      <MemberChip key={m.id} member={m} variant="attending" />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-line-500">이 세션의 참석 확정 인원이 없습니다.</p>
              )}

              {/* ── 2. 미정 — 기본 접힘 ──────────────────────── */}
              {undecidedMembers.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowUndecided((v) => !v)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-line-500 hover:text-line-700"
                  >
                    <span className="text-[10px]">
                      미정 {undecidedMembers.length}명
                    </span>
                    <span className="text-[9px]">{showUndecided ? "↑" : "↓"}</span>
                  </button>
                  {showUndecided && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {undecidedMembers.map((m) => (
                        <MemberChip key={m.id} member={m} variant="undecided" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-line-500">세션을 선택하면 참석자 목록이 표시됩니다.</p>
          )}

          {/* ── 3. 전체 회원 검색 — 검색어 있을 때만 ────────── */}
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="전체 회원 검색..."
              className="box-border block h-8 w-full rounded-sm border border-[color:var(--control-border)] bg-[color:var(--control-bg)] px-2.5 text-xs text-[color:var(--control-text)] placeholder:text-[color:var(--control-placeholder)] focus:outline-none focus:border-[color:var(--control-border-focus)] focus:ring-2 focus:ring-[color:var(--control-focus-ring)]"
            />
            {searchResults !== null && (
              <div className="mt-1.5">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-line-500">검색 결과가 없어요.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.map((m) => (
                      <MemberChip key={m.id} member={m} variant="search" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* ── 게스트 탭 ─────────────────────────────────── */
        <div className="flex flex-wrap gap-1.5">
          {guests.map((guest) => {
            const key = playerKey(guest.id, true);
            const isSelected = value !== null && playerKey(value.id, value.isGuest) === key;
            const isTaken = excludeKeys.includes(key) && !isSelected;
            return (
              <button
                key={key}
                type="button"
                disabled={isTaken}
                onClick={() => onChange({ id: guest.id, name: guest.name, isGuest: true })}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "border-[color:var(--control-border-hover)] bg-[color:var(--control-muted-bg)] text-[color:var(--control-text)]"
                    : isTaken
                    ? "cursor-not-allowed border-[color:var(--control-border)] text-[color:var(--control-placeholder)] opacity-30"
                    : "border-[color:var(--control-border)] bg-[color:var(--control-bg)] text-[color:var(--control-text)] hover:border-[color:var(--control-border-hover)]"
                )}
              >
                {guest.name}
                <span className="text-[9px] text-[color:var(--control-placeholder)]">G</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRequestAddGuest}
            className="rounded-sm border border-dashed border-[color:var(--control-border-hover)] px-2.5 py-1 text-xs font-semibold text-[color:var(--control-placeholder)] hover:border-[color:var(--control-border-focus)]"
          >
            + 게스트 등록
          </button>
        </div>
      )}
    </div>
  );
}
