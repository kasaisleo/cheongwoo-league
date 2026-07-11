import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { AdminKakaoLoginButton } from "@/components/admin/AdminKakaoLoginButton";
import { AdminClubSelector } from "@/components/admin/AdminClubSelector";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminQuickAction } from "@/components/admin/AdminQuickAction";
import { AdminActivityList, type AdminActivityItem } from "@/components/admin/AdminActivityList";
import Link from "next/link";
import { PlatformHomeLink } from "@/components/navigation/PlatformHomeLink";

/**
 * /admin page — 서버 컴포넌트.
 *
 * 상태별 렌더:
 *   A. 미인증          → Kakao 운영진 로그인 게이트 (AdminGatewayShell 내부)
 *   B. 권한 0개        → 권한 없음 (AdminGatewayShell 내부)
 *   C. 복수 클럽       → 클럽 선택 (AdminGatewayShell 내부, AdminClubSelector)
 *   D. 클럽 미선택     → 클럽 선택 (AdminGatewayShell 내부, AdminClubSelector)
 *   E. 클럽 선택 완료  → 대시보드 (AdminClubShell 내부)
 *
 * AdminGatewayShell / AdminClubShell 분기는 layout.tsx가 담당.
 * page.tsx는 content만 반환한다.
 *
 * Owner 비밀번호 로그인 완전 제거. 카카오 단일 인증.
 * 클럽 선택은 AdminClubSelector — loading overlay 포함.
 */
