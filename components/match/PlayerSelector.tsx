"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { getMemberDisplayLabel } from "@/lib/member-display";
import type { Member, Guest } from "@/lib/supabase/database.types";

export interface SelectedPlayer {
  id: string;
  /** 표시명 — members.name 기반. nickname이 다를 경우 "이름 · 닉네임" 형식. */
  name: string;
  isGuest: boolean;
}

interface PlayerSelectorProps {
  members: Member[];
  guests: Guest[];
  selectedKeys: string[];
  excludeKeys: string[];
  value: SelectedPlayer | null;
  onChange: (player: SelectedPlayer) => void;
  onRequestAddGuest: () => void;
  label: string;
}

/** 선택 상태 비교/제외 판단에 쓰는 고유 키 (회원/게스트 id가 우연히 같을 수 있으므로 구분) */
export function playerKey(id: string, isGuest: boolean): string {
  return `${isGuest ? "guest" : "member"}:${id}`;
}

export function PlayerSelector({
  members,
  guests,
  selectedKeys,
  excludeKeys,
  value,
  onChange,
  onRequestAddGuest,
  label,
}: PlayerSelectorProps) {
  const [tab, setTab] = useState<"member" | "guest">("member");

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-line-600">{label}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("member")}
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              tab === "member" ? "bg-clay-400 text-line-25" : "bg-line-200 text-line-600"
            )}
          >
            회원
          </button>
          <button
            type="button"
            onClick={() => setTab("guest")}
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              tab === "guest" ? "bg-court-400 text-line-25" : "bg-line-200 text-line-600"
            )}
          >
            게스트
          </button>
        </div>
      </div>

      {tab === "member" ? (
        <div className="flex flex-wrap gap-1.5">
          {members.map((member) => {
            const key = playerKey(member.id, false);
            const isSelected = value !== null && playerKey(value.id, value.isGuest) === key;
            const isTakenByOther = excludeKeys.includes(key) && !isSelected;
            // 버튼 라벨: "이름 · 닉네임" 또는 "이름"
            const displayLabel = getMemberDisplayLabel(member);
            return (
              <button
                key={key}
                type="button"
                disabled={isTakenByOther}
                onClick={() => onChange({ id: member.id, name: displayLabel, isGuest: false })}
                className={clsx(
                  "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : isTakenByOther
                    ? "cursor-not-allowed border-line-200 bg-line-100 text-line-400 opacity-50"
                    : "border-line-200 bg-line-50 text-line-800 hover:border-clay-400"
                )}
              >
                {displayLabel}
                <span className={clsx("text-[10px]", isSelected ? "text-line-25/70" : "text-line-500")}>
                  {member.grade}
                </span>
              </button>
            );
          })}
          {members.length === 0 && <p className="text-xs text-line-400">등록된 회원이 없어요.</p>}
        </div>
      ) : (
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
                  "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "border-court-400 bg-court-400 text-line-25"
                    : isTakenByOther
                    ? "cursor-not-allowed border-line-200 bg-line-100 text-line-400 opacity-50"
                    : "border-line-200 bg-line-50 text-line-800 hover:border-court-400"
                )}
              >
                {guest.name}
                <span className={clsx("text-[10px]", isSelected ? "text-line-25/70" : "text-line-500")}>
                  G
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRequestAddGuest}
            className="rounded-full border border-dashed border-court-400 px-3 py-1.5 text-sm font-semibold text-court-400"
          >
            + 게스트 등록
          </button>
        </div>
      )}
    </div>
  );
}
