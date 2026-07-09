/**
 * CENTER COURT protected routes — page-level loading UI
 * /center-court (dashboard) ↔ /center-court/platform-admins 전환 중 표시.
 */
export default function CenterCourtProtectedLoading() {
  return (
    <>
      <style>{`
        @keyframes cc-pload-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.65; }
        }
        @keyframes cc-pload-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .cc-pload-pulse { animation: cc-pload-pulse 1.6s ease-in-out infinite; }
        .cc-pload-spin  { animation: cc-pload-spin  1.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cc-pload-pulse, .cc-pload-spin { animation: none; opacity: 0.5; }
        }
      `}</style>

      {/* CenterCourtShell 내부에서 렌더링되므로 full-screen 오버레이 불필요.
          Shell의 content 영역을 채우는 형태로 표시. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 320,
          gap: 16,
        }}
      >
        {/* 테니스공 스피너 */}
        <div
          className="cc-pload-spin"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2.5px solid rgba(109,40,217,0.25)",
            borderTopColor: "rgba(139,92,246,0.7)",
          }}
        />
        <p
          className="cc-pload-pulse"
          style={{
            color: "rgba(245,240,232,0.45)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "Georgia, serif",
          }}
        >
          Loading…
        </p>
      </div>
    </>
  );
}
