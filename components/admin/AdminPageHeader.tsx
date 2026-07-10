import type { ReactNode } from "react";
import Link from "next/link";

interface AdminPageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
}

/**
 * AdminPageHeader — 어드민 내부 페이지 공통 상단 헤더.
 *
 * - eyebrow: 장식 영문 라벨 (기본값 "ADMIN"). title과 동일 한국어 반복 금지.
 * - title: 한국어 페이지명.
 * - description: 부제 (선택).
 * - backHref: ← 관리자 링크 (선택, 기본값 "/admin").
 * - action: 오른쪽 추가 액션 (선택).
 */
export function AdminPageHeader({
  title,
  eyebrow = "ADMIN",
  description,
  backHref = "/admin",
  action,
}: AdminPageHeaderProps) {
  return (
    <header className="mb-5 flex items-start justify-between">
      <div>
        <p
          className="eyebrow-en text-[9px]"
          style={{ color: "var(--admin-muted)" }}
        >
          {eyebrow}
        </p>
        <h1
          className="headline-kr text-4xl"
          style={{ color: "var(--admin-text)" }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-1 max-w-[280px] break-keep text-xs leading-relaxed"
            style={{ color: "var(--admin-muted)" }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 pt-1">
        {action}
        <Link
          href={backHref}
          className="whitespace-nowrap rounded-[var(--admin-button-radius,6px)] border px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{
            borderColor: "var(--admin-border)",
            color: "var(--admin-muted)",
          }}
        >
          ← 관리자
        </Link>
      </div>
    </header>
  );
}
