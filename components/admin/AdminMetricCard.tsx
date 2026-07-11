import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export type AdminMetricVariant = "default" | "emphasized" | "actionable" | "alert" | "achievement";

interface AdminMetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  variant?: AdminMetricVariant;
  href?: string;
}

/**
 * AdminMetricCard — 대시보드/기록 페이지 공통 숫자 지표 카드.
 *
 * variant는 CSS 변수 조합으로만 구분한다 (skin_key 분기 없음):
 *   - default:     기본 surface, 무게감 낮음
 *   - emphasized:  raised surface + strong border, 강조
 *   - actionable:  action fill 배경 (클릭 유도)
 *   - alert:       semantic alert 색상 (운영 경고)
 *   - achievement: achievement 색상 (긍정적 성과 지표)
 */
function variantStyle(variant: AdminMetricVariant): { card: CSSProperties; value: CSSProperties } {
  switch (variant) {
    case "emphasized":
      return {
        card: {
          background: "var(--admin-surface-raised, var(--admin-surface))",
          border: "1px solid var(--admin-border-strong, var(--admin-border))",
        },
        value: { color: "var(--admin-text)" },
      };
    case "actionable":
      return {
        card: {
          background: "var(--admin-action-bg)",
          border: "1px solid var(--admin-action-bg)",
        },
        value: { color: "var(--admin-action-text)" },
      };
    case "alert":
      return {
        card: {
          background: "var(--admin-alert-soft)",
          border: "1px solid var(--admin-alert)",
        },
        value: { color: "var(--admin-alert)" },
      };
    case "achievement":
      return {
        card: {
          background: "var(--admin-accent-soft)",
          border: "1px solid var(--admin-border)",
        },
        value: { color: "var(--admin-achievement)" },
      };
    default:
      return {
        card: {
          background: "var(--admin-surface)",
          border: "1px solid var(--admin-border)",
        },
        value: { color: "var(--admin-text)" },
      };
  }
}

export function AdminMetricCard({ label, value, sub, variant = "default", href }: AdminMetricCardProps) {
  const { card, value: valueStyle } = variantStyle(variant);
  const labelColor = variant === "actionable" ? "var(--admin-action-text)" : "var(--admin-muted)";

  const content = (
    <div
      className={`overflow-hidden rounded-[var(--admin-card-radius,14px)] px-4 py-3.5 transition-colors ${href ? "group-hover:border-[color:var(--admin-border-strong,var(--admin-border))]" : ""}`}
      style={card}
    >
      <p className="font-score text-3xl font-bold tabular-nums" style={valueStyle}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold" style={{ color: labelColor }}>
        {label}
      </p>
      {sub && (
        <p className="text-[10px]" style={{ color: labelColor, opacity: 0.7 }}>
          {sub}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {content}
      </Link>
    );
  }
  return content;
}
