import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function AdminMembersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
