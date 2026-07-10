import type { CSSProperties, ReactNode } from "react";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { getClubSkin } from "@/lib/club-skin";
import { AdminClubShell } from "@/components/shell";
import { AdminGatewayShell } from "@/components/admin/AdminGatewayShell";
import { AdminAccountBar } from "@/components/admin/AdminAccountBar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";

/**
 * AdminLayout — admin_club_slug 유무로 shell을 분기한다.
 *
 * 클럽 미선택 (admin_club_slug 없음):
 *   AdminGatewayShell — neutral dark, nav 없음, skin 없음
 *   → 로그인 게이트 / 클럽 선택 / 권한 없음 화면
 *
 * 클럽 선택 완료 (admin_club_slug 있음):
 *   AdminClubShell — 해당 클럽 admin skin
 *   AdminAccountBar — 클럽명 / 역할 / 로그아웃
 *   AdminBottomNav — 관리 탭
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminAccessServer();
  const adminClubSlug = access.clubSlug ?? null;

  // ── 클럽 미선택 → Neutral Gateway Shell ──────────────
  if (!adminClubSlug) {
    return (
      <AdminGatewayShell>
        {children}
      </AdminGatewayShell>
    );
  }

  // ── 클럽 선택 완료 → Club Admin Shell ────────────────
  let accentVars: CSSProperties = {};
  let clubName: string | null = null;
  let skinKey: string | null = null;
  let displayName: string | null = null;

  const supabase = createServiceClient();

  const [clubResult, memberResult] = await Promise.all([
    supabase
      .from("clubs")
      .select("name, skin_key")
      .eq("slug", adminClubSlug)
      .maybeSingle(),
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
    clubName = clubResult.data.name;
    skinKey = clubResult.data.skin_key;
  }

  displayName = memberResult.data?.name ?? null;
  const roleForDisplay = access.cookieRole ?? access.kakaoRole ?? null;
  if (!displayName && access.cookieRole) {
    displayName = access.cookieRole === "owner" ? "Owner" : "Manager";
  }

  return (
    <AdminClubShell
      accentVars={accentVars}
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
