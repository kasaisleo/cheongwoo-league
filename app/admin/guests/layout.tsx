import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function AdminGuestsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
