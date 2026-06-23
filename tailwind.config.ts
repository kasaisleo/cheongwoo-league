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
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
