import type { ReactNode } from "react";

/**
 * AdminGatewayShell — 클럽 미선택 / 미인증 상태 전용 neutral wrapper.
 *
 * 적용 조건: admin_club_slug 쿠키 없음 (로그인 게이트, 클럽 선택, 권한 없음).
 * AdminClubShell과 달리 club skin token 없음, AdminBottomNav 없음, AdminAccountBar 없음.
 *
 * 시각 언어:
 *   - 배경: neutral slate/blue-black (청우회 navy ≠, Center Court green ≠)
 *   - 텍스트: muted slate white
 *   - 카드/border: rgba(255,255,255,0.08) 투명 neutral
 */
export function AdminGatewayShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto min-h-dvh max-w-md font-body"
      style={{
        background: "linear-gradient(170deg, #08101c 0%, #050a12 100%)",
        color: "#d0d6e0",
      }}
    >
      {children}
    </div>
  );
}
