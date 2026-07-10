/**
 * SUPER MATCH — / 루트 전용 loading UI
 *
 * app/(platform)/ route group에 위치하므로 / 라우트에만 적용된다.
 * /matches, /ranking 등 클럽 페이지는 app/loading.tsx 그대로 사용.
 *
 * fixed inset-0 z-[9999] 로 root layout의
 * BrandHeader / MemberAuthBar / BottomTabBar 를 완전 차단.
 */
export default function PlatformLoading() {
  return (
    <>
      <style>{`
        @keyframes sm-load-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sm-load-ball-a {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-9px); }
        }
        @keyframes sm-load-ball-b {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-9px); }
        }
        @keyframes sm-load-ball-c {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-9px); }
        }
        @keyframes sm-court-pulse {
          0%,100% { opacity: 0.04; }
          50%      { opacity: 0.08; }
        }
        .sm-load-wrap   { animation: sm-load-fade 0.28s ease-out both; }
        .sm-load-ball-a { animation: sm-load-ball-a 1.1s ease-in-out infinite; }
        .sm-load-ball-b { animation: sm-load-ball-b 1.1s ease-in-out infinite 0.18s; }
        .sm-load-ball-c { animation: sm-load-ball-c 1.1s ease-in-out infinite 0.36s; }
        .sm-court-bg    { animation: sm-court-pulse 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sm-load-wrap   { animation: none; }
          .sm-load-ball-a,
          .sm-load-ball-b,
          .sm-load-ball-c { animation: none; }
          .sm-court-bg    { animation: none; opacity: 0.05; }
        }
      `}</style>

      {/* root layout 차단 — fixed inset-0 z-[9999], backgroundColor로 solid base 보장 */}
      <div
        className="sm-load-wrap"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          isolation: "isolate",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#061d14",
          background: [
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.038) 0px, rgba(255,255,255,0.038) 10px, transparent 10px, transparent 90px)",
            "linear-gradient(170deg, #082d21 0%, #0a3328 45%, #061d14 100%)",
          ].join(", "),
        }}
      >
        {/* 코트 라인 SVG */}
        <div
          className="sm-court-bg"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <svg
            style={{ width: "100%", height: "100%" }}
            viewBox="0 0 200 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="10" y="6"  width="180" height="88" fill="none" stroke="#f5f0e8" strokeWidth="0.55" />
            <line x1="24"  y1="6"  x2="24"  y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="176" y1="6"  x2="176" y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="10"  y1="50" x2="190" y2="50" stroke="#f5f0e8" strokeWidth="0.8"  />
            <line x1="24"  y1="28" x2="176" y2="28" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="24"  y1="72" x2="176" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="100" y1="28" x2="100" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
          </svg>
        </div>

        {/* purple top accent */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(109,40,217,0.55) 30%, rgba(139,92,246,0.7) 50%, rgba(109,40,217,0.55) 70%, transparent 100%)",
          }}
        />

        {/* loading 카드 */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            padding: "34px 40px 30px",
            borderRadius: 18,
            border: "1px solid rgba(245,240,232,0.10)",
            background: "rgba(2,6,4,0.90)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.65)",
            minWidth: 220,
          }}
        >
          {/* SM 엠블렘 */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              background:
                "linear-gradient(145deg, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.18) 100%)",
              border: "1px solid rgba(139,92,246,0.5)",
              boxShadow: "0 0 16px rgba(109,40,217,0.18)",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                color: "rgba(245,240,232,0.9)",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              SM
            </span>
          </div>

          {/* 브랜드 */}
          <p
            style={{
              color: "rgba(245,240,232,0.3)",
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              fontFamily: "Georgia, serif",
              marginBottom: 5,
            }}
          >
            Super Match
          </p>
          <p
            style={{
              color: "#f5f0e8",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Tennis Club Platform
          </p>

          {/* 테니스볼 bounce dots */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 7,
              height: 20,
              marginBottom: 14,
            }}
          >
            {(["sm-load-ball-a", "sm-load-ball-b", "sm-load-ball-c"] as const).map(
              (cls) => (
                <div
                  key={cls}
                  className={cls}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, #d8ff48, #8ab800)",
                    boxShadow: "0 0 6px rgba(180,220,0,0.22)",
                  }}
                />
              )
            )}
          </div>

          <p
            style={{
              color: "rgba(196,181,253,0.45)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Loading clubs…
          </p>
        </div>
      </div>
    </>
  );
}
