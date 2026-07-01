/**
 * TennisBallLoader — 청우회 리그 브랜드 로딩 컴포넌트.
 *
 * variant:
 *   "overlay" — fixed 전체 화면 dimmed overlay (app/loading.tsx 용)
 *   "inline"  — 기존 영역 내부 로더
 *
 * mode:
 *   "default" — CHUNGWOO LEAGUE
 *   "admin"   — ADMIN MODE
 */

type TennisBallLoaderProps = {
  label?: string;
  mode?: "default" | "admin";
  variant?: "overlay" | "inline";
};

export default function TennisBallLoader({
  label,
  mode = "default",
  variant = "inline",
}: TennisBallLoaderProps) {
  const eyebrow = mode === "admin" ? "ADMIN MODE" : "CHUNGWOO LEAGUE";
  const message =
    label ??
    (mode === "admin"
      ? "관리자 데이터를 불러오는 중입니다"
      : "데이터를 불러오는 중입니다");

  const ball = (
    <div className="cw-loader-ball-wrap" aria-hidden="true">
      <div className="cw-tennis-ball">
        <svg
          className="cw-tennis-ball-svg"
          viewBox="0 0 64 64"
          aria-hidden="true"
        >
          <path
            d="M 20 -6 C 8 8, 8 56, 20 70"
            fill="none"
            stroke="rgba(255,255,255,0.82)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M 44 -6 C 56 8, 56 56, 44 70"
            fill="none"
            stroke="rgba(255,255,255,0.82)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="cw-tennis-ball-shadow" />
    </div>
  );

  const text = (
    <>
      <p className="cw-loader-eyebrow">{eyebrow}</p>
      <p className="cw-loader-message">{message}</p>
    </>
  );

  if (variant === "overlay") {
    return (
      <div
        className="cw-loader-overlay"
        role="status"
        aria-label={`${eyebrow} — ${message}`}
      >
        <div className="cw-loader-card">
          {ball}
          {text}
        </div>
      </div>
    );
  }

  return (
    <div
      className="cw-loader-wrap"
      role="status"
      aria-label={`${eyebrow} — ${message}`}
    >
      {ball}
      {text}
    </div>
  );
}
