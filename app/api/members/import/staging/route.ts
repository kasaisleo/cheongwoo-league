import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/admin-auth";

/** staging_members 전체를 조회한다. imported 상태도 포함해서 보여준다(이미 반영된 것 구분용). */
export async function GET() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "운영진 인증이 필요합니다." }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("staging_members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}
