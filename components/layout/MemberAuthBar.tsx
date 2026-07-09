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
 * MemberAuthBar v3 — slug-aware.
 *
 * /c/[slug] context 감지:
 *   - "카카오 로그인" 링크에 returnUrl 포함 (현재 경로로 복귀)
 *   - 로그아웃 후 /c/[slug]로 이동 (/ 플랫폼 랜딩으로 가지 않음)
 *   - 회원 쿼리도 slug로 resolve한 club_id 기준으로 동작
 *     (나마스테 회원은 /c/namaste에서 자신의 정보를 볼 수 있음)
 *
 * 클럽 context 없는 페이지(/matches 등)에서는 기존 동작 유지.
 */
export function MemberAuthBar({ currentClubId }: MemberAuthBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // /c/[slug] 감지
  const slugMatch = pathname.match(/^\/c\/([^/]+)/);
  const currentSlug = slugMatch ? slugMatch[1] : null;

  // slug로 resolve한 club ID (slug context에서 회원 쿼리 기준)
  const [resolvedClubId, setResolvedClubId] = useState<string>(currentClubId);

  // 우측: 카카오 회원 상태
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 좌측: 관리자 상태
  const [cookieRole, setCookieRole] = useState<AdminRole | null>(null);

  // slug → club_id resolve
  useEffect(() => {
    if (!currentSlug) {
      setResolvedClubId(currentClubId);
      return;
    }
    const supabase = createClient();
    supabase
      .from("clubs")
      .select("id")
      .eq("slug", currentSlug)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setResolvedClubId(data?.id ?? currentClubId);
      });
  }, [currentSlug, currentClubId]);

  // 쿠키 세션 확인 (httpOnly → API 경유)
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((body) => setCookieRole(body?.role ?? null))
      .catch(() => setCookieRole(null));
  }, []);

  // 카카오 세션 감지
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

  // 카카오 회원 정보 조회 — resolvedClubId 기준
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
      } catch {
        setMember(null);
      }
    })();
  }, [authUser, resolvedClubId]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("admin session logout failed", e);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setCookieRole(null);
    // 클럽 context 있으면 해당 클럽 홈으로, 없으면 플랫폼 랜딩으로
    router.push(currentSlug ? `/c/${currentSlug}` : "/");
    router.refresh();
  }

  if (!initialized) return null;

  const isKakaoAdmin = member !== null && (KAKAO_ADMIN_ROLES as string[]).includes(member.permission_role);
  const isAdminMode = cookieRole !== null || isKakaoAdmin;

  const memberNickname = member?.nickname?.trim() || "";
  const memberName = member?.name?.trim() || "";
  const rawUserMetadata = authUser?.user_metadata as Record<string, unknown> | undefined;
  const asTrimmedString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";
  const kakaoDisplayName =
    asTrimmedString(rawUserMetadata?.name) ||
    asTrimmedString(rawUserMetadata?.full_name) ||
    asTrimmedString(rawUserMetadata?.preferred_username) ||
    asTrimmedString(rawUserMetadata?.user_name);

  const primaryDisplayName =
    memberNickname && memberNickname !== memberName
      ? memberNickname
      : kakaoDisplayName || memberName;

  const shouldShowRealName = memberName !== "" && primaryDisplayName !== memberName;

  // 로그인 링크에 현재 경로를 returnUrl로 포함 (클럽 내부에서 로그인하면 돌아올 수 있게)
  const loginHref =
    pathname && pathname !== "/" && pathname !== "/login"
      ? `/login?returnUrl=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <div className="border-b border-line-200/40 bg-line-25">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">

        {/* ── 좌측: 관리자 영역 ─────────────────────── */}
        <div className="flex items-center">
          {isAdminMode ? (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-1 rounded-sm border border-gold/40 bg-gold/10 px-2 py-0 leading-none text-[10px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20 h-[22px] whitespace-nowrap"
            >
              <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold" />
              관리자 모드
            </Link>
          ) : (
            <Link
              href="/admin"
              className="inline-flex items-center h-[22px] text-[10px] font-semibold text-line-500 transition-colors hover:text-line-700 whitespace-nowrap"
            >
              관리자
            </Link>
          )}
        </div>

        {/* ── 우측: 카카오 회원 영역 ───────────────── */}
        <div className="flex items-center">
          {authUser && member ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-line-900 whitespace-nowrap">
                {primaryDisplayName}
                {shouldShowRealName && (
                  <span className="ml-1 font-normal text-line-400">({memberName})</span>
                )}
              </span>
              <Link href="/mypage" className="inline-flex items-center text-xs font-semibold text-clay-400 whitespace-nowrap">
                마이페이지
              </Link>
              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                className="inline-flex items-center text-xs text-line-400 disabled:opacity-50 whitespace-nowrap"
              >
                {signingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </div>
          ) : (
            <Link href={loginHref} className="inline-flex items-center text-xs font-semibold text-clay-400 whitespace-nowrap">
              카카오 로그인
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