function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function getAdminDashboardData(currentClubId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: totalMembers },
    { count: activeMembers },
    { data: adminRoleMembers },
    { count: ongoingSessions },
    { data: recentSessions },
    { data: recentMatches },
    { data: recentMembers },
    { count: newMembersCount },
    { count: unlinkedAdminCount },
    { count: pendingLinkCount },
    { data: clubRow },
    { count: recentGamesCount },
  ] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }).eq("is_active", true).eq("club_id", currentClubId),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_dormant", false).eq("club_id", currentClubId),
    // adminMembers/masterMembers count 2개를 role만 읽는 쿼리 1개로 통합 (row 수가 적어 head count보다 저렴)
    supabase.from("members").select("permission_role").in("permission_role", ["manager", "admin", "master"]).eq("club_id", currentClubId),
    supabase.from("attendance_sessions").select("*", { count: "exact", head: true }).eq("club_id", currentClubId).eq("status", "open"),
    // 오늘 세션(todaySessions)과 출석 변화 scoping용 세션(recentSessionsForAttendance)을
    // 별도 쿼리 2개 대신, 최근 세션 목록 1개로 통합해 양쪽 용도로 파생한다.
    supabase.from("attendance_sessions").select("id, title, session_day, session_date, status").eq("club_id", currentClubId).neq("status", "archived").order("session_date", { ascending: false }).limit(20),
    supabase.from("matches").select("id, played_at, winner_team, score_a, score_b").eq("club_id", currentClubId).order("played_at", { ascending: false }).limit(5),
    supabase.from("members").select("id, name, created_at").eq("club_id", currentClubId).eq("is_active", true).order("created_at", { ascending: false }).limit(5),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("club_id", currentClubId).eq("is_active", true).gte("created_at", daysAgoIso(7)),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("club_id", currentClubId).eq("is_active", true).in("permission_role", ["manager", "admin", "master"]).is("auth_user_id", null),
    supabase.from("pending_link_requests").select("*", { count: "exact", head: true }).eq("club_id", currentClubId),
    supabase.from("clubs").select("status, skin_key").eq("id", currentClubId).maybeSingle(),
    supabase.from("matches").select("*", { count: "exact", head: true }).eq("club_id", currentClubId).gte("played_at", daysAgoIso(7)),
  ]);

  const adminMembers = (adminRoleMembers ?? []).length;
  const masterMembers = (adminRoleMembers ?? []).filter((m) => m.permission_role === "master").length;

  const todaySessionIds = (recentSessions ?? [])
    .filter((s) => s.session_date === today && (s.status === "open" || s.status === "closed"))
    .map((s) => s.id);
  const recentSessionIds = (recentSessions ?? []).slice(0, 15).map((s) => s.id);

  const [
    { data: todayAttendanceRows },
    { count: todayMatchCount },
    { data: recentAttendanceRows },
  ] = await Promise.all([
    todaySessionIds.length > 0
      ? supabase.from("attendance").select("status").in("session_id", todaySessionIds).eq("status", "attending")
      : Promise.resolve({ data: [] as { status: string }[] }),
    todaySessionIds.length > 0
      ? supabase.from("matches").select("*", { count: "exact", head: true }).in("session_id", todaySessionIds)
      : Promise.resolve({ count: 0 }),
    recentSessionIds.length > 0
      ? supabase.from("attendance").select("member_id, status, session_id, updated_at").in("session_id", recentSessionIds).order("updated_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as { member_id: string; status: string; session_id: string; updated_at: string }[] }),
  ]);

  // pending_link_requests count는 이미 연결 완료된 계정을 포함할 수 있어 (연결 후 row 정리 실패 케이스) 0건이 아닐 때만 정밀 대조
  let pendingLinkActualCount = pendingLinkCount ?? 0;
  const attendanceMemberIds = [...new Set((recentAttendanceRows ?? []).map((r) => r.member_id))];

  const [{ data: pendingRows }, { data: linkedMembers }, { data: attendanceMembers }] = await Promise.all([
    pendingLinkActualCount > 0
      ? supabase.from("pending_link_requests").select("auth_user_id").eq("club_id", currentClubId).limit(50)
      : Promise.resolve({ data: [] as { auth_user_id: string }[] }),
    pendingLinkActualCount > 0
      ? supabase.from("members").select("auth_user_id").not("auth_user_id", "is", null).eq("club_id", currentClubId)
      : Promise.resolve({ data: [] as { auth_user_id: string | null }[] }),
    attendanceMemberIds.length > 0
      ? supabase.from("members").select("id, name").in("id", attendanceMemberIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  if (pendingLinkActualCount > 0) {
    const linkedIds = new Set((linkedMembers ?? []).map((m) => m.auth_user_id));
    pendingLinkActualCount = (pendingRows ?? []).filter((r) => !linkedIds.has(r.auth_user_id)).length;
  }
  const attendanceMemberNameMap = new Map((attendanceMembers ?? []).map((m) => [m.id, m.name]));

  return {
    totalMembers: totalMembers ?? 0,
    activeMembers: activeMembers ?? 0,
    adminMembers: adminMembers ?? 0,
    hasOwner: (masterMembers ?? 0) > 0,
    ongoingSessions: ongoingSessions ?? 0,
    hasTodaySession: todaySessionIds.length > 0,
    todayAttending: (todayAttendanceRows ?? []).length,
    todayMatchCount: todayMatchCount ?? 0,
    recentMatches: recentMatches ?? [],
    recentMembers: recentMembers ?? [],
    newMembersCount: newMembersCount ?? 0,
    unlinkedAdminCount: unlinkedAdminCount ?? 0,
    pendingLinkCount: pendingLinkActualCount,
    recentAttendanceChanges: (recentAttendanceRows ?? []).map((r) => ({
      memberName: attendanceMemberNameMap.get(r.member_id) ?? "알 수 없음",
      status: r.status,
      updatedAt: r.updated_at,
    })),
    hasMatchRecords: (recentMatches ?? []).length > 0,
    clubStatus: clubRow?.status ?? null,
    clubSkinCustomized: (clubRow?.skin_key ?? "default") !== "default",
    recentGamesCount: recentGamesCount ?? 0,
  };
}

const gatewayCard = "overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { reason?: string; no_access_club?: string; no_access?: string; error?: string };
}) {
  const access = await getAdminAccessServer();
  const { isAdmin, isOwner } = access;

  const reason = searchParams?.reason;
  const noAccessClub = searchParams?.no_access_club ?? null;
  const noAccess = searchParams?.no_access === "1";
  const oauthError = searchParams?.error ?? null;

  const isLoggedInButLacksOwner = isAdmin && !isOwner && reason === "owner_required";

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
            <AdminClubSelector clubs={access.adminClubs} />
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

  // ── B. 운영진 권한 0개 ──────────────────────────────
  if (noAccess || (!isAdmin && access.userId !== null && access.adminClubs.length === 0)) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">권한 없음</h1>
        </header>
        <section className="mb-5">
          <div className={`${gatewayCard} p-4`}>
            <p className="text-sm font-semibold text-white/80 mb-1">운영진 권한이 없습니다.</p>
            <p className="text-xs text-white/40">
              카카오 계정에 연결된 운영진 멤버십이 없습니다.<br />
              클럽 운영진에게 권한 부여를 요청해주세요.
            </p>
          </div>
        </section>
        <section>
          <div className={`${gatewayCard} flex items-center justify-center p-4`}>
            <AdminLogoutButton label="로그아웃 후 다른 계정으로 시도" />
          </div>
        </section>
      </main>
    );
  }

  // ── C. 인증됨 + 복수 클럽 선택 ─────────────────────
  if (!isAdmin && access.userId !== null && access.adminClubs.length > 1) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">클럽 선택</h1>
          <p className="mt-2 text-sm text-white/40">관리할 클럽을 선택해주세요.</p>
        </header>
        <section className="mb-5">
          <AdminClubSelector clubs={access.adminClubs} />
        </section>
        <section>
          <div className={`${gatewayCard} flex items-center justify-center p-4`}>
            <AdminLogoutButton label="로그아웃" />
          </div>
        </section>
      </main>
    );
  }

  // ── A. 미인증: 카카오 운영진 로그인 ────────────────────
  if (!isAdmin) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Club Admin</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">운영진 로그인</h1>
          <p className="mt-2 text-sm text-white/40">
            운영진 권한이 부여된 카카오 계정으로 로그인하세요.
          </p>
        </header>

        {oauthError && (
          <section className="mb-5">
            <div className={`${gatewayCard} p-4`}>
              <p className="text-xs text-white/50">
                로그인 중 오류가 발생했습니다. 다시 시도해주세요.
              </p>
            </div>
          </section>
        )}

        <section className="mb-5">
          <div className={`${gatewayCard} p-5`}>
            <p className="eyebrow-en text-xs font-bold uppercase tracking-widest text-white/35">Kakao Admin Login</p>
            <p className="mt-2 text-sm font-semibold text-white/80">카카오 운영진 로그인</p>
            <p className="mt-0.5 text-xs text-white/40">
              운영진으로 등록된 카카오 계정에만 접근 권한이 부여됩니다.
            </p>
            <div className="mt-4">
              <AdminKakaoLoginButton />
            </div>
          </div>
        </section>

        <section>
          <div className={`${gatewayCard} p-4 text-center`}>
            <PlatformHomeLink className="text-xs text-white/30 hover:text-white/50 transition-colors">
              플랫폼 홈으로 돌아가기
            </PlatformHomeLink>
          </div>
        </section>
      </main>
    );
  }

  // ── D. 인증됨 + 클럽 미선택 ──────────────────────────
  if (isAdmin && !access.clubId) {
    return (
      <main className="px-4 pt-10 pb-10">
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-xs font-bold uppercase tracking-widest text-white/35">Admin Access</p>
          <h1 className="headline-kr mt-1 text-4xl text-white">클럽 선택</h1>
        </header>
        {access.adminClubs.length > 0 ? (
          <section className="mb-5">
            <p className="mb-3 text-center text-sm text-white/40">관리할 클럽을 선택해주세요.</p>
            <AdminClubSelector clubs={access.adminClubs} />
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

  // ── Today / Attention ────────────────────────────────
  const attentionItems: AdminActivityItem[] = [];
  if (data.hasTodaySession) {
    attentionItems.push({
      id: "today-attend",
      title: "오늘 출석",
      meta: "출석 응답 현황",
      trailing: `${data.todayAttending}명`,
      href: "/admin/attendance",
    });
    attentionItems.push({
      id: "today-match",
      title: "오늘 경기",
      meta: "오늘 세션에 기록된 경기",
      trailing: `${data.todayMatchCount}경기`,
      href: "/admin/matches",
    });
  }
  if (data.pendingLinkCount > 0) {
    attentionItems.push({
      id: "pending-link",
      title: "카카오 연결 대기",
      meta: "로그인은 했지만 회원 연결이 안 된 계정",
      trailing: `${data.pendingLinkCount}명`,
      href: "/admin/auth-link",
      tone: "alert",
    });
  }
  if (data.unlinkedAdminCount > 0) {
    attentionItems.push({
      id: "unlinked-admin",
      title: "운영진 카카오 미연결",
      meta: "권한은 있지만 카카오 로그인 연결이 안 된 운영진",
      trailing: `${data.unlinkedAdminCount}명`,
      href: "/admin/settings",
      tone: "alert",
    });
  }
  if (data.newMembersCount > 0) {
    attentionItems.push({
      id: "new-members",
      title: "신규 회원 (최근 7일)",
      meta: "최근 등록된 회원",
      trailing: `${data.newMembersCount}명`,
      tone: "achievement",
    });
  }

  // ── Recent Activity ──────────────────────────────────
  const recentMatchItems: AdminActivityItem[] = data.recentMatches.slice(0, 4).map((m) => ({
    id: m.id,
    title: `${m.winner_team}팀 승리`,
    meta: m.played_at,
    trailing: `${m.score_a}:${m.score_b}`,
  }));

  const recentMemberItems: AdminActivityItem[] = data.recentMembers.slice(0, 4).map((m) => ({
    id: m.id,
    title: m.name,
    meta: `가입 · ${m.created_at.slice(0, 10)}`,
  }));

  const attendanceStatusLabel: Record<string, string> = { attending: "출석", absent: "불참", undecided: "미정" };
  const recentAttendanceItems: AdminActivityItem[] = data.recentAttendanceChanges.slice(0, 4).map((a, idx) => ({
    id: `${a.memberName}-${idx}`,
    title: a.memberName,
    meta: a.updatedAt.slice(0, 10),
    trailing: attendanceStatusLabel[a.status] ?? a.status,
  }));

  // ── Club Status ───────────────────────────────────────
  const clubStatusItems: AdminActivityItem[] = [
    {
      id: "club-status",
      title: "클럽 운영 상태",
      trailing: data.clubStatus === "active" ? "운영중" : (data.clubStatus ?? "확인 필요"),
      tone: data.clubStatus === "active" ? "achievement" : "alert",
    },
    {
      id: "owner-status",
      title: "관리자 권한 상태",
      trailing: data.hasOwner ? "Owner 등록됨" : "Owner 없음",
      href: "/admin/settings",
      tone: data.hasOwner ? "default" : "alert",
    },
    {
      id: "skin-status",
      title: "스킨 설정",
      trailing: data.clubSkinCustomized ? "커스터마이즈됨" : "기본 스킨",
    },
    {
      id: "records-status",
      title: "랭킹/기록 활성 상태",
      trailing: data.hasMatchRecords ? "기록 있음" : "기록 없음",
      href: "/admin/records",
      tone: data.hasMatchRecords ? "achievement" : "default",
    },
  ];

  return (
    <main className="px-4 pt-6 pb-10">
      <header className="mb-5">
        <p className="eyebrow-en" style={{ color: "var(--admin-muted)", fontSize: "9px" }}>Admin</p>
        <h1 className="headline-kr text-4xl" style={{ color: "var(--admin-text)" }}>관리자</h1>
      </header>

      {isLoggedInButLacksOwner && (
        <section className="mb-5">
          <div className="rounded-[14px] p-4" style={{
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.35)",
          }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--admin-text)" }}>
              이 메뉴는 Owner 권한이 필요합니다. 필요한 경우 클럽 Owner에게 권한 변경을 요청해주세요.
            </p>
          </div>
        </section>
      )}

      {/* ── A. 오늘 / 확인 필요 ──────────────────────────────── */}
      <section className="mb-5">
        <AdminSectionHeader title="오늘 · 확인 필요" />
        <AdminActivityList items={attentionItems} emptyLabel="오늘 처리할 항목이 없어요." />
      </section>

      {/* ── B. 주요 지표 ─────────────────────────────────────── */}
      <section className="mb-5">
        <AdminSectionHeader title="주요 지표" />
        <div className="grid grid-cols-2 gap-2">
          <AdminMetricCard label="전체 회원" value={data.totalMembers} variant="default" href="/admin/records/players" />
          <AdminMetricCard label="활성 회원" value={data.activeMembers} sub="휴면 제외" variant="emphasized" />
          <AdminMetricCard
            label="진행 중 경기"
            value={data.ongoingSessions}
            variant={data.ongoingSessions > 0 ? "actionable" : "default"}
            href="/admin/attendance"
          />
          <AdminMetricCard
            label="최근 7일 경기"
            value={data.recentGamesCount}
            variant={data.recentGamesCount > 0 ? "achievement" : "default"}
            href="/admin/records"
          />
        </div>
      </section>

      {/* ── C. 빠른 실행 ─────────────────────────────────────── */}
      <section className="mb-5">
        <AdminSectionHeader title="빠른 실행" />
        <div className="grid grid-cols-2 gap-2">
          <AdminQuickAction href="/admin/members/new?type=member" label="회원 등록" variant="actionable" />
          <AdminQuickAction href="/admin/matches/create" label="경기 생성" variant="actionable" />
          <AdminQuickAction href="/admin/attendance" label="출석 관리" variant="emphasized" />
          {isOwner && <AdminQuickAction href="/members/import" label="회원명단 가져오기" variant="emphasized" />}
          <AdminQuickAction href="/admin/matches" label="경기 관리" variant="default" />
          <AdminQuickAction href="/admin/records" label="기록 대시보드" variant="default" />
          <AdminQuickAction href="/admin/guests" label="게스트 관리" variant="default" />
          <AdminQuickAction href="/admin/auth-link" label="회원 연결" variant="default" />
        </div>
      </section>

      {/* ── D. 최근 활동 ─────────────────────────────────────── */}
      <section className="mb-5">
        <AdminSectionHeader title="최근 경기" />
        <AdminActivityList items={recentMatchItems} emptyLabel="아직 기록된 경기가 없어요." />
      </section>
      <section className="mb-5">
        <AdminSectionHeader title="최근 회원 등록" />
        <AdminActivityList items={recentMemberItems} emptyLabel="최근 등록된 회원이 없어요." />
      </section>
      <section className="mb-5">
        <AdminSectionHeader title="최근 출석 변화" />
        <AdminActivityList items={recentAttendanceItems} emptyLabel="최근 출석 변화가 없어요." />
      </section>

      {/* ── E. 클럽 상태 ─────────────────────────────────────── */}
      <section className="mb-6">
        <AdminSectionHeader title="클럽 상태" />
        <AdminActivityList items={clubStatusItems} emptyLabel="확인할 상태가 없어요." />
      </section>

      {/* ── 관리 서브페이지 ──────────────────────────────────── */}
      <section className="mb-6">
        <AdminSectionHeader title="관리" />
        <div
          className="overflow-hidden rounded-[var(--admin-card-radius,14px)]"
          style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}
        >
          {[
            { href: "/admin/records/players",    label: "선수 기록 분석",     sub: "참여도 · 승률 · 출석 체크율" },
            { href: "/admin/records/matches",    label: "경기 검수",           sub: "기록 누락 · 상태 확인" },
            { href: "/admin/records/attendance", label: "출석 체크 검수",      sub: "응답 현황 · 출석 후 미참여" },
            { href: "/admin/auth-link",          label: "회원 연결",           sub: "카카오 로그인 연결 대기자" },
            ...(isOwner ? [{ href: "/admin/settings",  label: "시스템 설정",        sub: "권한 · 계정 관리" }] : []),
            ...(isOwner ? [{ href: "/members/import",  label: "회원 명단 가져오기", sub: "CSV/XLSX 일괄 등록" }] : []),
          ].map((item, idx, arr) => (
            <Link key={item.href} href={item.href}>
              <div
                className="flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-80"
                style={idx < arr.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{item.sub}</p>
                </div>
                <span className="text-xs" style={{ color: "var(--admin-muted)" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
