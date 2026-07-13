import { redirect } from "next/navigation";

/**
 * /members/import — 레거시 경로.
 *
 * 실제 구현은 /admin/members/import로 이전했다(원래도 Admin 대시보드
 * "관리 도구"에서만 진입하는 Owner 전용 기능이었다) — 여기서는 호환을
 * 위해 리다이렉트만 수행한다.
 */
export default function LegacyMemberImportPage() {
  redirect("/admin/members/import");
}
