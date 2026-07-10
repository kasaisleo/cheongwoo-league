"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminClubEntry } from "@/lib/admin-permission-types";

interface Props {
  clubs: AdminClubEntry[];
}

/**
 * AdminClubSelector — Admin Gateway 클럽 선택 목록.
 *
 * - 클릭 즉시 neutral loading overlay 표시 (특정 club skin 적용 금지)
 * - 중복 클릭 방지
 * - window.location.assign()으로 이동 (Next Link / router.push 금지 — prefetch 오염)
 * - bfcache 복원 시 overlay 초기화
 * - prefers-reduced-motion 대응
 */
export function AdminClubSelector({ clubs }: Props) {
  const [pending, setPending] = useState<AdminClubEntry | null>(null);
  const hasNavigated = useRef(false);

  // bfcache 복원(뒤로가기) 시 overlay 초기화
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setPending(null);
        hasNavigated.current = false;
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function handleSelect(club: AdminClubEntry) {
    if (pending || hasNavigated.current) return;
    hasNavigated.current = true;
    setPending(club);
    const url = `/api/admin/enter?club=${encodeURIComponent(club.slug)}`;
    window.location.assign(url);
  }

  return (
    <div className="relative">
      {/* 클럽 목록 */}
      <div className="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]">
        {clubs.map((club, idx) => (
          <a
            key={club.id}
            href={`/api/admin/enter?club=${encodeURIComponent(club.slug)}`}
            onClick={(e) => {
              e.preventDefault();
              handleSelect(club);
            }}
            aria-disabled={pending !== null}
            className={[
              "flex w-full items-center justify-between px-4 py-4 text-left transition-colors",
              idx < clubs.length - 1 ? "border-b border-white/[0.06]" : "",
              pending !== null
                ? "pointer-events-none opacity-40"
                : "hover:bg-white/[0.06] active:bg-white/[0.08]",
              pending?.id === club.id ? "opacity-100" : "",
            ].join(" ")}
          >
            <div>
              <p className="text-sm font-semibold text-white/80">{club.name}</p>
              <p className="eyebrow-en text-[10px] text-white/35">{club.role}</p>
            </div>
            {pending?.id === club.id ? (
              <span className="eyebrow-en text-[10px] text-white/40">선택 중...</span>
            ) : (
              <span className="text-sm text-white/30">›</span>
            )}
          </a>
        ))}
      </div>

      {/* Loading overlay */}
      {pending && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`${pending.name} 관리자 화면을 준비하고 있습니다`}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(170deg, #08101c 0%, #050a12 100%)" }}
        >
          <div className="w-full max-w-sm px-8 text-center">
            <p className="eyebrow-en mb-5 text-[10px] font-bold uppercase tracking-widest text-white/30">
              Admin Access
            </p>
            <p className="text-base font-semibold text-white/80">
              {pending.name} 관리자 화면을<br />준비하고 있습니다
            </p>
            <p className="mt-2 text-xs text-white/35">
              권한과 클럽 정보를 확인하는 중입니다
            </p>

            {/* Indeterminate progress bar */}
            <div className="mx-auto mt-8 h-[2px] w-48 overflow-hidden rounded-full bg-white/10">
              <div className="admin-selector-bar h-full rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes admin-slide {
          0%   { transform: translateX(-100%); width: 60%; }
          50%  { transform: translateX(83%);   width: 60%; }
          100% { transform: translateX(200%);  width: 30%; }
        }
        .admin-selector-bar {
          animation: admin-slide 1.2s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-selector-bar {
            animation: none;
            transform: none;
            width: 100%;
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
