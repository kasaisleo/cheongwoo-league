import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-auth";
import { isKakaoAdminServer, isKakaoMasterServer } from "@/lib/kakao-admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { FullSignOutButton } from "@/components/admin/FullSignOutButton";

/**
 * /admin page — 서버 컴포넌트.
 *
 * 관리자 로그인 상태 감지:
 *   A. cw_admin_session 쿠키 유효 (기존 owner/manager)
 *   B. 카카오 로그인 + permission_role >= "manager"
 * 둘 중 하나라도 해당하면 대시보드 표시.
 * 아니면 비밀번호 로그인 폼 표시 (기존 동작 유지).
 */
async function getAdminDashboardData() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: totalMembers },
    { count: adminMembers },
    { data: recentMatches },
    { data: todaySessions },
  ] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_dormant", false),
    supabase.from("members").select("*", { count: "exact", head: true }).in("permission_role", ["manager", "admin", "master"]),
    supabase.from("matches").select("played_at, winner_team, score_a, score_b").order("played_at", { ascending: false }).limit(3),
    supabase.from("attendance_sessions").select("id, title, session_day").in("status", ["open", "closed"]).eq("session_date", today),
  ]);

  // 오늘 세션의 출석 집계
  let todayAttending = 0;
  if (todaySessions && todaySessions.length > 0) {
    const sessionIds = todaySessions.map((s) => s.id);
    const { data: att } = await supabase
      .from("attendance")
      .select("status")
      .in("session_id", sessionIds)
      .eq("status", "attending");
    todayAttending = att?.length ?? 0;
  }

  return {
    totalMembers: totalMembers ?? 0,
    adminMembers: adminMembers ?? 0,
    recentMatches: recentMatches ?? [],
    todayAttending,
    hasTodaySession: (todaySessions?.length ?? 0) > 0,
  };
}

export default async function AdminPage() {
  const cookieRole = getAdminRole();
  const kakaoAdmin = await isKakaoAdminServer();
  const kakaoMaster = await isKakaoMasterServer();
  const isAuthenticated = cookieRole !== null || kakaoAdmin;
  // 시스템 설정 접근: owner(쿠키) 또는 master(카카오)
  const isOwnerOrMaster = cookieRole === "owner" || kakaoMaster;

  if (!isAuthenticated) {
    return <AdminLoginForm />;
  }

  const data = await getAdminDashboardData();

  return (
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin Dashboard</p>
          <h1 className="headline-kr text-4xl text-line-900">관리자</h1>
        </div>
        <div className="mt-1 flex flex-col items-end gap-1">
          <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[10px] font-semibold text-line-500">
            {cookieRole === "owner" ? "Owner" : cookieRole === "manager" ? "Manager" : "Admin"}
          </span>
          <FullSignOutButton />
        </div>
      </header>

      {/* ── 운영 현황 카드 ──────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Overview
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
            {/* 오늘 출석 */}
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-gold">
                {data.hasTodaySession ? data.todayAttending : "—"}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                오늘 출석
              </p>
              {!data.hasTodaySession && (
                <p className="text-[10px] text-line-400">오늘 세션 없음</p>
              )}
            </div>

            {/* 최근 경기 */}
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-clay-400">
                {data.recentMatches.length}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                최근 경기
              </p>
              {data.recentMatches[0] && (
                <p className="text-[10px] text-line-400">{data.recentMatches[0].played_at}</p>
              )}
            </div>

            {/* 총 회원 수 */}
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-900">
                {data.totalMembers}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                활동 회원
              </p>
            </div>

            {/* 관리자 수 */}
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-700">
                {data.adminMembers}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                운영진
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 빠른 작업 ───────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/matches/new", label: "경기 입력", sub: "Match Result", accent: "clay" },
            { href: "/members/new", label: "회원 등록", sub: "New Member", accent: "line" },
            { href: "/guests/new", label: "게스트 등록", sub: "New Guest", accent: "line" },
            { href: "/admin/share", label: "공유센터", sub: "Share Links", accent: "gold" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3 transition-colors hover:bg-line-100/40">
                <div className={`absolute left-0 top-0 h-full w-1 ${
                  item.accent === "clay" ? "bg-clay-400/50"
                  : item.accent === "gold" ? "bg-gold/50"
                  : "bg-line-300/40"
                }`} />
                <p className="text-sm font-semibold text-line-900">{item.label}</p>
                <p className="font-display text-[9px] font-bold uppercase tracking-wider text-line-500">
                  {item.sub}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 운영진 기능 ─────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Management
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {[
            ...(isOwnerOrMaster ? [{ href: "/admin/settings", label: "시스템 설정", sub: "Owner 계정 · 권한 관리" }] : []),
            { href: "/admin/attendance", label: "출석 관리", sub: "세션 생성 · 명단 확정" },
            { href: "/members", label: "회원 관리", sub: "선수 명단 · 정보 수정" },
            { href: "/members/import", label: "명단 가져오기", sub: "CSV · XLSX 일괄 등록" },
            { href: "/admin/auth-link", label: "회원 연결", sub: "카카오 로그인 연결 대기자" },
          ].map((item, idx, arr) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-line-100/40 ${
                idx < arr.length - 1 ? "border-b border-line-200/30" : ""
              }`}>
                <div>
                  <p className="text-sm font-semibold text-line-900">{item.label}</p>
                  <p className="text-[10px] text-line-500">{item.sub}</p>
                </div>
                <span className="text-line-400 text-xs">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 회원 서비스 바로가기 ─────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          Member View
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["/", "/ranking", "/matches", "/attendance", "/members"].map((href) => (
            <Link key={href} href={href}>
              <span className="rounded-sm border border-line-200/40 bg-line-50 px-2.5 py-1 text-xs font-semibold text-line-500 transition-colors hover:border-line-300 hover:text-line-700">
                {href === "/" ? "홈" : href.slice(1)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
