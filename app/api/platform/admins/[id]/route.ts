import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { createPlatformPasswordHash } from "@/lib/platform-password";
import { recordPlatformAuditLog } from "@/lib/platform-audit-log";

const SAFE_FIELDS =
  "id, username, display_name, role, status, last_login_at, created_at, updated_at";

// PATCH /api/platform/admins/[id] — display_name, role, status, password 변경 (owner 전용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getPlatformAdminSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const targetId = params.id;
  if (!targetId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 현재 대상 어드민 조회 (before snapshot용 display_name 포함)
  const { data: target, error: fetchErr } = await supabase
    .from("platform_admins")
    .select("id, role, status, username, display_name")
    .eq("id", targetId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 본인 계정 비활성화 금지
  if (body.status === "inactive" && targetId === session.adminId) {
    return NextResponse.json({ error: "cannot_deactivate_self" }, { status: 400 });
  }

  // 본인 계정 role 강등 금지 (owner → admin)
  if (body.role === "admin" && targetId === session.adminId && target.role === "owner") {
    return NextResponse.json({ error: "cannot_demote_self" }, { status: 400 });
  }

  // 마지막 owner 보호
  if (body.status === "inactive" || body.role === "admin") {
    if (target.role === "owner") {
      const { count } = await supabase
        .from("platform_admins")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .eq("status", "active");

      if ((count ?? 0) <= 1) {
        if (body.status === "inactive")
          return NextResponse.json({ error: "last_owner_cannot_be_deactivated" }, { status: 400 });
        if (body.role === "admin")
          return NextResponse.json({ error: "last_owner_cannot_be_demoted" }, { status: 400 });
      }
    }
  }

  // 업데이트할 필드 조립
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.display_name === "string") {
    updates.display_name = body.display_name.trim() || null;
  }
  if (typeof body.role === "string") {
    if (!["owner", "admin"].includes(body.role))
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    updates.role = body.role;
  }
  if (typeof body.status === "string") {
    if (!["active", "inactive"].includes(body.status))
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    updates.status = body.status;

    // 비활성화 시 기존 세션 revoke
    if (body.status === "inactive") {
      await supabase
        .from("platform_admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("admin_id", targetId)
        .is("revoked_at", null);
    }
  }
  if (typeof body.password === "string") {
    if (body.password.length < 8)
      return NextResponse.json({ error: "password_too_short" }, { status: 400 });
    updates.password_hash = await createPlatformPasswordHash(body.password);
  }

  const { data, error } = await supabase
    .from("platform_admins")
    .update(updates)
    .eq("id", targetId)
    .select(SAFE_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  // ── Audit logging ──────────────────────────────────────
  // Determine action type: password_reset > status_change > update
  const isPasswordReset = typeof body.password === "string";
  const isStatusChange  = typeof body.status === "string" && !isPasswordReset;
  const auditAction = isPasswordReset
    ? "platform_admin.password_reset"
    : isStatusChange
      ? "platform_admin.status_change"
      : "platform_admin.update";

  // Build before/after diff (never include password)
  const changedFields: string[] = [];
  const beforeSnap: Record<string, unknown> = {};
  const afterSnap:  Record<string, unknown> = {};

  if (!isPasswordReset) {
    const watchFields = ["display_name", "role", "status"] as const;
    for (const key of watchFields) {
      const prev = (target as Record<string, unknown>)[key];
      const next = updates[key];
      if (next !== undefined && prev !== next) {
        changedFields.push(key);
        beforeSnap[key] = prev;
        afterSnap[key]  = next;
      }
    }
  }

  const metadata = isPasswordReset
    ? { note: "password hash rotated" }
    : { changed_fields: changedFields, before: beforeSnap, after: afterSnap };

  await recordPlatformAuditLog(session, {
    action:      auditAction,
    targetType:  "platform_admin",
    targetId:    targetId,
    targetLabel: target.username,
    metadata,
  });

  return NextResponse.json({ admin: data });
}
