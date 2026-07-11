import type { CSSProperties } from "react";
import Link from "next/link";

export type AdminQuickActionVariant = "actionable" | "emphasized" | "default";

interface AdminQuickActionProps {
  href: string;
  label: string;
  variant?: AdminQuickActionVariant;
}

function variantStyle(variant: AdminQuickActionVariant): CSSProperties {
  if (variant === "actionable") {
    return {
      background: "var(--admin-action-bg)",
      border: "1px solid var(--admin-action-bg)",
    };
  }
  if (variant === "emphasized") {
    return {
      background: "var(--admin-surface)",
      border: "1px solid var(--admin-border)",
      borderLeftWidth: "3px",
      borderLeftColor: "var(--admin-accent)",
    };
  }
  return {
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
  };
}

/** AdminQuickAction — 대시보드 "빠른 실행" 타일. variant는 CSS 변수 조합만으로 구분. */
export function AdminQuickAction({ href, label, variant = "default" }: AdminQuickActionProps) {
  const textColor = variant === "actionable" ? "var(--admin-action-text)" : "var(--admin-text)";
  return (
    <Link href={href}>
      <div
        className="flex min-h-[44px] items-center overflow-hidden rounded-[var(--admin-card-radius,14px)] px-4 py-3 transition-colors hover:border-[color:var(--admin-border-strong,var(--admin-border))]"
        style={variantStyle(variant)}
      >
        <p className="text-sm font-semibold" style={{ color: textColor }}>{label}</p>
      </div>
    </Link>
  );
}
