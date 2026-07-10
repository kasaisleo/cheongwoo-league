import type { CSSProperties, ReactNode } from "react";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { getClubSkin } from "@/lib/club-skin";
import { AdminClubShell } from "@/components/shell";
import { AdminAccountBar } from "@/components/admin/AdminAccountBar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminAccessServer();
  const adminClubSlug = access.clubSlug ?? null;

  let accentVars: CSSProperties = {};
  let logoSrc: string | null = null;
  let clubName: string | null = null;
  let skinKey: string | null = null;
  let displayName: string | null = null;

  if (adminClubSlug) {
    const supabase = createServiceClient();

    const [clubResult, memberResult] = await Promise.all([
      supabase
        .from("clubs")
        .select("name, skin_key")
        .eq("slug", adminClubSlug)
        .maybeSingle(),
      // Kakao admin인 경우 memberId로 이름 조회
      access.memberId
        ? supabase
            .from("members")
            .select("name")
            .eq("id", access.memberId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (clubResult.data) {
      const skin = getClubSkin(clubResult.data.skin_key);
      accentVars = {
        "--club-primary": skin.cssVars["--club-primary"],
        "--club-primary-dark": skin.cssVars["--club-primary-dark"],
      } as CSSProperties;
      logoSrc = skin.logos?.primary ?? null;
      clubName = clubResult.data.name;
      skinKey = clubResult.data.skin_key;
    }

    displayName = memberResult.data?.name ?? null;
  }

  // cookie admin이면 role label을 이름으로 사용
  const roleForDisplay = access.cookieRole ?? access.kakaoRole ?? null;
  if (!displayName && access.cookieRole) {
    displayName = access.cookieRole === "owner" ? "Owner" : "Manager";
  }

  return (
    <AdminClubShell
      accentVars={accentVars}
      logoSrc={logoSrc}
      clubName={clubName}
      skinKey={skinKey ?? undefined}
    >
      <AdminAccountBar
        clubName={clubName}
        clubSlug={adminClubSlug}
        displayName={displayName}
        role={roleForDisplay}
      />
      <div className="pb-20">
        {children}
      </div>
      <AdminBottomNav isOwner={access.isOwner} />
    </AdminClubShell>
  );
}
