import type { ReactNode } from "react";

interface AdminSectionHeaderProps {
  title: string;
  action?: ReactNode;
}

/**
 * AdminSectionHeader — 대시보드/서브페이지 섹션 라벨 공통 컴포넌트.
 * skin 차이는 --admin-muted CSS 변수만으로 처리.
 */
export function AdminSectionHeader({ title, action }: AdminSectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--admin-muted)" }}
      >
        {title}
      </p>
      {action}
    </div>
  );
}
