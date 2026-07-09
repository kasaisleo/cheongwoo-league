import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import LoginPageClient from "./LoginPageClient";

export default async function CenterCourtLoginPage() {
  const session = await getPlatformAdminSession();
  if (session) redirect("/center-court");

  return (
    <>
      <style>{`
        @keyframes cc-login-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cc-ball-login-a {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-22px) rotate(210deg); }
        }
        @keyframes cc-ball-login-b {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes cc-court-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .cc-login-card { animation: cc-login-in 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .cc-login-card { animation: none !important; }
        }
      `}</style>

      {/* 전체 화면 오버레이 */}
      <div
        className="fixed inset-0 z-[9999] overflow-auto"
        style={{
          background: [
            "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.05) 0%, transparent 40%)",
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.038) 0px, rgba(255,255,255,0.038) 10px, transparent 10px, transparent 90px)",
            "linear-gradient(175deg, #082d21 0%, #0a3328 40%, #061d14 100%)",
          ].join(", "),
        }}
      >
        {/* 코트 라인 SVG */}
        <div
          style={{ animation: "cc-court-fade 3s ease-out both" }}
          className="pointer-events-none fixed inset-0 z-0"
        >
          <svg
            className="fixed inset-0 h-full w-full"
            viewBox="0 0 200 100"
            preserveAspectRatio="xMidYMid slice"
            style={{ opacity: 0.05 }}
          >
            <rect x="10" y="6" width="180" height="88" fill="none" stroke="#f5f0e8" strokeWidth="0.55"/>
            <line x1="24" y1="6"  x2="24"  y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="176" y1="6" x2="176" y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="10" y1="50" x2="190" y2="50" stroke="#f5f0e8" strokeWidth="0.8"/>
            <line x1="24" y1="28" x2="176" y2="28" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="24" y1="72" x2="176" y2="72" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="100" y1="28" x2="100" y2="72" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="100" y1="6"  x2="100" y2="10" stroke="#f5f0e8" strokeWidth="0.35"/>
            <line x1="100" y1="90" x2="100" y2="94" stroke="#f5f0e8" strokeWidth="0.35"/>
          </svg>
        </div>

        {/* 퍼플 상단 라인 (헤더 톤 맞춤) */}
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-0"
          style={{
            height: 2,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(109,40,217,0.55) 30%, rgba(139,92,246,0.7) 50%, rgba(109,40,217,0.55) 70%, transparent 100%)",
          }}
        />

        {/* 볼 데코 */}
        <div
          className="pointer-events-none fixed z-0"
          style={{
            top: "9%", right: "7%",
            width: 34, height: 34,
            borderRadius: "50%",
            background: "radial-gradient(circle at 36% 34%, #d8ff48 0%, #96cc00 60%, #6a9900 100%)",
            opacity: 0.13,
            animation: "cc-ball-login-a 8s ease-in-out infinite",
            boxShadow: "0 0 14px rgba(180,220,0,0.2)",
          }}
        />
        <div
          className="pointer-events-none fixed z-0"
          style={{
            bottom: "14%", left: "5%",
            width: 22, height: 22,
            borderRadius: "50%",
            background: "radial-gradient(circle at 36% 34%, #d8ff48 0%, #96cc00 60%, #6a9900 100%)",
            opacity: 0.08,
            animation: "cc-ball-login-b 11s ease-in-out infinite 2s",
          }}
        />

        {/* ── 로그인 카드 ─────────────────────────────────────── */}
        <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 py-16">
          <div
            className="cc-login-card w-full max-w-sm"
          >
            {/* 헤더 */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              {/* CC 엠블렘 */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 46,
                  height: 46,
                  borderRadius: 11,
                  background:
                    "linear-gradient(145deg, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.18) 100%)",
                  border: "1px solid rgba(139,92,246,0.55)",
                  boxShadow:
                    "0 2px 12px rgba(0,0,0,0.5), 0 0 16px rgba(109,40,217,0.18)",
                  marginBottom: 18,
                }}
              >
                <span
                  style={{
                    color: "rgba(245,240,232,0.92)",
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                  }}
                >
                  CC
                </span>
              </div>

              <p
                style={{
                  color: "rgba(245,240,232,0.32)",
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  fontFamily: "Georgia, serif",
                  marginBottom: 7,
                }}
              >
                Center Court
              </p>
              <h1
                style={{
                  color: "#f5f0e8",
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  letterSpacing: "0.02em",
                  marginBottom: 6,
                }}
              >
                센터코트
              </h1>
              <p style={{ color: "rgba(245,240,232,0.28)", fontSize: 11 }}>
                플랫폼 어드민 전용 영역입니다.
              </p>
            </div>

            {/* 폼 카드 */}
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(245,240,232,0.10)",
                background: "rgba(12,32,20,0.78)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                padding: "22px 20px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              }}
            >
              <LoginPageClient />
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: 18,
                color: "rgba(245,240,232,0.15)",
                fontSize: 8.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Championships Console · Platform Admin Only
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
