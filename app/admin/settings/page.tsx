"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

/**
 * /admin/settings — Owner 전용 시스템 설정.
 *
 * 접근 권한: owner(cw_admin_session) 또는 master(permission_role)
 * 이번 구현:
 *   - 현재 권한 상태 표시
 *   - Owner 카카오 계정 연결 (permission_role → master)
 *   - 향후 확장 placeholder
 */

interface AuthState {
  cookieRole: "owner" | "manager" | null;
  kakaoPermission: string | null;
  kakaoName: string | null;
  memberId: string | null;
  loading: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({
    cookieRole: null, kakaoPermission: null, kakaoName: null, memberId: null, loading: true,
  });
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ success?: string; error?: string } | null>(null);

  useEffect(() => {
    async function loadAuthState() {
      // 1. 쿠키 세션 역할 확인
      const statusRes = await fetch("/api/auth/status");
      const statusData = await statusRes.json();

      // 2. 카카오 세션 + permission_role 확인
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      let kakaoPermission: string | null = null;
      let kakaoName: string | null = null;
      let memberId: string | null = null;

      if (session) {
        const { data: member } = await supabase
          .from("members")
          .select("id, name, permission_role")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        kakaoPermission = member?.permission_role ?? null;
        kakaoName = member?.name ?? null;
        memberId = member?.id ?? null;
      }

      const cookieRole = statusData?.role ?? null;
      const isOwner = cookieRole === "owner";
      const isMaster = kakaoPermission === "master";

      // 접근 권한 없으면 /admin 으로
      if (!isOwner && !isMaster) {
        router.replace("/admin");
        return;
      }

      setAuth({ cookieRole, kakaoPermission, kakaoName, memberId, loading: false });
    }
    loadAuthState();
  }, [router]);

  async function handlePromoteOwner() {
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await fetch("/api/admin/promote-owner", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setPromoteResult({ error: body.error });
        return;
      }
      if (body.alreadyMaster) {
        setPromoteResult({ success: body.message });
        return;
      }
      setPromoteResult({ success: body.message });
      toast.success(body.message);
      // 상태 갱신
      setAuth((prev) => ({ ...prev, kakaoPermission: "master" }));
    } catch {
      setPromoteResult({ error: "요청 중 오류가 발생했습니다." });
    } finally {
      setPromoting(false);
    }
  }

  if (auth.loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-line-500">확인 중...</p>
      </main>
    );
  }

  const isCookieOwner = auth.cookieRole === "owner";
  const isKakaoMaster = auth.kakaoPermission === "master";
  const canPromote = isCookieOwner && auth.kakaoName !== null && !isKakaoMaster;

  return (
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Settings</p>
          <h1 className="headline-kr text-4xl text-line-900">시스템 설정</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      {/* ── 현재 권한 상태 ───────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Current Status
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {/* Owner Session */}
          <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-line-900">Owner Session</p>
              <p className="text-[10px] text-line-500">cw_admin_session 쿠키 기반</p>
            </div>
            <span className={`rounded-sm border px-2.5 py-1 text-xs font-semibold ${
              isCookieOwner
                ? "border-gold/40 bg-gold/10 text-gold"
                : auth.cookieRole === "manager"
                ? "border-clay-400/40 bg-clay-400/10 text-clay-400"
                : "border-line-200/40 bg-line-100 text-line-500"
            }`}>
              {isCookieOwner ? "Owner" : auth.cookieRole === "manager" ? "Manager" : "없음"}
            </span>
          </div>

          {/* Kakao Account */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-line-900">Kakao Account</p>
              <p className="text-[10px] text-line-500">
                {auth.kakaoName ? auth.kakaoName : "로그인 없음"}
              </p>
            </div>
            <span className={`rounded-sm border px-2.5 py-1 text-xs font-semibold ${
              isKakaoMaster
                ? "border-gold/40 bg-gold/10 text-gold"
                : auth.kakaoPermission
                ? "border-line-200/40 bg-line-100 text-line-600"
                : "border-line-200/40 bg-line-50 text-line-500"
            }`}>
              {isKakaoMaster ? "master" : auth.kakaoPermission ?? "없음"}
            </span>
          </div>
        </div>
      </section>

      {/* ── Owner 카카오 계정 연결 ───────────────────── */}
      {isCookieOwner && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Owner Account
          </p>
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-line-900">Owner 카카오 계정 연결</p>
              <p className="mt-0.5 text-xs text-line-500">
                현재 로그인한 카카오 계정을 Owner(master) 권한으로 연결합니다.
                연결 후에는 카카오 로그인만으로 Owner 기능을 사용할 수 있습니다.
              </p>

              {/* 상태별 안내 */}
              {!auth.kakaoName && (
                <div className="mt-3 rounded-sm border border-line-200/40 bg-line-100 px-3 py-2">
                  <p className="text-xs text-line-500">
                    카카오 로그인 세션이 없습니다.
                    <Link href="/login?returnUrl=/admin/settings" className="ml-1 text-clay-400">
                      카카오 로그인 →
                    </Link>
                  </p>
                </div>
              )}

              {auth.kakaoName && isKakaoMaster && (
                <div className="mt-3 rounded-sm border border-gold/30 bg-gold/5 px-3 py-2">
                  <p className="text-xs font-semibold text-gold">
                    ✓ {auth.kakaoName} 계정이 이미 Owner 권한으로 연결되어 있습니다.
                  </p>
                </div>
              )}

              {canPromote && (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={promoting}
                    onClick={handlePromoteOwner}
                    className="w-full rounded-sm bg-clay-400 py-2.5 text-sm font-bold text-line-25 transition-opacity disabled:opacity-40"
                  >
                    {promoting ? "처리 중..." : `${auth.kakaoName} → Owner 권한 연결하기`}
                  </button>
                </div>
              )}

              {/* 결과 메시지 */}
              {promoteResult?.success && (
                <p className="mt-2 text-xs font-semibold text-gold">{promoteResult.success}</p>
              )}
              {promoteResult?.error && (
                <p className="mt-2 text-xs text-fault-400">{promoteResult.error}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 향후 확장 Placeholder ─────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Coming Soon
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {[
            { label: "운영진 권한 지정", sub: "Admin · Manager 권한 부여" },
            { label: "운영진 권한 해제", sub: "권한 회수 및 일반 회원 전환" },
            { label: "관리자 목록 조회", sub: "현재 권한을 가진 회원 목록" },
            { label: "공유 정책 설정", sub: "공유 링크 및 접근 정책 관리" },
            { label: "클럽 기본 설정", sub: "클럽명 · 시즌 · 기본 정보" },
          ].map((item, idx, arr) => (
            <div key={item.label}
              className={`flex items-center justify-between px-4 py-3 ${
                idx < arr.length - 1 ? "border-b border-line-200/30" : ""
              }`}>
              <div>
                <p className="text-sm font-semibold text-line-500">{item.label}</p>
                <p className="text-[10px] text-line-400">{item.sub}</p>
              </div>
              <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[9px] font-semibold text-line-500">
                예정
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
