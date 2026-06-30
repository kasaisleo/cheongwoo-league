"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

/**
 * Step 14-1 탭바 재편:
 *   이전: 홈 | 랭킹 | 경기입력(/matches/new) | 출석 | 회원
 *   이후: 홈 | 출석 | 경기 | 회원 | 내 정보
 *
 * 제거된 탭:
 *   - 랭킹(/ranking): 탭바에서만 제거. /ranking 페이지와 라우트는 유지.
 *   - 경기입력(/matches/new): 탭바에서만 제거. 이후 /matches 페이지 안의 운영진 버튼으로 노출 예정.
 *
 * 추가된 탭:
 *   - 경기(/matches): 경기 기록 조회. 경기 입력은 해당 페이지 내 운영진 버튼으로 이동 예정.
 *   - 내 정보(/mypage): 마이페이지. 비로그인 시 /mypage 자체의 기존 로직(로그인 안내)이 처리.
 *
 * active 처리:
 *   - "/" 는 정확히 일치할 때만 active (startsWith 쓰면 전체가 active됨)
 *   - 나머지는 pathname.startsWith(tab.href)로 하위 경로까지 active
 *     예: /matches/new, /matches/1 → "경기" 탭 active
 *         /mypage → "내 정보" 탭 active
 */
const TABS = [
  { href: "/", label: "홈", icon: HomeIcon },
  { href: "/attendance", label: "출석", icon: CalendarIcon },
  { href: "/matches", label: "경기", icon: MatchIcon },
  { href: "/members", label: "회원", icon: UsersIcon },
  { href: "/mypage", label: "내 정보", icon: PersonIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-clay-400/40 bg-line-25/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2"
            >
              <Icon
                className={clsx(
                  "h-6 w-6",
                  isActive ? "text-clay-400" : "text-line-400"
                )}
              />
              <span
                className={clsx(
                  "text-[11px] font-medium",
                  isActive ? "text-clay-400" : "text-line-400"
                )}
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

/** 경기 탭 아이콘 — 테니스 라켓 실루엣 */
function MatchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5l5 5" strokeLinecap="round" />
      <path d="M7 10h6M10 7v6" strokeLinecap="round" />
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

/** 내 정보 탭 아이콘 — 사람 실루엣 */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}
