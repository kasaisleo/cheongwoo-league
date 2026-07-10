import type { ReactNode } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { MemberAuthBar } from "@/components/layout/MemberAuthBar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { getCurrentClubId } from "@/lib/current-club";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const currentClubId = await getCurrentClubId();
  return (
    <>
      <BrandHeader />
      <MemberAuthBar currentClubId={currentClubId} />
      <div className="mx-auto min-h-screen max-w-md pb-20">
        {children}
      </div>
      <BottomTabBar />
    </>
  );
}
