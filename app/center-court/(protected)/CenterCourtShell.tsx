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
        @keyframes cc-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cc-ball-a {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-18px) rotate(180deg); }
        }
        @keyframes cc-ball-b {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes cc-line-in {
          from { opacity: 0; transform: scaleX(0); transform-origin: left; }
          to   { opacity: 1; transform: scaleX(1); transform-origin: left; }
        }
        .cc-content { animation: cc-fade-in 0.35s ease-out both; }
        .cc-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .cc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 1px rgba(139,92,246,0.35),
                      0 8px 28px rgba(0,0,0,0.45);
        }
        .cc-nav-item {
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .cc-logout-btn {
          transition: opacity 0.15s, background 0.15s;
        }
        .cc-logout-btn:hover { background: rgba(245,240,232,0.08); }
        @media (prefers-reduced-motion: reduce) {
          .cc-content, .cc-card, .cc-nav-item { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* ── 전체 화면 오버레이 (root layout 헤더/탭바 완전 덮기) ──────── */}
      <div
        className="fixed inset-0 z-[9999] overflow-auto"
        style={{
          background:
            "radial-gradient(ellipse at 25% 15%, #1e4d32 0%, #0f2318 55%, #070f0b 100%)",
        }}
      >
        {/* 코트 라인 그리드 */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(245,240,232,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,240,232,0.035) 1px, transparent 1px)
            `,
            backgroundSize: "72px 72px",
          }}
        />
        {/* 코트 센터 서비스라인 (수직 중앙선) */}
        <div
          className="pointer-events-none fixed inset-y-0 z-0"
          style={{
            left: "50%",
            width: 1,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(245,240,232,0.06) 20%, rgba(245,240,232,0.06) 80%, transparent 100%)",
          }}
        />

        {/* 테니스볼 데코 */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            top: "12%",
            right: "6%",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 36%, #ccff44 0%, #88bb00 100%)",
            opacity: 0.12,
            animation: "cc-ball-a 7s ease-in-out infinite",
            boxShadow: "0 0 18px rgba(180,220,0,0.25)",
          }}
        />
        <div
          className="pointer-events-none fixed z-0"
          style={{
            bottom: "18%",
            left: "4%",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 36%, #ccff44 0%, #88bb00 100%)",
            opacity: 0.07,
            animation: "cc-ball-b 9s ease-in-out infinite 1.5s",
          }}
        />

        {/* ── 레이아웃 ─────────────────────────────────────────── */}
        <div className="relative z-10 flex min-h-full flex-col">

          {/* ── 상단 헤더 ──────────────────────────────────────── */}
          <header
            className="sticky top-0 z-20"
            style={{
              background: "rgba(7, 15, 11, 0.82)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              borderBottom: "1px solid rgba(245,240,232,0.10)",
            }}
          >
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              {/* 메인 행 */}
              <div className="flex h-14 items-center justify-between gap-3">
                {/* 브랜드 */}
                <Link
                  href="/center-court"
                  className="flex shrink-0 items-center gap-2.5"
                >
                  <CourtIcon />
                  <span
                    style={{
                      color: "#f5f0e8",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    Center Court
                  </span>
                </Link>

                {/* 데스크탑 네비 */}
                <nav className="hidden items-center gap-1 sm:flex">
                  <CcNavLink
                    href="/center-court"
                    active={pathname === "/center-court"}
                  >
                    Overview
                  </CcNavLink>
                  {session.role === "owner" && (
                    <CcNavLink
                      href="/center-court/platform-admins"
                      active={pathname.startsWith(
                        "/center-court/platform-admins"
                      )}
                    >
                      Platform Admins
                    </CcNavLink>
                  )}
                </nav>

                {/* 사용자 정보 + 로그아웃 */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="hidden sm:block"
                    style={{
                      color: "rgba(245,240,232,0.45)",
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {session.displayName || session.username}
                  </span>
                  <RoleBadge role={session.role} />
                  <CcLogoutButton />
                </div>
              </div>

              {/* 모바일 서브 네비 */}
              <div className="flex gap-1 pb-2 sm:hidden">
                <CcNavLink
                  href="/center-court"
                  active={pathname === "/center-court"}
                  small
                >
                  Overview
                </CcNavLink>
                {session.role === "owner" && (
                  <CcNavLink
                    href="/center-court/platform-admins"
                    active={pathname.startsWith(
                      "/center-court/platform-admins"
                    )}
                    small
                  >
                    Admins
                  </CcNavLink>
                )}
              </div>
            </div>
          </header>

          {/* ── 본문 ──────────────────────────────────────────── */}
          <main className="cc-content mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>

          {/* ── 푸터 ──────────────────────────────────────────── */}
          <footer className="pb-6 pt-2 text-center">
            <p
              style={{
                color: "rgba(245,240,232,0.18)",
                fontSize: 9,
                letterSpacing: "0.12em",
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

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────

function CourtIcon() {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 5,
        background: "rgba(139,92,246,0.18)",
        border: "1px solid rgba(139,92,246,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {/* 미니 테니스 코트 */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="2" width="12" height="10" rx="1" stroke="rgba(245,240,232,0.6)" strokeWidth="1"/>
        <line x1="7" y1="2" x2="7" y2="12" stroke="rgba(245,240,232,0.6)" strokeWidth="0.75"/>
        <line x1="1" y1="7" x2="13" y2="7" stroke="rgba(245,240,232,0.6)" strokeWidth="0.75"/>
      </svg>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 4,
        background: "rgba(139,92,246,0.18)",
        border: "1px solid rgba(139,92,246,0.4)",
        color: "#c4b5fd",
        flexShrink: 0,
      }}
    >
      {role}
    </span>
  );
}

function CcNavLink({
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
      className="cc-nav-item rounded"
      style={{
        padding: small ? "3px 10px" : "5px 12px",
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: active ? "#f5f0e8" : "rgba(245,240,232,0.45)",
        background: active ? "rgba(245,240,232,0.08)" : "transparent",
        border: active
          ? "1px solid rgba(245,240,232,0.15)"
          : "1px solid transparent",
        textDecoration: "none",
        display: "inline-block",
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
      className="cc-logout-btn rounded"
      style={{
        padding: "4px 10px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(245,240,232,0.55)",
        border: "1px solid rgba(245,240,232,0.18)",
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
