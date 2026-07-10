import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { getManagerAllowedSlugs } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import Link from "next/link";

/**
 * /admin page — 서버 컴포넌트.
 *
 * 상태별 렌더:
 *   A. 미인증          → 로그인 게이트 (AdminGatewayShell 내부)
 *   B. 권한 0개        → 권한 없음 (AdminGatewayShell 내부)
 *   C. Kakao 멀티클럽  → 클럽 선택 (AdminGatewayShell 내부)
 *   D. 클럽 미선택     → Owner/Manager 클럽 선택 (AdminGatewayShell 내부)
 *   E. 클럽 선택 완료  → 대시보드 (AdminClubShell 내부)
 *
 * AdminGatewayShell / AdminClubShell 분기는 layout.tsx가 담당.
 * page.tsx는 content만 반환한다.
 *
 * ⚠ 클럽 선택 링크는 <Link> 대신 <a> 사용 (Next.js prefetch가 API route를 오염시킴).
 */
async function getAdminDashboardData(currentClubId: string) {
  const supabase = createClient();
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

/** 게이트웨이 화면 공통 카드 스타일 */
const gatewayCard = "overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]";
const gatewayRow  = "flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { reason?: string; no_access_club?: string };
}) {
  const access = await getAdminAccessServer();
  const { isAdmin, isOwner } = access;
  const isOwnerOrMaster = isOwner;

  const reason = searchParams?.reason;
  const noAccessClub = searchParams?.no_access_club ?? null;

  const isLoggedInButLacksAdmin = !isAdmin && access.userId !== null;
  const isLoggedInButLacksOwner = isAdmin && !isOwner && reason === "owner_required";

  if (!isAdmin && !noAccessClub && access.userId !== null && access.adminClubs.length === 1) {
    redirect(`/api/admin/enter?club=${access.adminClubs[0].slug}`);
  }

  // ── A. 특정 클럽 권한 없음 ──────────────────────────
  if (noAccessClub) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">권한 없음</h1>
        </header>
        <section className="mb-5">
          <div className={`${gatewayCard} p-4`}>
            <p className="text-sm font-semibold text-white/80 mb-1">
              <span className="font-bold text-white/60">{noAccessClub}</span> 클럽에 대한 운영진 권한이 없습니다.
            </p>
            <p className="text-xs text-white/40">
              클럽 운영진에게 권한 부여를 요청하거나, 다른 클럽을 선택해주세요.
            </p>
          </div>
        </section>
        {access.adminClubs.length > 0 && (
          <section className="mb-5">
            <p className="eyebrow-en mb-2 text-xs font-bold uppercase tracking-widest text-white/35">관리 가능한 클럽</p>
            <div className={gatewayCard}>
              {access.adminClubs.map((club, idx) => (
                <a
                  key={club.id}
                  href={`/api/admin/enter?club=${encodeURIComponent(club.slug)}`}
                  className={`${gatewayRow}${idx < access.adminClubs.length - 1 ? " border-b border-white/[0.06]" : ""}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-white/80">{club.name}</p>
                    <p className="eyebrow-en text-[10px] text-white/35">{club.role}</p>
                  </div>
                  <span className="text-sm text-white/30">›</span>
                </a>
              ))}
            </div>
          </section>
        )}
        {access.adminClubs.length === 0 && (
          <section>
            <a href="/login" className={`${gatewayCard} block p-4 text-center`}>
              <p className="text-sm text-white/50">다른 계정으로 로그인하기 →</p>
            </a>
          </section>
        )}
      </main>
    );
  }

  // ── B/C. Kakao 로그인됨 + 멀티클럽 선택 화면 ────────
  if (!isAdmin && access.userId !== null && access.adminClubs.length > 1) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">클럽 선택</h1>
          <p className="mt-2 text-sm text-white/40">관리할 클럽을 선택해주세요.</p>
        </header>
        <section className="mb-5">
          <div className={gatewayCard}>
            {access.adminClubs.map((club, idx) => (
              <a
                key={club.id}
                href={`/api/admin/enter?club=${encodeURIComponent(club.slug)}`}
                className={`${gatewayRow}${idx < access.adminClubs.length - 1 ? " border-b border-white/[0.06]" : ""}`}
              >
                <div>
                  <p className="text-sm font-semibold text-white/80">{club.name}</p>
                  <p className="eyebrow-en text-[10px] text-white/35">{club.role}</p>
                </div>
                <span className="text-sm text-white/30">›</span>
              </a>
            ))}
          </div>
        </section>
        <section>
          <div className={`${gatewayCard} flex items-center justify-center p-4`}>
            <AdminLogoutButton label="로그아웃" />
          </div>
        </section>
      </main>
    );
  }

  // ── A. 미인증: 로그인 화면 ────────────────────────────
  if (!isAdmin) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">관리자</h1>
        </header>

        {isLoggedInButLacksAdmin && (
          <section className="mb-5">
            <div className={`${gatewayCard} p-4`}>
              <p className="text-xs leading-relaxed text-white/60">
                카카오 로그인은 확인됐지만, 이 계정에는 아직 운영진 권한이 없습니다. 클럽 운영진에게 권한 부여를 요청해주세요.
              </p>
            </div>
          </section>
        )}

        <section className="mb-5">
          <div className={`${gatewayCard} p-5`}>
            <p className="eyebrow-en text-xs font-bold uppercase tracking-widest text-white/35">Kakao Admin</p>
            <p className="mt-2 text-sm font-semibold text-white/80">카카오 운영진 로그인</p>
            <p className="mt-0.5 text-xs text-white/40">
              운영진 권한이 부여된 카카오 계정으로 로그인하면 관리자 화면에 접근할 수 있습니다.
            </p>
            <a
              href="/login?returnUrl=/admin"
              className="mt-4 flex h-11 w-full items-center justify-center rounded-sm bg-[#FEE500] text-sm font-bold text-[#191600]"
            >
              카카오로 로그인하러 가기
            </a>
          </div>
        </section>

        <section>
          <div className={`${gatewayCard} p-5`}>
            <p className="eyebrow-en text-xs font-bold uppercase tracking-widest text-white/35">Owner Login</p>
            <p className="mt-2 text-sm font-semibold text-white/80">Owner 로그인</p>
            <p className="mt-0.5 text-xs text-white/40">
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

  // ── D. 인증됨 + 클럽 미선택 (Owner/Manager) ─────────
  if (isAdmin && !access.clubId) {
    let allClubs: Array<{ id: string; slug: string; name: string }> = [];
    let managerConfigError = false;
    const supabase = createClient();

    if (access.cookieRole === "owner") {
      const { data } = await supabase
        .from("clubs")
        .select("id, slug, name")
        .eq("status", "active")
        .order("name");
      allClubs = data ?? [];
    } else if (access.cookieRole === "manager") {
      const allowedSlugs = getManagerAllowedSlugs();
      if (allowedSlugs.length === 0) {
        console.error("[admin] Manager session active but MANAGER_CLUB_SLUGS is not configured or empty.");
        managerConfigError = true;
      } else {
        const { data } = await supabase
          .from("clubs")
          .select("id, slug, name")
          .in("slug", allowedSlugs)
          .eq("status", "active")
          .order("name");
        allClubs = data ?? [];
      }
    }

    if (allClubs.length === 1) {
      redirect(`/api/admin/enter?club=${allClubs[0].slug}`);
    }

    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">클럽 선택</h1>
        </header>
        {managerConfigError ? (
          <section className="mb-5">
            <div className={`${gatewayCard} p-4`}>
              <p className="text-sm font-semibold text-white/80 mb-1">설정 오류</p>
              <p className="text-xs text-white/50">
                Manager 계정에 허용된 클럽이 설정되지 않았습니다.
              </p>
              <p className="mt-1 text-xs text-white/35">
                서버 관리자에게 MANAGER_CLUB_SLUGS 환경변수 설정을 요청하세요.
              </p>
            </div>
          </section>
        ) : allClubs.length > 0 ? (
          <section className="mb-5">
            <p className="mb-3 text-center text-sm text-white/40">관리할 클럽을 선택해주세요.</p>
            <div className={gatewayCard}>
              {allClubs.map((club, idx) => (
                <a
                  key={club.id}
                  href={`/api/admin/enter?club=${encodeURIComponent(club.slug)}`}
                  className={`${gatewayRow}${idx < allClubs.length - 1 ? " border-b border-white/[0.06]" : ""}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-white/80">{club.name}</p>
                    <p className="eyebrow-en text-[10px] text-white/35">{club.slug}</p>
                  </div>
                  <span className="text-sm text-white/30">›</span>
                </a>
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-5">
            <div className={`${gatewayCard} p-4`}>
              <p className="text-sm font-semibold text-white/80 mb-1">관리할 클럽이 없습니다.</p>
              <p className="text-xs text-white/40">
                클럽 공개 페이지 상단의 관리자 링크를 통해 진입해야 합니다.
              </p>
            </div>
          </section>
        )}
        <section>
          <div className={`${gatewayCard} flex items-center justify-center p-4`}>
            <AdminLogoutButton label="로그아웃 후 다시 시작" />
          </div>
        </section>
      </main>
    );
  }

  // ── E. 인증됨 + 클럽 선택 완료: 대시보드 ──────────────
  const data = await getAdminDashboardData(access.clubId ?? "");

  return (
    <main className="px-4 pt-6 pb-10">
      <header className="mb-6">
        <p className="eyebrow-en text-clay-400">Admin Dashboard</p>
        <h1 className="headline-kr text-4xl text-line-900">관리자</h1>
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

      <section className="mb-6">
        <p className="eyebrow-en mb-2 text-line-500">Overview</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-200/30">
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-gold">
                {data.hasTodaySession ? data.todayAttending : "—"}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-line-500">오늘 매치</p>
              {!data.hasTodaySession && <p className="text-[10px] text-line-400">오늘 매치 없음</p>}
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-clay-400">{data.recentMatches.length}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-line-500">최근 경기 기록</p>
              {data.recentMatches[0] && <p className="text-[10px] text-line-400">{data.recentMatches[0].played_at}</p>}
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-900">{data.totalMembers}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-line-500">활동 회원</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-score text-3xl font-bold tabular-nums text-line-700">{data.adminMembers}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-line-500">운영진</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <p className="eyebrow-en mb-2 text-line-500">Quick Actions</p>
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
                  item.accent === "clay" ? "bg-clay-400/50" : "bg-line-300/40"
                }`} />
                <p className="text-sm font-semibold text-line-900">{item.label}</p>
                <p className="eyebrow-en text-[9px] text-line-500">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <p className="eyebrow-en mb-2 text-line-500">Management</p>
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
