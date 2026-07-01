import { requireAdminAccess } from "@/lib/admin-permissions";

export default async function EditMatchLayout({ children }: { children: React.ReactNode }) {
  await requireAdminAccess();
  return <>{children}</>;
}
