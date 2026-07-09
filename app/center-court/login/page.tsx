import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import LoginPageClient from "./LoginPageClient";

export default async function CenterCourtLoginPage() {
  const session = await getPlatformAdminSession();
  if (session) redirect("/center-court");

  return (
    <>
      <style>{`
        @keyframes cc-login-fade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cc-ball-login {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-20px) rotate(200deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cc-login-card { animation: none !important; }
        }
      `}</style>

      {/* 전체 화면 오버레이 (root layout 헤더 덮기) */}
      <div
        className="fixed inset-0 z-[9999] overflow-auto"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, #1e4d32 0%, #0f2318 55%, #070f0b 100%)",
        }}
      >
        {/* 코트 라인 그리드 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(245,240,232,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,240,232,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "72px 72px",
          }}
        />
        {/* 코트 중앙선 */}
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: "50%",
            width: 1,
            background:
              "linear-gradient(to bottom, transparent, rgba(245,240,232,0.07) 20%, rgba(245,240,232,0.07) 80%, transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: "50%",
            height: 1,
            background:
              "linear-gradient(to right, transparent, rgba(245,240,232,0.07) 20%, rgba(245,240,232,0.07) 80%, transparent)",
          }}
        />

        {/* 볼 데코 */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: "10%",
            right: "8%",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 36%, #ccff44 0%, #88bb00 100%)",
            opacity: 0.14,
            animation: "cc-ball-login 8s ease-in-out infinite",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: "14%",
            left: "6%",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 36%, #ccff44 0%, #88bb00 100%)",
            opacity: 0.08,
            animation: "cc-ball-login 11s ease-in-out infinite 2s",
          }}
        />

        {/* 로그인 카드 */}
        <div
          className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 py-16"
        >
          <div
            className="cc-login-card w-full max-w-sm"
            style={{ animation: "cc-login-fade 0.4s ease-out both" }}
          >
            {/* 헤더 */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              {/* 미니 코트 아이콘 */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(139,92,246,0.4)",
                  background: "rgba(139,92,246,0.12)",
                  marginBottom: 16,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="3" width="16" height="14" rx="1.5" stroke="rgba(245,240,232,0.6)" strokeWidth="1.25"/>
                  <line x1="10" y1="3" x2="10" y2="17" stroke="rgba(245,240,232,0.6)" strokeWidth="1"/>
                  <line x1="2" y1="10" x2="18" y2="10" stroke="rgba(245,240,232,0.6)" strokeWidth="1"/>
                </svg>
              </div>
              <p
                style={{
                  color: "rgba(245,240,232,0.4)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Center Court
              </p>
              <h1
                style={{
                  color: "#f5f0e8",
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                센터코트
              </h1>
              <p
                style={{
                  color: "rgba(245,240,232,0.3)",
                  fontSize: 11,
                }}
              >
                플랫폼 어드민 전용 영역입니다.
              </p>
            </div>

            {/* 폼 카드 */}
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(245,240,232,0.10)",
                background: "rgba(245,240,232,0.04)",
                backdropFilter: "blur(8px)",
                padding: "22px 20px",
              }}
            >
              <LoginPageClient />
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: 18,
                color: "rgba(245,240,232,0.18)",
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Platform Operations Console
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
