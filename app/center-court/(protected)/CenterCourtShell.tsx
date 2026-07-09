"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { PlatformAdminSession } from "@/lib/platform-admin-session";

interface Props {
  session: PlatformAdminSession;
  children: React.ReactNode;
}

export function CenterCourtShell({ session, children }: Props) {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        /* ── 애니메이션 ─────────────────────────────────────── */
        @keyframes cc-content-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cc-court-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cc-ball-a {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-20px) rotate(200deg); }
        }
        @keyframes cc-ball-b {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes cc-ball-c {
          0%,100% { transform: translateY(0) translateX(0); }
          33%     { transform: translateY(-8px) translateX(5px); }
          66%     { transform: translateY(4px) translateX(-4px); }
        }
        .cc-content  { animation: cc-content-in 0.4s ease-out both; }
        .cc-court-in { animation: cc-court-in 2.8s ease-out both; }
        /* ── 카드 hover ──────────────────────────────────────── */
        .cc-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .cc-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 0 0 1px rgba(139,92,246,0.5),
            0 10px 32px rgba(0,0,0,0.7),
            0 0 24px rgba(109,40,217,0.14);
          border-color: rgba(139,92,246,0.45) !important;
        }
        /* ── 네비 링크 ──────────────────────────────────────── */
        .cc-nav {
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .cc-nav:hover { color: #f5f0e8 !important; }
        /* ── 로그아웃 버튼 ──────────────────────────────────── */
        .cc-logout {
          transition: background 0.15s, color 0.15s;
        }
        .cc-logout:hover {
          background: rgba(245,240,232,0.07) !important;
          color: #f5f0e8 !important;
        }
        /* ── 모션 감소 ──────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .cc-content, .cc-court-in { animation: none !important; }
          .cc-card { transition: none !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════
          전체 화면 오버레이 — root layout 헤더/탭바 완전 격리
          ════════════════════════════════════════════════════════ */}
      <div
        className="fixed inset-0 z-[9999] overflow-auto"
        style={{
          /* 잔디 모잉 스트라이프 + deep green 기반 */
          background: [
            "radial-gradient(ellipse at 18% 8%, rgba(255,255,255,0.055) 0%, transparent 38%)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.038) 0px, rgba(255,255,255,0.038) 10px, transparent 10px, transparent 90px)",
            "linear-gradient(175deg, #082d21 0%, #0a3328 40%, #061d14 100%)",
          ].join(", "),
        }}
      >
        {/* ── 테니스 코트 라인 오버레이 ─────────────────────── */}
        <div className="cc-court-in pointer-events-none fixed inset-0 z-0">
          <CourtLinesSVG />
        </div>

        {/* ── 테니스볼 데코 ──────────────────────────────────── */}
        <TennisBallDot
          style={{ top: "11%", right: "7%", width: 38, height: 38, opacity: 0.13 }}
          animation="cc-ball-a 7.5s ease-in-out infinite"
        />
        <TennisBallDot
          style={{ top: "55%", right: "3%", width: 20, height: 20, opacity: 0.07 }}
          animation="cc-ball-b 10s ease-in-out infinite 1.8s"
        />
        <TennisBallDot
          style={{ bottom: "16%", left: "5%", width: 26, height: 26, opacity: 0.08 }}
          animation="cc-ball-c 12s ease-in-out infinite 3s"
        />

        {/* ── 레이아웃 ─────────────────────────────────────────── */}
        <div className="relative z-10 flex min-h-full flex-col">

          {/* ════════════════════ HEADER ════════════════════════ */}
          <header
            className="sticky top-0 z-20"
            style={{
              background: "rgba(4, 16, 9, 0.88)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderBottom: "1px solid rgba(245,240,232,0.10)",
              /* 상단 퍼플 라인 */
              boxShadow: "inset 0 2px 0 rgba(109,40,217,0.45)",
            }}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="flex h-[52px] items-center justify-between gap-4">

                {/* ── 브랜드 (CC Emblem + 타이틀 + subtitle) ── */}
                <Link
                  href="/center-court"
                  className="flex shrink-0 items-center gap-3"
                  style={{ textDecoration: "none" }}
                >
                  <CCEmblem />
                  <div>
                    <span
                      style={{
                        display: "block",
                        color: "#f5f0e8",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        lineHeight: 1.2,
                      }}
                    >
                      Center Court
                    </span>
                    <span
                      style={{
                        display: "block",
                        color: "rgba(245,240,232,0.28)",
                        fontSize: 7.5,
                        fontWeight: 600,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        lineHeight: 1,
                        marginTop: 2,
                      }}
                    >
                      Championships Console
                    </span>
                  </div>
                </Link>

                {/* ── 데스크탑 네비 ─────────────────────────── */}
                <nav className="hidden items-center gap-1 sm:flex">
                  <HeaderNavLink
                    href="/center-court"
                    active={pathname === "/center-court"}
                  >
                    Overview
                  </HeaderNavLink>
                  <HeaderNavLink
                    href="/center-court/clubs"
                    active={pathname.startsWith("/center-court/clubs")}
                  >
                    Club Registry
                  </HeaderNavLink>
                  <HeaderNavLink
                    href="/center-court/audit"
                    active={pathname.startsWith("/center-court/audit")}
                  >
                    Audit Log
                  </HeaderNavLink>
                  {session.role === "owner" && (
                    <HeaderNavLink
                      href="/center-court/platform-admins"
                      active={pathname.startsWith("/center-court/platform-admins")}
                    >
                      Platform Admins
                    </HeaderNavLink>
                  )}
                </nav>

                {/* ── 사용자 정보 + 로그아웃 ─────────────────── */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="hidden sm:block"
                    style={{
                      color: "rgba(245,240,232,0.38)",
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {session.displayName || session.username}
                  </span>
                  <RoleBadge role={session.role} />
                  <CcLogoutButton />
                </div>
              </div>

              {/* ── 모바일 서브 네비 ──────────────────────────── */}
              <div className="flex gap-1 pb-2.5 sm:hidden">
                <HeaderNavLink
                  href="/center-court"
                  active={pathname === "/center-court"}
                  small
                >
                  Overview
                </HeaderNavLink>
                <HeaderNavLink
                  href="/center-court/clubs"
                  active={pathname.startsWith("/center-court/clubs")}
                  small
                >
                  Clubs
                </HeaderNavLink>
                <HeaderNavLink
                  href="/center-court/audit"
                  active={pathname.startsWith("/center-court/audit")}
                  small
                >
                  Audit
                </HeaderNavLink>
                {session.role === "owner" && (
                  <HeaderNavLink
                    href="/center-court/platform-admins"
                    active={pathname.startsWith("/center-court/platform-admins")}
                    small
                  >
                    Admins
                  </HeaderNavLink>
                )}
              </div>
            </div>
          </header>

          {/* ════════════════════ 본문 ══════════════════════════ */}
          <main className="cc-content mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
            {children}
          </main>

          {/* ════════════════════ 푸터 ══════════════════════════ */}
          <footer className="pb-5 pt-1 text-center">
            <p
              style={{
                color: "rgba(245,240,232,0.14)",
                fontSize: 8.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Center Court · Platform Operations Console
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   서브 컴포넌트
   ════════════════════════════════════════════════════════════ */

function CCEmblem() {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background:
          "linear-gradient(145deg, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.18) 100%)",
        border: "1px solid rgba(139,92,246,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,240,232,0.08), 0 0 12px rgba(109,40,217,0.2)",
      }}
    >
      <span
        style={{
          color: "rgba(245,240,232,0.92)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: "0.02em",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        CC
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 4,
        background: "rgba(109,40,217,0.25)",
        border: "1px solid rgba(139,92,246,0.5)",
        color: "#c4b5fd",
        flexShrink: 0,
        boxShadow: "0 0 8px rgba(109,40,217,0.15)",
      }}
    >
      {role}
    </span>
  );
}

function HeaderNavLink({
  href,
  active,
  children,
  small,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      className="cc-nav rounded"
      style={{
        display: "inline-block",
        padding: small ? "3px 10px" : "5px 13px",
        fontSize: small ? 9.5 : 10.5,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "none",
        color: active ? "#f5f0e8" : "rgba(245,240,232,0.38)",
        background: active
          ? "rgba(109,40,217,0.22)"
          : "transparent",
        border: active
          ? "1px solid rgba(139,92,246,0.45)"
          : "1px solid transparent",
        boxShadow: active ? "0 0 10px rgba(109,40,217,0.12)" : "none",
      }}
    >
      {children}
    </Link>
  );
}

function CcLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await fetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = "/center-court/login";
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="cc-logout rounded"
      style={{
        padding: "4px 11px",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(245,240,232,0.45)",
        border: "1px solid rgba(245,240,232,0.16)",
        background: "transparent",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {busy ? "…" : "Logout"}
    </button>
  );
}

function TennisBallDot({
  style,
  animation,
}: {
  style: React.CSSProperties;
  animation: string;
}) {
  return (
    <div
      className="pointer-events-none fixed z-0"
      style={{
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 36% 34%, #d8ff48 0%, #96cc00 60%, #6a9900 100%)",
        boxShadow: "0 0 14px rgba(180,220,0,0.2)",
        animation,
        ...style,
      }}
    />
  );
}

/* ── 테니스 코트 라인 SVG ────────────────────────────────── */
function CourtLinesSVG() {
  return (
    <svg
      className="fixed inset-0 h-full w-full"
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.055 }}
    >
      {/* 더블스 코트 외곽선 */}
      <rect
        x="10" y="6" width="180" height="88"
        fill="none"
        stroke="#f5f0e8"
        strokeWidth="0.55"
      />
      {/* 싱글스 사이드라인 */}
      <line x1="24" y1="6"  x2="24" y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
      <line x1="176" y1="6" x2="176" y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
      {/* 네트 (가로 중앙) */}
      <line x1="10" y1="50" x2="190" y2="50" stroke="#f5f0e8" strokeWidth="0.8"/>
      {/* 서비스 라인 */}
      <line x1="24" y1="28"  x2="176" y2="28"  stroke="#f5f0e8" strokeWidth="0.35"/>
      <line x1="24" y1="72"  x2="176" y2="72"  stroke="#f5f0e8" strokeWidth="0.35"/>
      {/* 센터 서비스 라인 */}
      <line x1="100" y1="28" x2="100" y2="72" stroke="#f5f0e8" strokeWidth="0.35"/>
      {/* 센터 마크 (베이스라인) */}
      <line x1="100" y1="6"  x2="100" y2="10" stroke="#f5f0e8" strokeWidth="0.35"/>
      <line x1="100" y1="90" x2="100" y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
    </svg>
  );
}
