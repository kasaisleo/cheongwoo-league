"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * BottomTabBar v2 — ATP/Flashscore 스타일 하단 탭바 (Step 15-6).
 *
 * 변경 전: 아이콘+텍스트, 활성=text-clay-400, 비활성=text-line-400
 * 변경 후:
 *   - 탭바 배경: bg-line-25 (가장 어두운 딥 네이비) + 강한 상단 테두리
 *   - 활성 탭: clay-400 아이콘+텍스트 + 탭 상단 2px clay accent line
 *   - 비활성 탭: line-500 (이전보다 약간 밝게, 가독성 향상)
 *   - 탭 라벨: font-display uppercase tracking 적용 (ATP 스타일)
 *   - 최대 너비 제거: 모바일 full-width가 더 자연스러움
 */

const TABS = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/attendance", label: "매치", icon: CalendarIcon },
  { href: "/matches", label: "기록", icon: ListIcon },
  { href: "/members", label: "회원", icon: UsersIcon },
  { href: "/mypage", label: "마이", icon: PersonIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-line-25 pb-[env(safe-area-inset-bottom)]">
      {/* 상단 구분선 — 강한 clay accent + 어두운 배경으로 ATP 레이아웃 느낌 */}
      <div className="h-px bg-gradient-to-r from-transparent via-clay-400/30 to-transparent" />

      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center pt-2 pb-2 gap-1"
            >
              {/* 활성 탭 상단 accent line */}
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
