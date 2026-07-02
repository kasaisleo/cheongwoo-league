import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function AuthLinkLayout({ children }: { children: React.ReactNode }) {
  // 회원 연결 승인은 admin/manager도 가능.
  // 단, auth-link 내부의 permission_role 변경은 API(/api/admin/update-member-role)에서 isOwner로 별도 차단.
  await requireAdminAccess();
  return <>{children}</>;
}
