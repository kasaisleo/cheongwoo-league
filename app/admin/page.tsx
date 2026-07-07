import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { FullSignOutButton } from "@/components/admin/FullSignOutButton";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * /admin page — 서버 컴포넌트.
 *
 * 인증 상태:
 *   A. cw_admin_session 유효 (owner/manager) → 대시보드
 *   B. 카카오 permission_role >= manager     → 대시보드
 *   C. 둘 다 없음                            → 로그인 화면
 *
 * 버그픽스: 이전에 if(!isAuthenticated) return <AdminLoginForm /> 구조에서
 * 서버 컴포넌트 렌더링 실패 시 빈 화면이 됐음.
 * 수정: 미인증 시 전용 로그인 페이지를 직접 렌더링.
 */
async function getAdminDashboardData() {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: totalMembers },
    { count: adminMembers },
    { data: recentMatches },
    { data: todaySessions },
  ] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_dormant", false).eq("club_id", currentClubId),
    supabase.from("members").select("*", { count: "exact", head: true }).in("permission_role", ["manager", "admin", "master"]).eq("club_id", currentClubId),
    supabase.from("matches").select("played_at, winner_team, score_a, score_b").eq("club_id", currentClubId).order("played_at", { ascending: false }).limit(3),
    supabase.from("attendance_sessions").select("id, title, session_day").eq("club_id", currentClubId).in("status", ["open", "closed"]).eq("session_date", today),
  ]);

  let todayAttending = 0;
  if (todaySessions && todaySessions.length > 0) {
    const sessionIds = todaySessions.map((s) => s.id);
    const { data: att } = await supabase
      .from("attendance").select("status")
      .in("session_id", sessionIds).eq("status", "attending");
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  // 통합 권한 헬퍼 — 단일 진실 공급원
  const access = await getAdminAccessServer();
  const { isAdmin, isOwner, cookieRole } = access;
  const isOwnerOrMaster = isOwner; // 하위 호환 별칭

  // 권한 부족으로 이 페이지에 리다이렉트되어 온 경우의 사유(QA-P1-C-1).
  // 권한 판단 자체에는 영향을 주지 않고, 안내 문구 표시 여부만 결정한다.
  const reason = searchParams?.reason;
  // 아예 로그인하지 않은 사용자에게 "로그인은 확인됐습니다"라고 보이면
  // 안 되므로, 카카오 세션이 실제로 있는 경우(access.userId)에만 안내한다.
  const isLoggedInButLacksAdmin = !isAdmin && access.userId !== null && reason === "admin_required";
  const isLoggedInButLacksOwner = isAdmin && !isOwner && reason === "owner_required";

  // ── 미인증: 로그인 화면 ────────────────────────────
  if (!isAdmin) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en text-clay-400">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-line-900">관리자</h1>
        </header>

        {isLoggedInButLacksAdmin && (
          <section className="mb-5">
            <div className="rounded-[14px] border border-gold/30 bg-gold/10 p-4">
              <p className="text-xs leading-relaxed text-line-700">
                카카오 로그인은 확인됐지만, 이 계정에는 아직 운영진 권한이 없습니다. 클럽 운영진에게 권한 부여를 요청해주세요.
              </p>
            </div>
          </section>
        )}

        {/* 카카오 운영진 로그인 안내 */}
        <section className="mb-5">
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-5">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Kakao Admin
            </p>
            <p className="mt-2 text-sm font-semibold text-line-900">카카오 운영진 로그인</p>
            <p className="mt-0.5 text-xs text-line-500">
              운영진 권한이 부여된 카카오 계정으로 로그인하면 관리자 화면에 접근할 수 있습니다.
            </p>
            <Link
              href="/login?returnUrl=/admin"
              className="mt-4 flex h-11 w-full items-center justify-center rounded-sm bg-[#FEE500] text-sm font-bold text-[#191600]"
            >
              카카오로 로그인하러 가기
            </Link>
          </div>
        </section>

        {/* Owner 비밀번호 로그인 */}
        <section>
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 p-5">
            <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Owner Login
            </p>
            <p className="mt-2 text-sm font-semibold text-line-900">Owner 로그인</p>
            <p className="mt-0.5 text-xs text-line-500">
              초기 설정 또는 비상 복구용 관리자 로그인입니다.
            </p>
            <div className="mt-4">
              <AdminLoginForm />
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── 인증됨: 대시보드 ───────────────────────────────
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

      {isLoggedInButLacksOwner && (
        <section className="mb-6">
          <div className="rounded-[14px] border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs leading-relaxed text-line-700">
              이 메뉴는 Owner 권한이 필요합니다. 필요한 경우 클럽 Owner에게 권한 변경을 요청해주세요.
            </p>
          </div>
        </section>
      )}

      {/* ── 운영 현황 ────────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Overview</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-gold">
                {data.hasTodaySession ? data.todayAttending : "—"}
              </p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">오늘 매치</p>
              {!data.hasTodaySession && <p className="text-[10px] text-line-400">오늘 매치 없음</p>}
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-clay-400">{data.recentMatches.length}</p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">최근 경기 기록</p>
              {data.recentMatches[0] && <p className="text-[10px] text-line-400">{data.recentMatches[0].played_at}</p>}
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-900">{data.totalMembers}</p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">활동 회원</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-700">{data.adminMembers}</p>
              <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">운영진</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 빠른 작업 ───────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/admin/matches/create",          label: "매치 생성",    sub: "New Match",    accent: "clay" },
            { href: "/admin/matches",                 label: "경기 관리",    sub: "Matches",      accent: "clay" },
            { href: "/admin/attendance",              label: "출석 관리",    sub: "Attendance",   accent: "line" },
            { href: "/admin/records",                 label: "기록 대시보드", sub: "Records",     accent: "line" },
            { href: "/admin/members/new?type=member", label: "회원 등록",    sub: "New Member",   accent: "line" },
            { href: "/admin/guests",                  label: "게스트 관리",  sub: "Guest List",   accent: "line" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="relative overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-3 transition-colors hover:bg-line-100/40">
                <div className={`absolute left-0 top-0 h-full w-1 ${
                  item.accent === "clay" ? "bg-clay-400/50" : item.accent === "gold" ? "bg-gold/50" : "bg-line-300/40"
                }`} />
                <p className="text-sm font-semibold text-line-900">{item.label}</p>
                <p className="font-display text-[9px] font-bold uppercase tracking-wider text-line-500">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Management ───────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Management</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {[
            { href: "/admin/records/players",    label: "선수 기록 분석",  sub: "참여도 · 승률 · 출석 체크율" },
            { href: "/admin/records/matches",    label: "경기 검수",       sub: "기록 누락 · 상태 확인" },
            { href: "/admin/records/attendance", label: "출석 체크 검수",  sub: "응답 현황 · 출석 후 미참여" },
            { href: "/admin/auth-link",          label: "회원 연결",       sub: "카카오 로그인 연결 대기자" },
            ...(isOwnerOrMaster ? [{ href: "/admin/settings", label: "시스템 설정", sub: "권한 · 계정 관리" }] : []),
            ...(isOwnerOrMaster ? [{ href: "/members/import", label: "회원 명단 가져오기", sub: "CSV/XLSX 일괄 등록" }] : []),
          ].map((item, idx, arr) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-line-100/40 ${
                idx < arr.length - 1 ? "border-b border-line-200/30" : ""
              }`}>
                <div>
                  <p className="text-sm font-semibold text-line-900">{item.label}</p>
                  <p className="text-[10px] text-line-500">{item.sub}</p>
                </div>
                <span className="text-xs text-line-400">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
