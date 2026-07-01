import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function NewMemberLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
