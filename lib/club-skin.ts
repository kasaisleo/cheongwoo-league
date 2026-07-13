/**
 * lib/club-skin.ts — 클럽 스킨 registry.
 *
 * 스킨 결정 흐름:
 *   clubs.skin_key (DB) → getClubSkin() → ClubSkin
 *
 * slug는 URL 식별자일 뿐 스킨을 결정하지 않는다.
 * 새 스킨 추가: SKINS에 항목 추가 + SkinKey 유니온 확장 (migration 불필요).
 *
 * CSS 변수 범위:
 *   - :root (globals.css) — 기본값, 글로벌 컴포넌트(BottomTabBar 등)에 적용
 *   - :root:has([data-club-skin="namaste"]) — 나마스테 활성 시 :root 오버라이드
 *   - [data-club-skin] wrapper inline style — 해당 스킨 layout 내 컴포넌트에 적용
 */

export type SkinKey = "default" | "cheongwoo" | "namaste";

export interface TeamLabels {
  A: string;
  B: string;
}

export interface ClubLogos {
  /** 밝은 배경(크림 등)에 사용 — namaste 기본 페이지 배경 */
  primary: string;
  /** 어두운 배경에 사용 */
  inverse: string;
}

export interface ClubSkin {
  key: SkinKey;
  teamLabels: TeamLabels;
  /** 로고 정의. 없으면 텍스트 클럽명 표시. */
  logos?: ClubLogos;
  /**
   * layout.tsx가 [data-club-skin] wrapper에 inline style로 주입하는 CSS 변수.
   * globals.css의 :root 정의와 동일한 키를 사용한다.
   */
  cssVars: Record<string, string>;
}

const SKINS: Record<SkinKey, ClubSkin> = {
  default: {
    key: "default",
    teamLabels: { A: "A팀", B: "B팀" },
    cssVars: {
      "--club-bg":             "#0B1929",  // line-25
      "--club-surface":        "#0E1F33",  // line-50
      "--club-surface-strong": "#142943",  // line-100
      "--club-primary":        "#D4FF3D",  // clay-400
      "--club-primary-dark":   "#C2EB1F",  // clay-500
      "--club-primary-soft":   "rgba(212,255,61,0.1)",
      "--club-text":           "#FFFFFF",  // line-900
      "--club-muted":          "#7C92AC",  // line-500
      "--club-border":         "rgba(30,58,92,0.5)",
      "--club-card-radius":    "14px",
      "--club-button-radius":  "6px",
      "--club-shadow":         "0 1px 2px 0 rgba(0,0,0,0.4)",
      // ── Form Control 시맨틱 토큰 (A-1) ──────────────────────────
      // 값은 기존 line-*/clay-* Tailwind 클래스가 실제로 렌더링하던 hex/rgba를
      // 그대로 이식했다 — 픽셀 변화 없이 색상 소스만 CSS 변수로 교체하기 위함.
      "--control-bg":             "#0E1F33",              // line-50
      "--control-bg-disabled":    "rgba(30,58,92,0.4)",   // line-200/40 (기존 disabled select와 동일)
      "--control-text":           "#FFFFFF",              // line-900
      "--control-placeholder":    "#5C7596",              // line-400
      "--control-border":         "rgba(30,58,92,0.4)",   // line-200/40
      "--control-border-hover":   "rgba(30,58,92,0.6)",
      "--control-border-focus":   "#D4FF3D",              // clay-400
      "--control-focus-ring":     "rgba(212,255,61,0.35)",
      "--control-selected-bg":    "#D4FF3D",              // clay-400 (solid)
      "--control-selected-text":  "#0B1929",              // line-25
      "--control-muted-bg":       "rgba(30,58,92,0.3)",   // line-200/30
      "--control-danger-border":  "#FF5C72",              // fault-400 (스킨 무관 고정)
    },
  },

  cheongwoo: {
    key: "cheongwoo",
    teamLabels: { A: "청팀", B: "우팀" },
    cssVars: {
      "--club-bg":             "#0B1929",
      "--club-surface":        "#0E1F33",
      "--club-surface-strong": "#142943",
      "--club-primary":        "#D4FF3D",
      "--club-primary-dark":   "#C2EB1F",
      "--club-primary-soft":   "rgba(212,255,61,0.1)",
      "--club-text":           "#FFFFFF",
      "--club-muted":          "#7C92AC",
      "--club-border":         "rgba(30,58,92,0.5)",
      "--club-card-radius":    "14px",
      "--club-button-radius":  "6px",
      "--club-shadow":         "0 1px 2px 0 rgba(0,0,0,0.4)",
      "--control-bg":             "#0E1F33",
      "--control-bg-disabled":    "rgba(30,58,92,0.4)",
      "--control-text":           "#FFFFFF",
      "--control-placeholder":    "#5C7596",
      "--control-border":         "rgba(30,58,92,0.4)",
      "--control-border-hover":   "rgba(30,58,92,0.6)",
      "--control-border-focus":   "#D4FF3D",
      "--control-focus-ring":     "rgba(212,255,61,0.35)",
      "--control-selected-bg":    "#D4FF3D",
      "--control-selected-text":  "#0B1929",
      "--control-muted-bg":       "rgba(30,58,92,0.3)",
      "--control-danger-border":  "#FF5C72",
    },
  },

  namaste: {
    key: "namaste",
    teamLabels: { A: "A팀", B: "B팀" },
    logos: {
      primary: "/club-skins/namaste/logo-primary.png",
      inverse: "/club-skins/namaste/logo-inverse.png",
    },
    cssVars: {
      "--club-bg":             "#F7F1E7",
      "--club-surface":        "#FFFDF8",
      "--club-surface-strong": "#F0EADE",
      "--club-primary":        "#65258F",
      "--club-primary-dark":   "#4A1870",
      "--club-primary-soft":   "#EAD9F5",
      "--club-text":           "#281B2F",
      "--club-muted":          "#766C78",
      "--club-border":         "#D9C8E3",
      "--club-card-radius":    "22px",
      "--club-button-radius":  "9999px",
      "--club-shadow":         "0 2px 8px 0 rgba(101,37,143,0.08)",
      // ── Form Control 시맨틱 토큰 (A-1) — warm ivory / deep plum / muted lavender / violet
      "--control-bg":             "#FFFDF8",              // warm ivory
      "--control-bg-disabled":    "#F0EADE",
      "--control-text":           "#281B2F",              // deep plum
      "--control-placeholder":    "#766C78",
      "--control-border":         "#D9C8E3",              // muted lavender
      "--control-border-hover":   "rgba(101,37,143,0.4)",
      "--control-border-focus":   "#65258F",              // violet
      "--control-focus-ring":     "rgba(101,37,143,0.35)",
      "--control-selected-bg":    "#65258F",              // plum (solid)
      "--control-selected-text":  "#FFFDF8",              // ivory
      "--control-muted-bg":       "#F0EADE",
      "--control-danger-border":  "#FF5C72",
    },
  },
};

/**
 * DB의 skin_key 값으로 ClubSkin을 반환한다.
 * 알 수 없는 skin_key는 default로 폴백한다.
 */
export function getClubSkin(skinKey: string): ClubSkin {
  return SKINS[skinKey as SkinKey] ?? SKINS.default;
}
