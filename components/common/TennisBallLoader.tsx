/**
 * TennisBallLoader — 청우회 리그 브랜드 로딩 컴포넌트.
 *
 * variant="inline"
 *   - 자체 full-screen 없음. 부모(app/loading.tsx의 <main>)가 중앙 정렬 담당.
 *   - 내부 박스(공 + 텍스트)만 렌더링.
 *
 * variant="overlay"
 *   - 클라이언트 컴포넌트의 저장/삭제/업데이트 처리 중에만 사용.
 *   - Next.js loading.tsx 사용 금지.
 */

type TennisBallLoaderProps = {
  label?: string;
  mode?: "default" | "admin";
  variant?: "inline" | "overlay";
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

  const inner = (
    <div className="flex w-full flex-col items-center justify-center text-center"
      role="status"
      aria-label={`${eyebrow} — ${message}`}>
      {/* 공 */}
      <div className="cw-loader-ball-wrap" aria-hidden="true">
        <div className="cw-tennis-ball">
          <svg className="cw-tennis-ball-svg" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M 20 -6 C 8 8, 8 56, 20 70" fill="none"
              stroke="rgba(255,255,255,0.82)" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M 44 -6 C 56 8, 56 56, 44 70" fill="none"
              stroke="rgba(255,255,255,0.82)" strokeWidth="3.4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="cw-tennis-ball-shadow" />
      </div>
      {/* 텍스트 */}
      <p className="cw-loader-eyebrow">{eyebrow}</p>
      <p className="cw-loader-message">{message}</p>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="cw-loader-overlay">
        <div className="cw-loader-card">{inner}</div>
      </div>
    );
  }

  /* inline — 부모가 중앙 정렬 담당, 여기서는 박스만 */
  return inner;
}
