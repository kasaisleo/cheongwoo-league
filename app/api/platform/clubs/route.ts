import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { recordPlatformAuditLog } from "@/lib/platform-audit-log";

/**
 * 플랫폼 마스터(레오) auth.users UUID — 신규 클럽 생성 시 자동으로 master로
 * 등록된다. 서버 전용 환경변수(NEXT_PUBLIC_ 아님, Vercel 프로덕션 환경변수로
 * 별도 설정 필요) — 클라이언트 입력·요청 body·URL 파라미터·React 코드에는
 * 절대 두지 않는다. create_club_with_master RPC에만 인자로 전달된다.
 */
const PLATFORM_MASTER_AUTH_USER_ID = process.env.PLATFORM_MASTER_AUTH_USER_ID;

interface CreateClubWithMasterResult {
  club_id: string;
  name: string;
  slug: string;
  master: { member_id: string; action: "created" | "promoted" | "noop"; name: string; nickname: string };
}

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
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug))
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

  if (!PLATFORM_MASTER_AUTH_USER_ID) {
    console.error("platform_club_create misconfigured: PLATFORM_MASTER_AUTH_USER_ID env var not set");
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // 클럽 생성 + 기본 설정(컬럼 default) + 최초 master 등록을 create_club_
  // with_master RPC 하나(=단일 트랜잭션) 안에서 원자적으로 처리한다 —
  // 여기서 INSERT 후 별도로 RPC를 호출하면 같은 요청이어도 서로 다른
  // 트랜잭션이라 중간 실패 시 master 없는 클럽만 남을 수 있기 때문이다.
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_club_with_master", {
    p_name: name,
    p_slug: slug,
    p_description: description ?? null,
    p_master_auth_user_id: PLATFORM_MASTER_AUTH_USER_ID,
  });

  if (rpcError) {
    if (rpcError.message?.startsWith("PLATFORM_CLUB_SLUG_TAKEN")) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    console.error("platform_club_create failed", {
      code: rpcError.code,
      message: rpcError.message,
      hint: rpcError.hint,
    });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const result = rpcData as CreateClubWithMasterResult;
  const club = {
    id: result.club_id,
    name: result.name,
    slug: result.slug,
    description: description ?? null,
    status: "active" as const,
  };

  await recordPlatformAuditLog(session!, {
    action:      "club.create",
    targetType:  "club",
    targetId:    club.id,
    targetLabel: `${club.name} (/c/${club.slug})`,
    clubId:      club.id,
    metadata:    { name: club.name, slug: club.slug, description: club.description },
  });

  await recordPlatformAuditLog(session!, {
    action:      "club.master_bootstrap",
    targetType:  "club_member",
    targetId:    result.master.member_id,
    targetLabel: result.master.name,
    clubId:      club.id,
    metadata: {
      club: `${club.name} (/c/${club.slug})`,
      member: result.master.name,
      bootstrap_action: result.master.action,
    },
  });

  return NextResponse.json({ club }, { status: 201 });
}
