import type { ReactNode } from "react";
import { MemberAuthBar } from "@/components/layout/MemberAuthBar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { PublicDesktopSidebar } from "@/components/layout/PublicDesktopSidebar";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * Foundation-2: <1024px(Tailwind `lg` 미만)는 기존과 동일한 max-w-md 세로
 * 스택, >=1024px는 PublicDesktopSidebar + Main Column(flex-1) 가로 배치.
 * MemberAuthBar/BottomTabBar는 항상 Main Column 안에 그대로 유지된다.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const currentClubId = await getCurrentClubId();
  return (
    <div className="lg:flex" style={{ minHeight: "100dvh" }}>
      <PublicDesktopSidebar />
      <div className="min-w-0 flex-1">
        <MemberAuthBar currentClubId={currentClubId} />
        <div className="mx-auto min-h-screen max-w-md pb-20 lg:max-w-none lg:pb-0">
          {children}
        </div>
        <BottomTabBar />
      </div>
    </div>
  );
}
