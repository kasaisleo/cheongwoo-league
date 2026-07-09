import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { createPlatformPasswordHash } from "@/lib/platform-password";

const SAFE_FIELDS =
  "id, username, display_name, role, status, last_login_at, created_at, updated_at";

function ownerOnly(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

// GET /api/platform/admins — platform_admins 목록 (owner 전용)
export async function GET() {
  const session = await getPlatformAdminSession();
  const deny = ownerOnly(session);
  if (deny) return deny;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("platform_admins")
    .select(SAFE_FIELDS)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  return NextResponse.json({ admins: data });
}

// POST /api/platform/admins — 신규 관리자 생성 (owner 전용)
export async function POST(req: NextRequest) {
  const session = await getPlatformAdminSession();
  const deny = ownerOnly(session);
  if (deny) return deny;

  let username: string | undefined;
  let displayName: string | undefined;
  let password: string | undefined;
  let role: string | undefined;

  try {
    const body = await req.json();
    username = typeof body.username === "string" ? body.username.trim() : undefined;
    displayName = typeof body.display_name === "string" ? body.display_name.trim() || undefined : undefined;
    password = typeof body.password === "string" ? body.password : undefined;
    role = typeof body.role === "string" ? body.role : undefined;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!username) return NextResponse.json({ error: "username_required" }, { status: 400 });
  if (!password || password.length < 8)
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  if (!role || !["owner", "admin"].includes(role))
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });

  const passwordHash = await createPlatformPasswordHash(password);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("platform_admins")
    .insert({
      username,
      display_name: displayName ?? null,
      password_hash: passwordHash,
      role,
      status: "active",
    })
    .select(SAFE_FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ admin: data }, { status: 201 });
}
