"use client";

import { clsx } from "clsx";
import type { Member } from "@/lib/supabase/database.types";

interface PlayerSelectorProps {
  members: Member[];
  selectedIds: string[];
  excludeIds: string[];
  value: string | null;
  onChange: (memberId: string) => void;
  label: string;
}

export function PlayerSelector({
  members,
  selectedIds,
  excludeIds,
  value,
  onChange,
  label,
}: PlayerSelectorProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-line-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {members.map((member) => {
          const isSelected = value === member.id;
          const isTakenByOther = excludeIds.includes(member.id) && !isSelected;
          return (
            <button
              key={member.id}
              type="button"
              disabled={isTakenByOther}
              onClick={() => onChange(member.id)}
              className={clsx(
                "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isSelected
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : isTakenByOther
                  ? "cursor-not-allowed border-line-200 bg-line-100 text-line-400 opacity-50"
                  : "border-line-200 bg-line-50 text-line-800 hover:border-clay-400"
              )}
            >
              {member.nickname}
              <span className={clsx("text-[10px]", isSelected ? "text-line-25/70" : "text-line-500")}>
                {member.grade}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
