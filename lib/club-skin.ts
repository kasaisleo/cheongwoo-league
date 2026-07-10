/**
 * lib/club-skin.ts — 클럽 스킨 registry.
 *
 * 스킨 결정 흐름:
 *   clubs.skin_key (DB) → getClubSkin() → ClubSkin
 *
 * slug는 URL 식별자일 뿐 스킨을 결정하지 않는다.
 * 새 스킨 추가: SKINS에 항목 추가 + SkinKey 유니온 확장 (migration 불필요).
 */

export type SkinKey = "default" | "cheongwoo" | "namaste";

export interface TeamLabels {
  A: string;
  B: string;
}

export interface ClubSkin {
  key: SkinKey;
  teamLabels: TeamLabels;
  /** layout.tsx가 data-club-skin wrapper에 인라인 style로 주입하는 CSS 변수 */
  cssVars: {
    "--club-accent": string;
    "--club-bg": string;
    "--club-surface": string;
    "--club-text": string;
    "--club-muted": string;
  };
}

const SKINS: Record<SkinKey, ClubSkin> = {
  default: {
    key: "default",
    teamLabels: { A: "A팀", B: "B팀" },
    cssVars: {
      "--club-accent":  "#D4FF3D", // clay-400
      "--club-bg":      "#0B1929", // line-25
      "--club-surface": "#0E1F33", // line-50
      "--club-text":    "#FFFFFF", // line-900
      "--club-muted":   "#7C92AC", // line-500
    },
  },
  cheongwoo: {
    key: "cheongwoo",
    teamLabels: { A: "청팀", B: "우팀" },
    cssVars: {
      "--club-accent":  "#D4FF3D",
      "--club-bg":      "#0B1929",
      "--club-surface": "#0E1F33",
      "--club-text":    "#FFFFFF",
      "--club-muted":   "#7C92AC",
    },
  },
  namaste: {
    key: "namaste",
    teamLabels: { A: "A팀", B: "B팀" },
    cssVars: {
      "--club-accent":  "#D4FF3D",
      "--club-bg":      "#0B1929",
      "--club-surface": "#0E1F33",
      "--club-text":    "#FFFFFF",
      "--club-muted":   "#7C92AC",
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
