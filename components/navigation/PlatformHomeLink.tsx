"use client";

import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * PlatformHomeLink — href="/" 전용 transition-aware 링크.
 *
 * Next.js client navigation 시 RSC payload 도착 전까지 이전 route DOM이
 * 잔류하는 문제를 해결.
 * 클릭 즉시 fixed inset-0 platform overlay를 document.body에 portal로 mount,
 * (platform)/loading.tsx 발화 전 공백 구간을 완전히 차단.
 *
 * - portal(document.body): DemoLayout(isolation: isolate) 등 stacking context 우회
 * - modified click(ctrl/cmd/새탭): 기본 <a> 동작 유지
 * - pageshow persisted: bfcache 복귀 시 overlay 자동 해제
 */
export function PlatformHomeLink({ children, className, style }: Props) {
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // bfcache 복귀 시 overlay 해제
  useEffect(() => {
    if (!pending) return;
    function onPageshow(e: PageTransitionEvent) {
      if (e.persisted) setPending(false);
    }
    window.addEventListener("pageshow", onPageshow);
    return () => window.removeEventListener("pageshow", onPageshow);
  }, [pending]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // modified click → 기본 동작 유지 (새 탭, 우클릭 등)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (pending) return;
      setPending(true);
      router.push("/");
    },
    [pending, router],
  );

  return (
    <>
      <a href="/" onClick={handleClick} className={className} style={style}>
        {children}
      </a>
      {pending && mounted && createPortal(<PlatformTransitionOverlay />, document.body)}
    </>
  );
}

/* ── Platform Transition Overlay ──────────────────────────────── */

function PlatformTransitionOverlay() {
  return (
    <>
      <style>{`
        @keyframes pt-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pt-bar-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .pt-wrap { animation: pt-fade-in 0.18s ease-out both; }
        .pt-bar-inner { animation: pt-bar-slide 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pt-wrap { animation: none; opacity: 1; }
          .pt-bar-inner { animation: none; transform: none; width: 100% !important; opacity: 0.25; }
        }
      `}</style>

      <div
        className="pt-wrap"
        role="status"
        aria-live="polite"
        aria-label="플랫폼 홈 이동 중"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#061d14",
          background: [
            "repeating-linear-gradient(90deg,rgba(255,255,255,0.038) 0px,rgba(255,255,255,0.038) 10px,transparent 10px,transparent 90px)",
            "linear-gradient(170deg,#082d21 0%,#0a3328 45%,#061d14 100%)",
          ].join(", "),
        }}
      >
        {/* purple top accent */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg,transparent 0%,rgba(109,40,217,0.55) 30%,rgba(139,92,246,0.7) 50%,rgba(109,40,217,0.55) 70%,transparent 100%)",
          }}
        />

        {/* indeterminate progress bar — 하단 */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(109,40,217,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            className="pt-bar-inner"
            style={{
              position: "absolute",
              inset: 0,
              width: "45%",
              background:
                "linear-gradient(90deg,transparent,rgba(139,92,246,0.8),rgba(196,181,253,0.9),rgba(139,92,246,0.8),transparent)",
            }}
          />
        </div>

        {/* 카드 */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            padding: "28px 36px 24px",
            borderRadius: 16,
            border: "1px solid rgba(245,240,232,0.10)",
            background: "rgba(2,6,4,0.90)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.65)",
            minWidth: 200,
          }}
        >
          {/* SM 엠블렘 */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 9,
              background:
                "linear-gradient(145deg,rgba(109,40,217,0.35) 0%,rgba(76,29,149,0.18) 100%)",
              border: "1px solid rgba(139,92,246,0.5)",
              boxShadow: "0 0 16px rgba(109,40,217,0.18)",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                color: "rgba(245,240,232,0.9)",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "Georgia,'Times New Roman',serif",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              SM
            </span>
          </div>

          <p
            style={{
              color: "rgba(245,240,232,0.28)",
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              fontFamily: "Georgia,serif",
              marginBottom: 4,
            }}
          >
            Super Match
          </p>
          <p
            style={{
              color: "rgba(196,181,253,0.45)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Loading platform…
          </p>
        </div>
      </div>
    </>
  );
}
