"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * ClubBottomNav (BottomTabBar) v6 — CSS var 직접 사용.
 *
 * 모든 색상을 --club-primary / --club-muted / --club-bg / --club-border 변수로.
 * :root 기본값(청우회 라임/네이비)과 :root:has([data-club-skin="namaste"])(퍼플/크림)
 * 양쪽에서 자동으로 올바른 색상이 적용됨.
 * 새 스킨 추가 시 이 컴포넌트를 수정할 필요 없다.
 */

const LAST_CLUB_SLUG_KEY = "last_club_slug";

function extractSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match ? match[1] : null;
}

const GLOBAL_TABS = [
  { href: "__HOME__",    label: "홈",  icon: HomeIcon },
  { href: "/attendance", label: "매치", icon: CalendarIcon },
  { href: "/matches",    label: "기록", icon: ListIcon },
  { href: "/members",    label: "회원", icon: UsersIcon },
  { href: "/mypage",     label: "마이", icon: PersonIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const slug = extractSlugFromPath(pathname);
  const isAdminPage = pathname.startsWith("/admin");

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
        { href: `/c/${slug}/mypage`,     label: "마이", icon: PersonIcon },
      ]
    : GLOBAL_TABS.map((t) => (t.href === "__HOME__" ? { ...t, href: homeHref } : t));

  return (
    <nav
      aria-label="주요 메뉴"
      className="club-bottom-nav fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: "var(--club-bg)" }}
    >
      {/* 구분선 — skin border 색상 */}
      <div
        className="h-px"
        style={{
          background: "linear-gradient(to right, transparent, var(--club-border), transparent)",
        }}
      />

      <div className="flex items-stretch">
        {tabs.map((tab) => {
          let isActive: boolean;
          if (slug) {
            isActive =
              tab.href === `/c/${slug}`
                ? pathname === `/c/${slug}`
                : pathname.startsWith(tab.href);
          } else {
            isActive = tab.href !== "" && tab.href !== homeHref && pathname.startsWith(tab.href);
          }
          const Icon = tab.icon;
          const color = isActive ? "var(--club-primary)" : "var(--club-muted)";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className="relative flex-1 shell-bottom-tab"
              style={{ color }}
            >
              {isActive && (
                <span
                  className="shell-bottom-indicator"
                  style={{ backgroundColor: "var(--club-primary)" }}
                  aria-hidden="true"
                />
              )}
              <Icon className="transition-colors" />
              <span className="nav-label-kr transition-colors">{tab.label}</span>
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
