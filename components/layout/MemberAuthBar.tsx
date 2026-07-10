"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AdminRole } from "@/lib/admin-auth";
import type { PermissionRole } from "@/lib/supabase/database.types";

interface MemberAuthBarProps {
  currentClubId: string;
}

interface MemberInfo {
  id: string;
  nickname: string;
  name: string;
  permission_role: PermissionRole;
}

const KAKAO_ADMIN_ROLES: PermissionRole[] = ["manager", "admin", "master"];

/**
 * TopUtilityBar (MemberAuthBar) v4 — skin-aware, CSS var 직접 사용.
 *
 * 색상: --club-primary / --club-muted / --club-surface / --club-border
 *   → :root 기본값: 라임/navy (청우회)
 *   → :root:has([data-club-skin="namaste"]): 퍼플/크림 (나마스테)
 *   → 공개 slug 컨텍스트 밖에서는 :root 기본값 유지
 *
 * 구조: [관리자 링크] ─────── [이름 · 마이 · 로그아웃] or [카카오 로그인]
 */
export function MemberAuthBar({ currentClubId }: MemberAuthBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const slugMatch = pathname.match(/^\/c\/([^/]+)/);
  const currentSlug = slugMatch ? slugMatch[1] : null;

  const [lastSlug, setLastSlug] = useState<string | null>(currentSlug);
  useEffect(() => {
    if (currentSlug) setLastSlug(currentSlug);
  }, [currentSlug]);

  const [resolvedClubId, setResolvedClubId] = useState<string>(currentClubId);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [cookieRole, setCookieRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    if (!currentSlug) { setResolvedClubId(currentClubId); return; }
    const supabase = createClient();
    supabase
      .from("clubs").select("id")
      .eq("slug", currentSlug).eq("status", "active").maybeSingle()
      .then(({ data }) => { setResolvedClubId(data?.id ?? currentClubId); });
  }, [currentSlug, currentClubId]);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((body) => setCookieRole(body?.role ?? null))
      .catch(() => setCookieRole(null));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setInitialized(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (!session) setMember(null);
      setInitialized(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) { setMember(null); return; }
    const supabase = createClient();
    void (async () => {
      try {
        const { data } = await supabase
          .from("members").select("id, nickname, name, permission_role")
          .eq("auth_user_id", authUser.id).eq("club_id", resolvedClubId).maybeSingle();
        setMember(data ?? null);
      } catch { setMember(null); }
    })();
  }, [authUser, resolvedClubId]);

  async function handleSignOut() {
    setSigningOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch (e) { console.error("logout failed", e); }
    const supabase = createClient();
    await supabase.auth.signOut();
    setCookieRole(null);
    const slug = currentSlug ?? lastSlug;
    router.push(slug ? `/c/${slug}` : "/");
    router.refresh();
  }

  if (!initialized) return null;

  const isKakaoAdmin = member !== null && (KAKAO_ADMIN_ROLES as string[]).includes(member.permission_role);
  const isAdminMode = cookieRole !== null || isKakaoAdmin;

  const rawMeta = authUser?.user_metadata as Record<string, unknown> | undefined;
  const trim = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const kakaoName = trim(rawMeta?.name) || trim(rawMeta?.full_name) || trim(rawMeta?.preferred_username) || trim(rawMeta?.user_name);

  const memberNickname = member?.nickname?.trim() || "";
  const memberName = member?.name?.trim() || "";
  const primaryDisplayName = memberNickname && memberNickname !== memberName ? memberNickname : kakaoName || memberName;
  const shouldShowRealName = memberName !== "" && primaryDisplayName !== memberName;

  const loginHref = pathname && pathname !== "/" && pathname !== "/login"
    ? `/login?returnUrl=${encodeURIComponent(pathname)}`
    : "/login";

  const adminHref = currentSlug ? `/api/admin/enter?club=${currentSlug}` : "/admin";
  const mypageHref = currentSlug ? `/c/${currentSlug}/mypage` : "/mypage";

  return (
    <div
      className="border-b"
      style={{
        backgroundColor: "var(--club-bg)",
        borderBottomColor: "var(--club-border)",
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">

        {/* 좌측: 관리자 */}
        <div className="flex items-center">
          {isAdminMode ? (
            <Link
              href={adminHref}
              className="inline-flex items-center gap-1.5 rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold whitespace-nowrap"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />
              관리자 모드
            </Link>
          ) : (
            <Link
              href={adminHref}
              className="text-[10px] font-medium whitespace-nowrap transition-opacity hover:opacity-80"
              style={{ color: "var(--club-muted)" }}
            >
              관리자
            </Link>
          )}
        </div>

        {/* 우측: 회원 상태 */}
        <div className="flex items-center gap-2.5">
          {authUser && member ? (
            <>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: "var(--club-text)" }}
              >
                {primaryDisplayName}
                {shouldShowRealName && (
                  <span className="ml-1 font-normal" style={{ color: "var(--club-muted)" }}>
                    ({memberName})
                  </span>
                )}
              </span>
              <span style={{ color: "var(--club-border)" }} aria-hidden>·</span>
              <Link
                href={mypageHref}
                className="text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-80"
                style={{ color: "var(--club-primary)" }}
              >
                마이
              </Link>
              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                className="text-xs whitespace-nowrap disabled:opacity-40 transition-opacity hover:opacity-70"
                style={{ color: "var(--club-muted)" }}
              >
                {signingOut ? "…" : "로그아웃"}
              </button>
            </>
          ) : (
            <Link
              href={loginHref}
              className="text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-80"
              style={{ color: "var(--club-primary)" }}
            >
              카카오 로그인
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
