import { requireAdminAccess } from "@/lib/admin-permissions";

/**
 * /admin/attendance 레이아웃 — 서버에서 관리자 권한 체크.
 * requireAdminAccess()가 비관리자를 /admin으로 redirect.
 */
export default async function AdminAttendanceLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
