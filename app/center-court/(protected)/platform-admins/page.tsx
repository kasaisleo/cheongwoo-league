import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import PlatformAdminsPageClient from "./PlatformAdminsPageClient";

export const dynamic = "force-dynamic";

const SAFE_FIELDS =
  "id, username, display_name, role, status, last_login_at, created_at, updated_at";

export default async function PlatformAdminsPage() {
  const session = await getPlatformAdminSession();

  // (protected) layout에서 이미 requirePlatformAdmin() 실행됨.
  // 여기서는 owner 전용 추가 검증.
  if (!session || session.role !== "owner") {
    notFound();
  }

  const supabase = createServiceClient();
  const { data: admins } = await supabase
    .from("platform_admins")
    .select(SAFE_FIELDS)
    .order("created_at", { ascending: true });

  return (
    <PlatformAdminsPageClient
      initialAdmins={admins ?? []}
      currentAdminId={session.adminId}
    />
  );
}
