/**
 * CENTER COURT — segment-level loading UI
 * fixed inset-0 z-[9999] 으로 root layout 완전 차단.
 * /center-court 및 모든 하위 라우트 로딩 중 표시.
 */
export default function CenterCourtLoading() {
  return (
    <>
      <style>{`
        @keyframes cc-load-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cc-ball-bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes cc-ball-bounce-b {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes cc-ball-bounce-c {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes cc-shimmer {
          0%   { opacity: 0.04; }
          50%  { opacity: 0.09; }
          100% { opacity: 0.04; }
        }
        .cc-load-wrap {
          animation: cc-load-fade 0.3s ease-out both;
        }
        .cc-load-ball-a {
          animation: cc-ball-bounce 1.1s ease-in-out infinite;
        }
        .cc-load-ball-b {
          animation: cc-ball-bounce-b 1.1s ease-in-out infinite 0.18s;
        }
        .cc-load-ball-c {
          animation: cc-ball-bounce-c 1.1s ease-in-out infinite 0.36s;
        }
        .cc-court-shimmer {
          animation: cc-shimmer 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cc-load-ball-a,
          .cc-load-ball-b,
          .cc-load-ball-c { animation: none; }
          .cc-court-shimmer { animation: none; }
        }
      `}</style>

      {/* root layout 완전 차단 */}
      <div
        className="cc-load-wrap"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: [
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.038) 0px, rgba(255,255,255,0.038) 10px, transparent 10px, transparent 90px)",
            "linear-gradient(175deg, #082d21 0%, #0a3328 40%, #061d14 100%)",
          ].join(", "),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 코트 라인 motif */}
        <div
          className="cc-court-shimmer"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <svg
            style={{ width: "100%", height: "100%", opacity: 0.06 }}
            viewBox="0 0 200 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="10" y="6" width="180" height="88" fill="none" stroke="#f5f0e8" strokeWidth="0.55" />
            <line x1="24"  y1="6"  x2="24"  y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="176" y1="6"  x2="176" y2="94" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="10"  y1="50" x2="190" y2="50" stroke="#f5f0e8" strokeWidth="0.8" />
            <line x1="24"  y1="28" x2="176" y2="28" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="24"  y1="72" x2="176" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
            <line x1="100" y1="28" x2="100" y2="72" stroke="#f5f0e8" strokeWidth="0.35" />
          </svg>
        </div>

        {/* purple top accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
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
            padding: "36px 40px 32px",
            borderRadius: 18,
            border: "1px solid rgba(245,240,232,0.1)",
            background: "rgba(2,6,4,0.90)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            minWidth: 240,
          }}
        >
          {/* CC 엠블렘 */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 42,
              height: 42,
              borderRadius: 10,
              background:
                "linear-gradient(145deg, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.18) 100%)",
              border: "1px solid rgba(139,92,246,0.5)",
              boxShadow: "0 0 16px rgba(109,40,217,0.18)",
              marginBottom: 18,
            }}
          >
            <span
              style={{
                color: "rgba(245,240,232,0.9)",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              CC
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
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Center Court
          </p>

          {/* tennis ball dot bounce */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 7,
              height: 22,
              marginBottom: 16,
            }}
          >
            {[
              "cc-load-ball-a",
              "cc-load-ball-b",
              "cc-load-ball-c",
            ].map((cls) => (
              <div
                key={cls}
                className={cls}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 35% 35%, #d8ff48, #8ab800)",
                  boxShadow: "0 0 6px rgba(180,220,0,0.25)",
                }}
              />
            ))}
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
            Preparing the court…
          </p>
        </div>
      </div>
    </>
  );
}
