import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";

// GET /api/platform/audit-logs
// Query params: limit (default 50, max 200), action, target_type, club_id, cursor (created_at ISO for pagination)
export async function GET(req: NextRequest) {
  const session = await getPlatformAdminSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const rawLimit   = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit      = Math.min(Math.max(rawLimit, 1), 200);
  const action     = searchParams.get("action")      ?? undefined;
  const targetType = searchParams.get("target_type") ?? undefined;
  const clubId     = searchParams.get("club_id")     ?? undefined;
  const cursor     = searchParams.get("cursor")      ?? undefined; // ISO timestamp, exclusive

  const supabase = createServiceClient();

  let query = supabase
    .from("platform_audit_logs")
    .select(
      "id, platform_admin_id, platform_admin_username, platform_admin_role, " +
      "action, target_type, target_id, target_label, club_id, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action)     query = query.eq("action",      action);
  if (targetType) query = query.eq("target_type", targetType);
  if (clubId)     query = query.eq("club_id",     clubId);
  if (cursor)     query = query.lt("created_at",  cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}
