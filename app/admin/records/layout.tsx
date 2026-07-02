import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function RecordsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
