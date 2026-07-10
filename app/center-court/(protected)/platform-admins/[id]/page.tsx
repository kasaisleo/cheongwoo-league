import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { AdminDetailPageClient } from "./AdminDetailPageClient";

export const dynamic = "force-dynamic";

/* ── Types ─────────────────────────────────────────────── */
export interface AdminDetail {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target_type: string;
  target_label: string | null;
  club_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditStats {
  total: number;
  last24h: number;
  last30d: number;
  lastActivity: string | null;
  adminCreated: number;
  clubsTouched: number;
}

/* ── Data fetching ─────────────────────────────────────── */
const CLUB_ACTIONS = new Set([
  "club.create",
  "club.update",
  "club.status_change",
  "club.operator_role_change",
]);

async function fetchAdminDetail(id: string, currentAdminId: string) {
  const supabase = createServiceClient();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [adminRes, recentAuditRes, allAuditRes, ownerCountRes] =
    await Promise.allSettled([
      supabase
        .from("platform_admins")
        .select(
          "id, username, display_name, role, status, last_login_at, created_at, updated_at"
        )
        .eq("id", id)
        .maybeSingle(),

      supabase
        .from("platform_audit_logs")
        .select("id, action, target_type, target_label, club_id, metadata, created_at")
        .eq("platform_admin_id", id)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("platform_audit_logs")
        .select("id, action, club_id, created_at")
        .eq("platform_admin_id", id)
        .order("created_at", { ascending: false }),

      supabase
        .from("platform_admins")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .eq("status", "active"),
    ]);

  if (adminRes.status === "rejected" || adminRes.value.error) {
    const err = adminRes.status === "rejected" ? adminRes.reason : adminRes.value.error;
    console.error("[admin-detail] admin query failed", { id, error: (err as { message?: string })?.message ?? err });
  }
  const admin =
    adminRes.status === "fulfilled" && !adminRes.value.error
      ? (adminRes.value.data as unknown as AdminDetail | null)
      : null;

  if (!admin) return null;

  if (recentAuditRes.status === "rejected" || (recentAuditRes.status === "fulfilled" && recentAuditRes.value.error)) {
    const err = recentAuditRes.status === "rejected" ? recentAuditRes.reason : recentAuditRes.value.error;
    console.error("[admin-detail] recent audit query failed", { id, error: (err as { message?: string })?.message ?? err });
  }
  const recentAudit =
    recentAuditRes.status === "fulfilled" && !recentAuditRes.value.error
      ? (recentAuditRes.value.data as unknown as AuditLogEntry[])
      : null;

  if (allAuditRes.status === "rejected" || (allAuditRes.status === "fulfilled" && allAuditRes.value.error)) {
    const err = allAuditRes.status === "rejected" ? allAuditRes.reason : allAuditRes.value.error;
    console.error("[admin-detail] all audit query failed", { id, error: (err as { message?: string })?.message ?? err });
  }
  type StatRow = { id: string; action: string; club_id: string | null; created_at: string };
  const allAudit =
    allAuditRes.status === "fulfilled" && !allAuditRes.value.error
      ? (allAuditRes.value.data as unknown as StatRow[])
      : null;

  // Compute stats
  let auditStats: AuditStats | null = null;
  if (allAudit !== null) {
    const clubIds = new Set<string>();
    let adminCreated = 0;
    let last24hCount = 0;
    let last30dCount = 0;

    for (const row of allAudit) {
      if (row.created_at >= since24h) last24hCount++;
      if (row.created_at >= since30d) last30dCount++;
      if (row.action === "platform_admin.create") adminCreated++;
      if (CLUB_ACTIONS.has(row.action) && row.club_id) clubIds.add(row.club_id);
    }

    auditStats = {
      total:        allAudit.length,
      last24h:      last24hCount,
      last30d:      last30dCount,
      lastActivity: allAudit[0]?.created_at ?? null,
      adminCreated,
      clubsTouched: clubIds.size,
    };
  }

  const activeOwnerCount =
    ownerCountRes.status === "fulfilled" && !ownerCountRes.value.error
      ? (ownerCountRes.value.count ?? 0)
      : null;

  return { admin, recentAudit, auditStats, activeOwnerCount };
}

/* ── Page ──────────────────────────────────────────────── */
export default async function AdminDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getPlatformAdminSession();
  if (!session || session.role !== "owner") notFound();

  const result = await fetchAdminDetail(params.id, session.adminId);
  if (!result) notFound();

  const { admin, recentAudit, auditStats, activeOwnerCount } = result;

  return (
    <AdminDetailPageClient
      admin={admin}
      recentAudit={recentAudit}
      auditStats={auditStats}
      activeOwnerCount={activeOwnerCount}
      currentAdminId={session.adminId}
      currentAdminRole={session.role}
    />
  );
}
