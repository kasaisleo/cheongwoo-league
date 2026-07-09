import { requirePlatformAdmin } from "@/lib/platform-admin-session";
import { CenterCourtShell } from "./CenterCourtShell";

export default async function CenterCourtProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();

  return <CenterCourtShell session={session}>{children}</CenterCourtShell>;
}
