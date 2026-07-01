"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface MemberInfo {
  id: string;
  nickname: string;
  name: string;
}

/**
 * 전역 회원 로그인 상태 표시 바. app/layout.tsx의 {children} 위에 위치한다.
 *
 * 인증 흐름:
 *   - onAuthStateChange 리스너를 붙여 로그인/로그아웃/탭 전환 시 즉시 반영한다.
 *   - 세션이 있으면 members 테이블에서 연결된 회원 정보를 조회해 닉네임/이름을 표시한다.
 *   - 세션은 있지만 members.auth_user_id 미연결 상태이면 로그인 전과 동일하게
 *     "카카오 로그인" 버튼을 표시한다(연결 전이라 아직 회원이 아닌 것으로 간주).
 *
 * 관리자 인증(lib/admin-auth.ts, cw_admin_session 쿠키)과는 완전히 독립적이다 —
 * 이 컴포넌트는 admin-auth.ts를 참조하지 않고, 관리자 쿠키를 읽거나 쓰지 않는다.
 * 회원 로그아웃(supabase.auth.signOut())은 cw_admin_session 쿠키에 영향을 주지 않는다.
 */
export function MemberAuthBar() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // 초기 세션 확인 중 UI가 깜빡이지 않게 로딩 상태를 따로 관리한다.
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // 현재 세션을 즉시 가져온다(페이지 첫 로드용)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setInitialized(true);
    });

    // 로그인/로그아웃/토큰 갱신 등 모든 Auth 이벤트에 반응한다
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
        if (!session) {
          // 로그아웃 시 회원 정보도 즉시 초기화
          setMember(null);
        }
        setInitialized(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // authUser가 생기면 members 테이블에서 연결된 회원 정보를 조회한다
  useEffect(() => {
    if (!authUser) {
      setMember(null);
      return;
    }

    setLoadingMember(true);
    const supabase = createClient();

    void (async () => {
      try {
        const { data } = await supabase
          .from("members")
          .select("id, nickname, name")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();
        setMember(data ?? null);
      } catch {
        setMember(null);
      } finally {
        setLoadingMember(false);
      }
    })();
  }, [authUser]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    // Supabase Auth 세션만 종료한다 — cw_admin_session 쿠키는 건드리지 않는다.
    await supabase.auth.signOut();
    router.push("/");
  }

  // 초기화 전에는 아무것도 렌더링하지 않아 레이아웃 깜빡임을 방지한다.
  if (!initialized) return null;

  return (
    <div className="border-b border-line-200 bg-line-25">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        {authUser && member ? (
          // 로그인 + 회원 연결 완료
          <>
            <span className="text-sm font-medium text-line-900">
              {member.nickname}
              <span className="ml-1 text-xs font-normal text-line-400">
                ({member.name})
              </span>
            </span>
            <div className="flex items-center gap-3">
              <Link
                href="/mypage"
                className="text-xs font-semibold text-clay-400"
              >
                마이페이지
              </Link>
              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                className="text-xs text-line-400 disabled:opacity-50"
              >
                {signingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </div>
          </>
        ) : (
          // 로그아웃 상태 또는 auth는 됐지만 회원 미연결
          <div className="ml-auto">
            <Link
              href="/login"
              className="text-xs font-semibold text-clay-400"
            >
              카카오 로그인
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
