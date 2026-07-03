import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import type { SessionStatus } from "@/lib/supabase/database.types";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

interface ArchiveSessionBody {
  sessionId: string;
  /** "closed"(마감) 또는 "archived"(보관). 기본값은 archived. */
  targetStatus?: SessionStatus;
}

export async function POST(request: NextRequest) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const body = (await request.json()) as ArchiveSessionBody;
  const { sessionId, targetStatus } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "세션 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const nextStatus: SessionStatus = targetStatus === "closed" ? "closed" : "archived";

  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from("attendance_sessions")
    .update({ status: nextStatus, closed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("club_id", CHEONGWOO_CLUB_ID);

  if (updateError) {
    return NextResponse.json(
      { error: nextStatus === "closed" ? "명단 확정에 실패했습니다." : "명단 보관에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
