import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminAccessServer } from "@/lib/admin-permissions";

const CHEONGWOO_CLUB_ID = "465ae133-893e-425d-a093-161f7654bd0d";

interface RouteParams { params: { id: string } }

/**
 * PUT /api/guests/[id] — 게스트 수정.
 * 허용: manager/admin/master/owner (isAdmin)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.isAdmin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await request.json() as {
    name?: string;
    phone?: string;
    age?: number | null;
    years_playing?: number | null;
    referred_by?: string | null;
    notes?: string | null;
    visit_date?: string;
  };

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const n = body.name.replace(/\s+/g, "").trim();
    if (!n) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    update.name = n;
  }
  if (body.phone !== undefined) {
    update.phone = body.phone ? body.phone.replace(/\D/g, "") || null : null;
  }
  if (body.age !== undefined)           update.age = body.age;
  if (body.years_playing !== undefined) update.years_playing = body.years_playing;
  if (body.referred_by !== undefined)   update.referred_by = body.referred_by;
  if (body.notes !== undefined)         update.notes = body.notes?.trim() || null;
  if (body.visit_date !== undefined)    update.visit_date = body.visit_date;

  const supabase = createServiceClient();
  const { error } = await supabase.from("guests").update(update).eq("id", params.id).eq("club_id", CHEONGWOO_CLUB_ID);

  if (error) return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/guests/[id] — 게스트 비활성화 (is_active = false).
 * 허용: master/owner (isOwner)
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const access = await getAdminAccessServer();
  if (!access.isOwner) {
    return NextResponse.json({ error: "master/owner 권한이 필요합니다." }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("guests")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("club_id", CHEONGWOO_CLUB_ID);

  if (error) return NextResponse.json({ error: "비활성화에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
