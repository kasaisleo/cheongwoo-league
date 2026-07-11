"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { PermissionRole } from "@/lib/supabase/database.types";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { useShellTransition } from "@/components/shell/ShellTransition";
import { PublicKakaoLoginButton } from "@/components/auth/PublicKakaoLoginButton";

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
 * MemberAuthBar v6 — ShellHeader 기반 slot 주입.
 *
 * Row 1: SUPER MATCH (ShellHeader hardcoded) | 사용자명 · 마이 · 로그아웃 (right slot)
 * Row 2: 클럽명 + 클럽 이용 중 (left slot, always on /c/[slug]) | 관리자 모드 (right slot, visibility hidden when non-admin)
 *
 * 색상: --club-* CSS vars.  geometry: --shell-* CSS vars (via ShellHeader).
 * 전환: useShellTransition → 120ms exit → navigateHard(admin enter URL).
 */
export function MemberAuthBar({ currentClubId }: MemberAuthBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { navigateHard, exiting } = useShellTransition();

  const slugMatch = pathname.match(/^\/c\/([^/]+)/);
  const currentSlug = slugMatch ? slugMatch[1] : null;

  const [lastSlug, setLastSlug] = useState<string | null>(currentSlug);
  useEffect(() => {
    if (currentSlug) setLastSlug(currentSlug);
  }, [currentSlug]);

  const [resolvedClubId, setResolvedClubId] = useState<string>(currentClubId);
  const [clubName, setClubName] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // slug 변경 시 클럽 ID + 클럽명 갱신
  useEffect(() => {
    if (!currentSlug) { setResolvedClubId(currentClubId); setClubName(null); return; }
    const supabase = createClient();
    supabase
      .from("clubs")
      .select("id, name")
      .eq("slug", currentSlug)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setResolvedClubId(data?.id ?? currentClubId);
        setClubName(data?.name ?? null);
      });
  }, [currentSlug, currentClubId]);

  // auth 상태 구독
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

  // member 정보 조회 (클럽 scope)
  useEffect(() => {
    if (!authUser) { setMember(null); return; }
    const supabase = createClient();
    void (async () => {
      try {
        const { data } = await supabase
          .from("members")
          .select("id, nickname, name, permission_role")
          .eq("auth_user_id", authUser.id)
          .eq("club_id", resolvedClubId)
          .maybeSingle();
        setMember(data ?? null);
      } catch { setMember(null); }
    })();
  }, [authUser, resolvedClubId]);

  async function handleSignOut() {
    setSigningOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch (e) { console.error("logout failed", e); }
    const supabase = createClient();
    await supabase.auth.signOut();
    const slug = currentSlug ?? lastSlug;
    router.push(slug ? `/c/${slug}` : "/");
    router.refresh();
  }

  if (!initialized) return null;

  const isKakaoAdmin = member !== null && (KAKAO_ADMIN_ROLES as string[]).includes(member.permission_role);

  const rawMeta = authUser?.user_metadata as Record<string, unknown> | undefined;
  const trim = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const kakaoName =
    trim(rawMeta?.name) ||
    trim(rawMeta?.full_name) ||
    trim(rawMeta?.preferred_username) ||
    trim(rawMeta?.user_name);

  const memberNickname = member?.nickname?.trim() || "";
  const memberName = member?.name?.trim() || "";
  const primaryDisplayName =
    memberNickname && memberNickname !== memberName ? memberNickname : kakaoName || memberName;
  const shouldShowRealName = memberName !== "" && primaryDisplayName !== memberName;

  const loginHref =
    pathname && pathname !== "/" && pathname !== "/login"
      ? `/login?returnUrl=${encodeURIComponent(pathname)}`
      : "/login";

  const adminHref = currentSlug ? `/api/admin/enter?club=${currentSlug}` : "/admin";
  const mypageHref = currentSlug ? `/c/${currentSlug}/mypage` : "/mypage";

  // ── Row 1 right slot ─────────────────────────────────────────────────
  const row1Right = authUser && member ? (
    <>
      <span
        className="whitespace-nowrap font-semibold"
        style={{ fontSize: "var(--shell-user-size)", color: "var(--club-text)" }}
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
        className="whitespace-nowrap font-semibold transition-opacity hover:opacity-70"
        style={{ fontSize: "var(--shell-user-size)", color: "var(--club-primary)" }}
      >
        마이
      </Link>
      <button
        type="button"
        disabled={signingOut}
        onClick={handleSignOut}
        className="whitespace-nowrap disabled:opacity-40 transition-opacity hover:opacity-70"
        style={{ fontSize: "var(--shell-user-size)", color: "var(--club-muted)" }}
      >
        {signingOut ? "…" : "로그아웃"}
      </button>
    </>
  ) : currentSlug ? (
    // slug가 확정된 페이지 — 중간 게이트 없이 클릭 즉시 Kakao OAuth 시작
    <PublicKakaoLoginButton
      clubSlug={currentSlug}
      className="whitespace-nowrap bg-transparent p-0 font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
      style={{ fontSize: "var(--shell-user-size)", color: "var(--club-primary)" }}
    >
      카카오 로그인
    </PublicKakaoLoginButton>
  ) : (
    // slug 없는 페이지(플랫폼 홈 등) — club context를 임의로 추정하지 않고 /login으로 위임
    <Link
      href={loginHref}
      className="whitespace-nowrap font-semibold transition-opacity hover:opacity-70"
      style={{ fontSize: "var(--shell-user-size)", color: "var(--club-primary)" }}
    >
      카카오 로그인
    </Link>
  );

  // ── Row 2 left: 클럽명 + 클럽 이용 중 (항상 표시) ───────────────────
  const row2Left = (
    <>
      {clubName && (
        <span
          className="truncate font-semibold whitespace-nowrap"
          style={{ fontSize: "var(--shell-club-size)", color: "var(--club-text)" }}
        >
          {clubName}
        </span>
      )}
      <span
        className="flex-shrink-0 rounded-[var(--club-button-radius)] border font-semibold whitespace-nowrap"
        style={{
          fontSize: "var(--shell-action-size)",
          paddingBlock: "var(--shell-pill-py)",
          paddingInline: "var(--shell-pill-px)",
          borderColor: "var(--club-border)",
          color: "var(--club-muted)",
        }}
      >
        클럽 이용 중
      </span>
    </>
  );

  // ── Row 2 right: 관리자 모드 (non-admin은 visibility:hidden으로 슬롯 유지) ──
  const row2Right = (
    <button
      type="button"
      onClick={() => navigateHard(adminHref)}
      disabled={exiting || !isKakaoAdmin}
      className="flex-shrink-0 rounded-[var(--club-button-radius)] border font-semibold whitespace-nowrap transition-opacity hover:opacity-70 disabled:pointer-events-none"
      style={{
        visibility: isKakaoAdmin ? "visible" : "hidden",
        fontSize: "var(--shell-action-size)",
        paddingBlock: "var(--shell-pill-py)",
        paddingInline: "var(--shell-pill-px)",
        borderColor: "var(--club-border)",
        color: "var(--club-muted)",
      }}
    >
      관리자 모드
    </button>
  );

  return (
    <ShellHeader
      row1Right={row1Right}
      row2Left={currentSlug ? row2Left : undefined}
      row2Right={currentSlug ? row2Right : undefined}
      hideRow2={!currentSlug}
      exiting={exiting}
    />
  );
}
