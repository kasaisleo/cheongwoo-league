/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 시그니처 액센트 — ATP 특유의 일렉트릭 옐로우 (1위, 승리, CTA)
        clay: {
          50: "#FAFCE8",
          100: "#F2F9BD",
          200: "#E7F583",
          300: "#DEFA4D",
          400: "#D4FF3D",
          500: "#C2EB1F",
          600: "#9CC014",
          700: "#76930F",
        },
        // 보조 액센트 — 스카이/시안 (서브 정보, 코트 컬러)
        court: {
          50: "#E9F7FB",
          100: "#C9EDF6",
          200: "#8FDBED",
          400: "#2BB8DC",
          500: "#1496BD",
          600: "#0E7794",
          700: "#0A5A70",
        },
        // 베이스 — 딥 네이비 (배경/카드/텍스트)
        line: {
          25: "#0B1929",
          50: "#0E1F33",
          100: "#142943",
          200: "#1E3A5C",
          300: "#2C4F78",
          400: "#5C7596",
          500: "#7C92AC",
          600: "#9AAEC4",
          700: "#C2D2E2",
          800: "#DCE6F0",
          900: "#FFFFFF",
        },
        fault: {
          50: "#3A1820",
          400: "#FF5C72",
          500: "#FF3B57",
        },
        amber: {
          400: "#FFB13D",
          500: "#F59B1C",
        },

        // ── Step 15-2 ATP 스타일 시맨틱 토큰 ──────────────────────────────
        //
        // win: 승리 / 상승 / 긍정 결과
        //   DEFAULT = 중간 채도 그린, 시안 레퍼런스의 oklch(0.62 0.14 155)와 동일 계열
        //   muted   = 행 배경 강조용 (투명도 처리는 Tailwind /N 슬래시로)
        win: {
          DEFAULT: "#2EA86B",   // 승리 그린
          foreground: "#E8FFF5",
          muted: "#1A3D2B",     // 배경 강조용 (bg-win-muted)
        },
        // loss: 패배 / 하락 / 부정 결과
        //   fault-400(#FF5C72)과 같은 계열을 명시적으로 "결과" 의미로 별칭
        loss: {
          DEFAULT: "#FF5C72",   // 패배 레드 (fault-400과 동일 값, 의미적 구분)
          foreground: "#FFF0F2",
          muted: "#3A1820",     // fault-50과 동일 값
        },
        // wimbledon: 윔블던 시즌 오버레이용 다크 그린
        //   기본 스타일에는 사용하지 않고, 시즌 테마 적용 시에만 활성화
        wimbledon: {
          DEFAULT: "#1A5C3A",
          light: "#236B47",
          foreground: "#E8F5EE",
        },
        // gold: Championship Gold — 1위/트로피/최상위 강조
        //   clay-400(#D4FF3D, 일렉트릭 옐로우)과 구분되는 클래식 골드
        gold: {
          DEFAULT: "#D4B84A",
          foreground: "#1A1400",
          muted: "#2A2410",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        score: ["var(--font-score)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "14px",
        xl: "20px",
        sm: "6px",    // Step 15-2 추가: 배지/pip 전용 소형 radius
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
