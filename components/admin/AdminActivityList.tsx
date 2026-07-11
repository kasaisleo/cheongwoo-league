import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export type AdminActivityTone = "default" | "alert" | "achievement";

export interface AdminActivityItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  tone?: AdminActivityTone;
}

interface AdminActivityListProps {
  items: AdminActivityItem[];
  emptyLabel: string;
}

function toneColor(tone: AdminActivityTone | undefined): string {
  if (tone === "alert") return "var(--admin-alert)";
  if (tone === "achievement") return "var(--admin-achievement)";
  return "var(--admin-text)";
}

/**
 * AdminActivityList — 행 나열형 리스트 공통 컴포넌트.
 * Today/Attention, Recent Activity, Club Status 등에서 재사용.
 * 항목 0개면 empty card 남발 대신 조용한 상태 메시지 하나만 표시.
 */
export function AdminActivityList({ items, emptyLabel }: AdminActivityListProps) {
  const surfaceStyle: CSSProperties = {
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
  };
  const rowBorder: CSSProperties = { borderBottom: "1px solid var(--admin-border)" };

  if (items.length === 0) {
    return (
      <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] px-4 py-3.5 text-center" style={surfaceStyle}>
        <p className="text-xs" style={{ color: "var(--admin-muted)" }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)]" style={surfaceStyle}>
      {items.map((item, idx) => {
        const row = (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 ${item.href ? "transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]" : ""}`}
            style={idx < items.length - 1 ? rowBorder : undefined}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: toneColor(item.tone) }}>{item.title}</p>
              {item.meta && (
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--admin-muted)" }}>{item.meta}</p>
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
          <Link key={item.id} href={item.href}>{row}</Link>
        ) : (
          <div key={item.id}>{row}</div>
        );
      })}
    </div>
  );
}
