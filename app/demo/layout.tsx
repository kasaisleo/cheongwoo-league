import type { ReactNode } from "react";

export const metadata = {
  title: "SUPER MATCH Demo — Experience Mode",
  description: "체험 모드 — 실서비스 데이터에 영향 없이 플랫폼 기능을 둘러보세요.",
};

/**
 * Demo layout: fixed full-screen overlay (z-9999) — PlatformLandingClient와 동일 패턴.
 * BrandHeader / MemberAuthBar / BottomTabBar 등 루트 layout chrome을 완전히 가린다.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        minHeight: "100dvh",
        overflowY: "auto",
        background:
          "linear-gradient(160deg, #031309 0%, #061d11 55%, #020b05 100%)",
        color: "#f5efda",
        isolation: "isolate",
      }}
    >
      {/* purple top accent — CENTER COURT 스타일 */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(143,107,255,0.50) 30%, rgba(185,156,255,0.70) 50%, rgba(143,107,255,0.50) 70%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {children}
    </div>
  );
}
