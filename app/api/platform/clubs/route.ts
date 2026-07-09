import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { recordPlatformAuditLog } from "@/lib/platform-audit-log";

const RESERVED_SLUGS = new Set([
  "admin", "center-court", "demo", "api", "login",
  "matches", "members", "ranking", "attendance",
  "mypage", "point-history",
]);

function requireAdmin(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return null;
}

function ownerOnly(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

// GET /api/platform/clubs — all clubs (any platform admin)
export async function GET() {
  const session = await getPlatformAdminSession();
  const deny = requireAdmin(session);
  if (deny) return deny;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, slug, description, status, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ clubs: data });
}

// POST /api/platform/clubs — create club (owner only)
export async function POST(req: NextRequest) {
  const session = await getPlatformAdminSession();
  const deny = ownerOnly(session);
  if (deny) return deny;

  let name: string | undefined;
  let slug: string | undefined;
  let description: string | undefined;

  try {
    const body = await req.json();
    name = typeof body.name === "string" ? body.name.trim() : undefined;
    slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : undefined;
    description = typeof body.description === "string" ? body.description.trim() || undefined : undefined;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
  if (RESERVED_SLUGS.has(slug))
    return NextResponse.json({ error: "slug_reserved" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("clubs")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "slug_taken" }, { status: 409 });

  const { data, error } = await supabase
    .from("clubs")
    .insert({ name, slug, description: description ?? null, status: "active" })
    .select("id, name, slug, description, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  await recordPlatformAuditLog(session!, {
    action:      "club.create",
    targetType:  "club",
    targetId:    data.id,
    targetLabel: `${data.name} (/c/${data.slug})`,
    clubId:      data.id,
    metadata:    { name: data.name, slug: data.slug, description: data.description },
  });

  return NextResponse.json({ club: data }, { status: 201 });
}
