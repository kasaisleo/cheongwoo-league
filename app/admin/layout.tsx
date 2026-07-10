import type { CSSProperties, ReactNode } from "react";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getClubSkin } from "@/lib/club-skin";

/**
 * app/admin/layout.tsx — 관리자 영역 공통 레이아웃.
 *
 * 브랜딩 정책:
 *   - admin_club_slug 쿠키(set by /api/admin/enter)로 관리 중인 클럽 식별
 *   - --club-primary / --club-primary-dark CSS 변수만 주입 (accent 색상)
 *   - 전체 스킨(배경색, 카드 스타일 등) 적용 금지 — 관리자 UI는 독자적 다크 테마 유지
 *   - 클럽 로고가 있으면 소형 로고를 관리자 컨텍스트 표시용으로 노출
 *
 * 인증 로직은 각 admin 페이지의 requireAdminAccess()가 담당.
 * 여기서는 인증 여부를 판단하거나 수정하지 않는다.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const adminClubSlug = cookieStore.get("admin_club_slug")?.value ?? null;

  let accentVars: CSSProperties = {};
  let logoSrc: string | null = null;
  let clubName: string | null = null;

  if (adminClubSlug) {
    const supabase = createServiceClient();
    const { data: club } = await supabase
      .from("clubs")
      .select("name, skin_key")
      .eq("slug", adminClubSlug)
      .maybeSingle();

    if (club) {
      const skin = getClubSkin(club.skin_key);
      accentVars = {
        "--club-primary": skin.cssVars["--club-primary"],
        "--club-primary-dark": skin.cssVars["--club-primary-dark"],
      } as CSSProperties;
      logoSrc = skin.logos?.primary ?? null;
      clubName = club.name;
    }
  }

  return (
    <div className="font-body" style={accentVars}>
      {logoSrc && clubName && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-0" aria-label={`${clubName} 관리`}>
          <img src={logoSrc} alt={clubName} className="h-6 w-auto opacity-70" />
        </div>
      )}
      {children}
    </div>
  );
}
