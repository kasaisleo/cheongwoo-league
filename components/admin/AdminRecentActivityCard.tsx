"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminActivityItem, AdminActivityTone } from "./AdminActivityList";

type TabKey = "matches" | "members" | "attendance";

interface AdminRecentActivityCardProps {
  matches: AdminActivityItem[];
  members: AdminActivityItem[];
  attendance: AdminActivityItem[];
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "matches", label: "경기" },
  { key: "members", label: "회원" },
  { key: "attendance", label: "출석" },
];

const EMPTY_LABEL: Record<TabKey, string> = {
  matches: "최근 경기 기록이 없어요.",
  members: "최근 등록된 회원이 없어요.",
  attendance: "최근 출석 변화가 없어요.",
};

function toneColor(tone: AdminActivityTone | undefined): string {
  if (tone === "alert") return "var(--admin-alert)";
  if (tone === "achievement") return "var(--admin-achievement)";
  return "var(--admin-text)";
}

/**
 * AdminRecentActivityCard — 최근 경기/회원 등록/출석 변화를
 * 카드 3개로 나열하지 않고 탭 1개짜리 카드로 압축한다.
 * skin 차이는 CSS 변수만 — 탭/행 구조는 동일 DOM.
 */
export function AdminRecentActivityCard({ matches, members, attendance }: AdminRecentActivityCardProps) {
  const [tab, setTab] = useState<TabKey>("matches");
  const dataByTab: Record<TabKey, AdminActivityItem[]> = { matches, members, attendance };
  const items = dataByTab[tab];

  return (
    <div
      className="overflow-hidden rounded-[var(--admin-card-radius,14px)]"
      style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
    >
      <div className="flex" style={{ borderBottom: "1px solid var(--admin-border)" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex-1 px-3 py-2 text-xs font-semibold transition-colors"
              style={{
                color: active ? "var(--admin-text)" : "var(--admin-muted)",
                borderBottom: active ? "2px solid var(--admin-accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-3 text-xs" style={{ color: "var(--admin-muted)" }}>{EMPTY_LABEL[tab]}</p>
      ) : (
        <div>
          {items.map((item, idx) => {
            const row = (
              <div
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors"
                style={idx < items.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: toneColor(item.tone) }}>{item.title}</p>
                  {item.meta && (
                    <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--admin-muted)" }}>{item.meta}</p>
                  )}
                </div>
                {item.trailing && (
                  <span className="flex-shrink-0 text-xs font-semibold" style={{ color: toneColor(item.tone) }}>
                    {item.trailing}
                  </span>
                )}
              </div>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="block hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]">
                {row}
              </Link>
            ) : (
              <div key={item.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
