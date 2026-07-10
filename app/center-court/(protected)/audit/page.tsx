import { createServiceClient } from "@/lib/supabase/server";
import { AuditLogPageClient } from "./AuditLogPageClient";

export const dynamic = "force-dynamic";

export interface AuditLogRow {
  id: string;
  platform_admin_username: string;
  platform_admin_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  club_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function getInitialLogs(): Promise<{ rows: AuditLogRow[]; dbError: string | null }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("platform_audit_logs")
      .select(
        "id, platform_admin_id, platform_admin_username, platform_admin_role, " +
        "action, target_type, target_id, target_label, club_id, metadata, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[audit-page] getInitialLogs failed", {
        message: error.message,
        details: error.details,
        hint:    error.hint,
        code:    error.code,
      });
      return { rows: [], dbError: error.message };
    }

    return { rows: (data ?? []) as unknown as AuditLogRow[], dbError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[audit-page] getInitialLogs threw", msg);
    return { rows: [], dbError: msg };
  }
}

export default async function AuditLogPage() {
  const { rows, dbError } = await getInitialLogs();
  return <AuditLogPageClient initialLogs={rows} dbError={dbError} />;
}
