"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AdminRole } from "@/lib/admin-auth";
import type { PermissionRole } from "@/lib/supabase/database.types";

interface MemberInfo {
  id: string;
  nickname: string;
  name: string;
  permission_role: PermissionRole;
}

const KAKAO_ADMIN_ROLES: PermissionRole[] = ["manager", "admin", "master"];

/**
 * MemberAuthBar v2 — 상단 바 이원화.
 *
 * 좌측: Owner/관리자 영역
 *   - 비인증: "관리자" → /admin 이동
 *   - cw_admin_session 활성: "관리자 모드" (gold) → /admin
 *   - 카카오 permission_role >= manager: "관리자 모드" (gold) → /admin
 *
 * 우측: 카카오 회원 영역 (기존 동일)
 *   - 비로그인: "카카오 로그인" → /login
 *   - 로그인+연결: 닉네임 | 마이페이지 | 로그아웃
 *
 * 보호 파일(lib/admin-auth.ts, middleware.ts) 수정 없음.
 * cw_admin_session(httpOnly)은 /api/auth/status 폴링으로 읽음.
 */
export function MemberAuthBar() {
  const router = useRouter();

  // 우측: 카카오 회원 상태
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 좌측: 관리자 상태
  const [cookieRole, setCookieRole] = useState<AdminRole | null>(null);

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

  // 카카오 회원 정보 조회 (permission_role 포함)
  useEffect(() => {
    if (!authUser) { setMember(null); return; }
    const supabase = createClient();
    void (async () => {
      try {
        const { data } = await supabase
          .from("members")
          .select("id, nickname, name, permission_role")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();
        setMember(data ?? null);
      } catch {
        setMember(null);
      }
    })();
  }, [authUser]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!initialized) return null;

  // 관리자 모드 여부: 쿠키 세션 OR 카카오 permission_role >= manager
  const isKakaoAdmin = member !== null && (KAKAO_ADMIN_ROLES as string[]).includes(member.permission_role);
  const isAdminMode = cookieRole !== null || isKakaoAdmin;

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
                {member.nickname}
                <span className="ml-1 font-normal text-line-400">({member.name})</span>
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
            <Link href="/login" className="inline-flex items-center text-xs font-semibold text-clay-400 whitespace-nowrap">
              카카오 로그인
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
