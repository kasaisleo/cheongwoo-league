import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { ClubDetailPageClient } from "./ClubDetailPageClient";

export const dynamic = "force-dynamic";

/* ── Types ─────────────────────────────────────────────── */
export interface ClubDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  permission_role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  target_label: string | null;
  platform_admin_username: string;
  created_at: string;
}

export interface MatchStats {
  total: number;
  recent30d: number;
}

/* ── Data fetching ─────────────────────────────────────── */
const OPERATOR_ROLES = new Set(["master", "admin", "manager"]);
const since30dDate = () =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

async function fetchClubDetail(id: string) {
  const supabase = createServiceClient();

  // Phase 1 — parallel: club + members + audit logs
  const [clubRes, membersRes, auditRes] = await Promise.allSettled([
    supabase
      .from("clubs")
      .select("id, name, slug, description, status, created_at")
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("members")
      .select("id, name, permission_role, is_active, created_at")
      .eq("club_id", id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),

    supabase
      .from("platform_audit_logs")
      .select(
        "id, action, target_label, platform_admin_username, created_at"
      )
      .eq("club_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Club must exist
  if (clubRes.status === "rejected" || (clubRes.status === "fulfilled" && clubRes.value.error)) {
    const err = clubRes.status === "rejected" ? clubRes.reason : clubRes.value.error;
    console.error("[club-detail] clubs query failed", { id, error: err?.message ?? err });
  }
  const club =
    clubRes.status === "fulfilled" && !clubRes.value.error
      ? (clubRes.value.data as unknown as ClubDetail | null)
      : null;

  if (!club) return null; // caller will call notFound()

  if (membersRes.status === "rejected" || (membersRes.status === "fulfilled" && membersRes.value.error)) {
    const err = membersRes.status === "rejected" ? membersRes.reason : membersRes.value.error;
    console.error("[club-detail] members query failed", { id, error: err?.message ?? err });
  }
  const members =
    membersRes.status === "fulfilled" && !membersRes.value.error
      ? (membersRes.value.data as unknown as MemberSummary[])
      : null;

  if (auditRes.status === "rejected" || (auditRes.status === "fulfilled" && auditRes.value.error)) {
    const err = auditRes.status === "rejected" ? auditRes.reason : auditRes.value.error;
    console.error("[club-detail] audit query failed", { id, error: err?.message ?? err });
  }
  const audit =
    auditRes.status === "fulfilled" && !auditRes.value.error
      ? (auditRes.value.data as unknown as AuditEntry[])
      : null;

  // Phase 2 — match counts (requires member IDs)
  let matchStats: MatchStats | null = null;
  const memberIds = members?.map((m) => m.id) ?? [];

  if (memberIds.length > 0) {
    const ids = memberIds.join(",");
    const orFilter =
      `team_a_player1_member.in.(${ids}),` +
      `team_a_player2_member.in.(${ids}),` +
      `team_b_player1_member.in.(${ids}),` +
      `team_b_player2_member.in.(${ids})`;

    const [totalRes, recentRes] = await Promise.allSettled([
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(orFilter),

      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(orFilter)
        .gte("played_at", since30dDate()),
    ]);

    const totalCount =
      totalRes.status === "fulfilled" && !totalRes.value.error
        ? (totalRes.value.count ?? 0)
        : null;
    const recentCount =
      recentRes.status === "fulfilled" && !recentRes.value.error
        ? (recentRes.value.count ?? 0)
        : null;

    if (totalCount !== null && recentCount !== null) {
      matchStats = { total: totalCount, recent30d: recentCount };
    }
  } else {
    matchStats = { total: 0, recent30d: 0 };
  }

  return { club, members, audit, matchStats };
}

/* ── Page ──────────────────────────────────────────────── */
export default async function ClubDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [session, result] = await Promise.all([
    getPlatformAdminSession(),
    fetchClubDetail(params.id),
  ]);

  if (!result) notFound();

  const { club, members, audit, matchStats } = result;
  const isOwner = session?.role === "owner";

  return (
    <ClubDetailPageClient
      club={club}
      members={members}
      audit={audit}
      matchStats={matchStats}
      isOwner={isOwner}
    />
  );
}
