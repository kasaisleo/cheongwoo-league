import { requirePlatformAdmin } from "@/lib/platform-admin-session";

export default async function CenterCourtProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return <div className="font-body">{children}</div>;
}
