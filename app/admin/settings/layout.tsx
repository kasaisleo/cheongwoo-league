import { requireOwnerAccess } from "@/lib/admin-permissions";

/**
 * /admin/settings 레이아웃 — Owner 전용.
 * requireOwnerAccess()가 비Owner를 /admin으로 redirect.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerAccess();
  return <>{children}</>;
}
