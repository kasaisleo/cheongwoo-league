import { requirePlatformAdminAccess } from "@/lib/platform-auth";

export default async function CenterCourtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdminAccess();

  return <div className="font-body">{children}</div>;
}
