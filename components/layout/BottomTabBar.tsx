"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * BottomTabBar v5 — slug-aware + last_club_slug tracking.
 *
 * HOME href 정책:
 *   1. /c/[slug]/* : /c/[slug]
 *   2. /admin/*    : /admin
 *   3. legacy 전역 페이지 (/matches, /attendance, /mypage …):
 *      localStorage에 저장된 last_club_slug → /c/{slug}
 *      저장된 값 없으면 / (플랫폼 홈)으로 이동 — 특정 클럽 hardcode 금지
 *   4. / 플랫폼 랜딩: PlatformLandingClient 오버레이가 BottomTabBar를 가리므로
 *      HOME="/"를 제거해도 실제 문제 없음.
 *
 * SUPER MATCH 브랜드 링크(BrandHeader)는 여전히 href="/" 유지.
 */

const LAST_CLUB_SLUG_KEY = "last_club_slug";

function extractSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match ? match[1] : null;
}

const GLOBAL_TABS = [
  // HOME은 사용처마다 다르게 계산하므로 placeholder로 "" 사용
  { href: "__HOME__", label: "홈",  icon: HomeIcon },
  { href: "/attendance", label: "매치", icon: CalendarIcon },
  { href: "/matches",    label: "기록", icon: ListIcon },
  { href: "/members",    label: "회원", icon: UsersIcon },
  { href: "/mypage",     label: "마이", icon: PersonIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const slug = extractSlugFromPath(pathname);
  const isAdminPage = pathname.startsWith("/admin");

  // last_club_slug 추적 — /c/[slug] 방문 시 저장, legacy 페이지에서 복원
  const [lastClubSlug, setLastClubSlug] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      try { localStorage.setItem(LAST_CLUB_SLUG_KEY, slug); } catch { /* 무시 */ }
      setLastClubSlug(slug);
    } else {
      try {
        const saved = localStorage.getItem(LAST_CLUB_SLUG_KEY);
        if (saved) setLastClubSlug(saved);
      } catch { /* 무시 */ }
    }
  }, [slug]);

  // HOME href 결정
  const homeHref = slug
    ? `/c/${slug}`
    : isAdminPage
    ? "/admin"
    : lastClubSlug
    ? `/c/${lastClubSlug}`
    : "/";

  const tabs = slug
    ? [
        { href: `/c/${slug}`,            label: "홈",  icon: HomeIcon },
        { href: `/c/${slug}/attendance`, label: "매치", icon: CalendarIcon },
        { href: `/c/${slug}/matches`,    label: "기록", icon: ListIcon },
        { href: `/c/${slug}/members`,    label: "회원", icon: UsersIcon },
        { href: "/mypage",               label: "마이", icon: PersonIcon },
      ]
    : GLOBAL_TABS.map((t) => (t.href === "__HOME__" ? { ...t, href: homeHref } : t));

  return (
    <nav className="club-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-line-25 pb-[env(safe-area-inset-bottom)]">
      <div className="club-nav-sep h-px bg-gradient-to-r from-transparent via-clay-400/30 to-transparent" />

      <div className="flex items-stretch">
        {tabs.map((tab) => {
          let isActive: boolean;
          if (slug) {
            isActive =
              tab.href === `/c/${slug}`
                ? pathname === `/c/${slug}`
                : pathname.startsWith(tab.href) && tab.href !== "/mypage"
                  ? true
                  : tab.href === "/mypage" && pathname.startsWith("/mypage");
          } else {
            // non-slug 페이지: pathname이 tab.href로 시작하면 active
            // homeHref가 /c/... 형태이므로 legacy 페이지에서는 HOME이 active되지 않음
            isActive = tab.href !== "" && pathname.startsWith(tab.href);
          }
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center pt-2 pb-2 gap-1"
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-clay-400"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`h-[22px] w-[22px] transition-colors ${
                  isActive ? "text-clay-400" : "text-line-500"
                }`}
              />
              <span
                className={`nav-label-kr transition-colors ${
                  isActive ? "text-clay-400" : "text-line-500"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5h11M9 12h11M9 19h11" strokeLinecap="round" />
      <circle cx="4" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
      <path d="M16 4.5a3 3 0 010 5.8M19 20c0-2.4-1.6-4.5-4-5.4" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}
