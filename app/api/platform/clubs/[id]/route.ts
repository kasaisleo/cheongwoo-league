import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { recordPlatformAuditLog } from "@/lib/platform-audit-log";

const RESERVED_SLUGS = new Set([
  "admin", "center-court", "demo", "api", "login",
  "matches", "members", "ranking", "attendance",
  "mypage", "point-history",
]);

function ownerOnly(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

// PATCH /api/platform/clubs/[id] — update name/description/slug/status (owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getPlatformAdminSession();
  const deny = ownerOnly(session);
  if (deny) return deny;

  const { id } = params;

  let name: string | undefined;
  let slug: string | undefined;
  let description: string | null | undefined;
  let status: string | undefined;

  try {
    const body = await req.json();
    if (typeof body.name === "string") name = body.name.trim();
    if (typeof body.slug === "string") slug = body.slug.trim().toLowerCase();
    if (body.description !== undefined)
      description = typeof body.description === "string"
        ? body.description.trim() || null
        : null;
    if (typeof body.status === "string") status = body.status;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (slug !== undefined) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
    if (RESERVED_SLUGS.has(slug))
      return NextResponse.json({ error: "slug_reserved" }, { status: 400 });
  }

  if (status !== undefined && !["active", "inactive"].includes(status))
    return NextResponse.json({ error: "status_invalid" }, { status: 400 });

  const supabase = createServiceClient();

  // Fetch current state for before/after diff in audit
  const { data: before } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status")
    .eq("id", id)
    .maybeSingle() as { data: { id: string; name: string; slug: string; description: string | null; status: string } | null };

  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (slug !== undefined) {
    const { data: existing } = await supabase
      .from("clubs")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  if (name        !== undefined) patch.name        = name;
  if (slug        !== undefined) patch.slug        = slug;
  if (description !== undefined) patch.description = description;
  if (status      !== undefined) patch.status      = status;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const { data, error } = await supabase
    .from("clubs")
    .update(patch)
    .eq("id", id)
    .select("id, name, slug, description, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  // Build before/after diff — only include fields that actually changed
  const changedFields: string[] = [];
  const beforeSnap: Record<string, unknown> = {};
  const afterSnap:  Record<string, unknown> = {};

  for (const key of Object.keys(patch) as Array<keyof typeof before>) {
    const prev = before[key];
    const next = patch[key as string];
    if (prev !== next) {
      changedFields.push(key as string);
      beforeSnap[key as string] = prev;
      afterSnap[key as string]  = next;
    }
  }

  // Determine action: status-only change vs general update
  const isStatusOnly = changedFields.length > 0 &&
    changedFields.every(f => f === "status");
  const action = isStatusOnly ? "club.status_change" : "club.update";

  await recordPlatformAuditLog(session!, {
    action,
    targetType:  "club",
    targetId:    data.id,
    targetLabel: `${data.name} (/c/${data.slug})`,
    clubId:      data.id,
    metadata: {
      changed_fields: changedFields,
      before: beforeSnap,
      after:  afterSnap,
    },
  });

  return NextResponse.json({ club: data });
}
