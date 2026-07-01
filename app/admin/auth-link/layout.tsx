import { requireOwnerAccess } from "@/lib/admin-permissions";

export default async function AuthLinkLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerAccess();
  return <>{children}</>;
}
