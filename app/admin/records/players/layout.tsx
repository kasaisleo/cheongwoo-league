import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function PlayerRecordsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
