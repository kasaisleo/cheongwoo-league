import type { CSSProperties, ReactNode } from "react";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getClubSkin } from "@/lib/club-skin";
import { AdminClubShell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const adminClubSlug = cookieStore.get("admin_club_slug")?.value ?? null;

  let accentVars: CSSProperties = {};
  let logoSrc: string | null = null;
  let clubName: string | null = null;
  let skinKey: string | null = null;

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
      skinKey = club.skin_key;
    }
  }

  return (
    <AdminClubShell
      accentVars={accentVars}
      logoSrc={logoSrc}
      clubName={clubName}
      skinKey={skinKey ?? undefined}
    >
      {children}
    </AdminClubShell>
  );
}
