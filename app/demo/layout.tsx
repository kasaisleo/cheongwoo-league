import type { ReactNode } from "react";

export const metadata = {
  title: "SUPER MATCH Demo",
  description: "체험 모드 — 실서비스 데이터에 영향 없이 플랫폼 기능을 둘러보세요.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #071207 0%, #030c03 60%, #050a05 100%)",
        color: "#f5f0e8",
      }}
    >
      {children}
    </div>
  );
}
