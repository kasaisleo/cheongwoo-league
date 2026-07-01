// components/common/TennisBallLoader.tsx

type TennisBallLoaderProps = {
  label?: string;
  mode?: "default" | "admin";
};

export default function TennisBallLoader({
  label,
  mode = "default",
}: TennisBallLoaderProps) {
  const eyebrow = mode === "admin" ? "ADMIN MODE" : "CHUNGWOO LEAGUE";
  const message =
    label ??
    (mode === "admin"
      ? "관리자 데이터를 불러오는 중입니다"
      : "데이터를 불러오는 중입니다");

  return (
    <div className="cw-loader-wrap">
      <div className="cw-loader-ball-wrap" aria-hidden="true">
        <div className="cw-tennis-ball">
          <svg
            className="cw-tennis-ball-svg"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            {/* Left seam: 실제 테니스공처럼 공 바깥에서 안쪽으로 감기는 곡선 */}
            <path
              d="M 20 -6 C 8 8, 8 56, 20 70"
              fill="none"
              stroke="rgba(255,255,255,0.82)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            {/* Right seam: 반대쪽 패널 경계 */}
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

      <p className="cw-loader-eyebrow">{eyebrow}</p>
      <p className="cw-loader-message">{message}</p>
    </div>
  );
}
