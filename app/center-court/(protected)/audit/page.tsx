import { createServiceClient } from "@/lib/supabase/server";
import { AuditLogPageClient } from "./AuditLogPageClient";

export const dynamic = "force-dynamic";

export interface AuditLogRow {
  id: string;
  admin_username: string;
  admin_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  club_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function getInitialLogs(): Promise<AuditLogRow[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("platform_audit_logs")
    .select(
      "id, admin_username, admin_role, action, target_type, target_id, " +
      "target_label, club_id, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as AuditLogRow[];
}

export default async function AuditLogPage() {
  const logs = await getInitialLogs();
  return <AuditLogPageClient initialLogs={logs} />;
}
