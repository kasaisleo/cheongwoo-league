import type React from "react";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { AdminKakaoLoginButton } from "@/components/admin/AdminKakaoLoginButton";
import { AdminClubSelector } from "@/components/admin/AdminClubSelector";
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

  // 카드 공통 스타일 (CSS 변수 기반 — skin 자동 적용)
  const cardSurface: React.CSSProperties = {
    background: "var(--admin-surface)",
    border: "1px solid var(--admin-border)",
  };
  const cardDivider: React.CSSProperties = {
    borderColor: "var(--admin-border)",
  };

  const quickActions = [
    { href: "/admin/matches/create",          label: "매치 생성",     variant: "primary"    },
    { href: "/admin/matches",                 label: "경기 관리",     variant: "emphasized" },
    { href: "/admin/attendance",              label: "출석 관리",     variant: "emphasized" },
    { href: "/admin/records",                 label: "기록 대시보드", variant: "standard"   },
    { href: "/admin/members/new?type=member", label: "회원 등록",     variant: "standard"   },
    { href: "/admin/guests",                  label: "게스트 관리",   variant: "standard"   },
  ] as const;

  function actionCardStyle(variant: "primary" | "emphasized" | "standard"): React.CSSProperties {
    if (variant === "primary") {
      return {
        background: "var(--admin-accent-soft, rgba(212,255,61,0.08))",
        border: "1px solid var(--admin-accent)",
      };
    }
    if (variant === "emphasized") {
      return {
        background: "var(--admin-surface)",
        border: "1px solid var(--admin-border)",
        borderLeftWidth: "3px",
        borderLeftColor: "var(--admin-accent)",
      };
    }
    return {
      background: "var(--admin-surface)",
      border: "1px solid var(--admin-border)",
    };
  }

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

      {/* ── 현황 ─────────────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>현황</p>
        <div
          className="overflow-hidden rounded-[var(--admin-card-radius,14px)]"
          style={cardSurface}
        >
          <div className="grid grid-cols-2">
            {/* 오늘 매치 */}
            <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--admin-border)", borderRight: "1px solid var(--admin-border)" }}>
              <p className="font-score text-3xl font-bold tabular-nums" style={{ color: "var(--admin-achievement, #c9a84c)" }}>
                {data.hasTodaySession ? data.todayAttending : "—"}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>오늘 출석</p>
              {!data.hasTodaySession && (
                <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>세션 없음</p>
              )}
            </div>
            {/* 최근 경기 */}
            <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--admin-border)" }}>
              <p className="font-score text-3xl font-bold tabular-nums" style={{ color: "var(--admin-accent)" }}>
                {data.recentMatches.length}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>최근 경기</p>
              {data.recentMatches[0] && (
                <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>{data.recentMatches[0].played_at}</p>
              )}
            </div>
            {/* 활동 회원 */}
            <div className="px-4 py-3.5" style={{ borderRight: "1px solid var(--admin-border)" }}>
              <p className="font-score text-3xl font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>
                {data.totalMembers}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>활동 회원</p>
            </div>
            {/* 운영진 */}
            <div className="px-4 py-3.5">
              <p className="font-score text-3xl font-bold tabular-nums" style={{ color: "var(--admin-text)", opacity: 0.65 }}>
                {data.adminMembers}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--admin-muted)" }}>운영진</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 빠른 실행 ─────────────────────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>빠른 실행</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className="min-h-[44px] overflow-hidden rounded-[var(--admin-card-radius,14px)] px-4 py-3 transition-opacity hover:opacity-80"
                style={actionCardStyle(item.variant)}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{item.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 관리 ─────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>관리</p>
        <div
          className="overflow-hidden rounded-[var(--admin-card-radius,14px)]"
          style={cardSurface}
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
