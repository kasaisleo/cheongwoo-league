import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import { recordPlatformAuditLog } from "@/lib/platform-audit-log";

const OPERATOR_ROLES = new Set(["master", "admin", "manager"]);
const ALLOWED_ROLES  = ["master", "admin", "manager", "member"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

const ROLE_ORDER: Record<string, number> = {
  master: 0, admin: 1, manager: 2, scorer: 3, member: 4,
};

function requireAdmin(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return null;
}

function ownerOnly(session: Awaited<ReturnType<typeof getPlatformAdminSession>>) {
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

// GET /api/platform/clubs/[id]/operators
// Returns all active members of the club, sorted by role priority then name.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getPlatformAdminSession();
  const deny = requireAdmin(session);
  if (deny) return deny;

  const { id: clubId } = params;

  const supabase = createServiceClient();

  // Verify club exists
  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) return NextResponse.json({ error: "club_not_found" }, { status: 404 });

  type MemberRow = {
    id: string; name: string; nickname: string; phone: string | null;
    permission_role: string; auth_user_id: string | null;
    kakao_provider_id: string | null; is_active: boolean;
    is_dormant: boolean; deleted_at: string | null; club_id: string;
  };

  const { data: membersRaw, error } = await supabase
    .from("members")
    .select(
      "id, name, nickname, phone, permission_role, auth_user_id, " +
      "kakao_provider_id, is_active, is_dormant, deleted_at, club_id"
    )
    .eq("club_id", clubId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  const members = (membersRaw ?? []) as unknown as MemberRow[];

  // Sort by role priority then name
  const sorted = members.sort((a, b) => {
    const ra = ROLE_ORDER[a.permission_role] ?? 99;
    const rb = ROLE_ORDER[b.permission_role] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ko");
  });

  // Mask phone: show first 3 + last 4 digits
  const safe = sorted.map((m) => ({
    ...m,
    phone: m.phone ? maskPhone(m.phone) : null,
  }));

  const roleCounts = {
    master:  safe.filter(m => m.permission_role === "master").length,
    admin:   safe.filter(m => m.permission_role === "admin").length,
    manager: safe.filter(m => m.permission_role === "manager").length,
    member:  safe.filter(m => !OPERATOR_ROLES.has(m.permission_role)).length,
  };

  return NextResponse.json({ club, members: safe, roleCounts });
}

// PATCH /api/platform/clubs/[id]/operators
// Body: { memberId: string, role: AllowedRole }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getPlatformAdminSession();
  const deny = ownerOnly(session);
  if (deny) return deny;

  const { id: clubId } = params;

  let memberId: string | undefined;
  let newRole: string | undefined;
  try {
    const body = await req.json();
    memberId = typeof body.memberId === "string" ? body.memberId : undefined;
    newRole  = typeof body.role    === "string" ? body.role    : undefined;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!memberId) return NextResponse.json({ error: "memberId_required" }, { status: 400 });
  if (!newRole || !(ALLOWED_ROLES as readonly string[]).includes(newRole))
    return NextResponse.json({ error: "role_invalid" }, { status: 400 });

  const supabase = createServiceClient();

  type PatchMemberRow = {
    id: string; name: string; permission_role: string;
    auth_user_id: string | null; is_active: boolean;
    is_dormant: boolean; deleted_at: string | null; club_id: string;
  };

  // Fetch target member — cross-club guard is club_id === clubId
  const { data: memberRaw } = await supabase
    .from("members")
    .select("id, name, permission_role, auth_user_id, is_active, is_dormant, deleted_at, club_id")
    .eq("id", memberId)
    .maybeSingle();

  const member = memberRaw as unknown as PatchMemberRow | null;

  if (!member) return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  if (member.club_id !== clubId)
    return NextResponse.json({ error: "club_mismatch" }, { status: 403 });
  if (member.deleted_at)
    return NextResponse.json({ error: "member_deleted" }, { status: 400 });

  // Inactive block for operator roles
  if (!member.is_active && OPERATOR_ROLES.has(newRole))
    return NextResponse.json({ error: "inactive_member" }, { status: 400 });

  // auth_user_id block for operator roles
  if (!member.auth_user_id && OPERATOR_ROLES.has(newRole))
    return NextResponse.json({ error: "unlinked_member" }, { status: 400 });

  // Last master protection
  if (member.permission_role === "master" && newRole !== "master") {
    const { count } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("permission_role", "master")
      .is("deleted_at", null);

    if ((count ?? 0) <= 1)
      return NextResponse.json({ error: "last_master" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("members")
    .update({ permission_role: newRole as AllowedRole })
    .eq("id", memberId)
    .select("id, name, permission_role")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  // Fetch club label for audit
  const { data: clubRow } = await supabase
    .from("clubs").select("name, slug").eq("id", clubId).maybeSingle();
  const clubLabel = clubRow ? `${(clubRow as { name: string }).name} (/c/${(clubRow as { slug: string }).slug})` : clubId;

  await recordPlatformAuditLog(session!, {
    action:      "club.operator_role_change",
    targetType:  "club_member",
    targetId:    memberId,
    targetLabel: member.name,
    clubId,
    metadata: {
      club:     clubLabel,
      member:   member.name,
      from:     member.permission_role,
      to:       newRole,
    },
  });

  return NextResponse.json({ member: updated });
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return digits.slice(0, 3) + "-****-" + digits.slice(-4);
}
