import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE, DEMO_TTL_SECONDS } from "@/lib/demo-session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "데모 세션이 없습니다." }, { status: 401 });
  }

  let body: { payload: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 세션 소유권 확인
  const { data: existing } = await supabase
    .from("demo_entities")
    .select("id, entity_type, payload, expires_at")
    .eq("id", params.id)
    .eq("demo_session_id", sessionId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "엔티티를 찾을 수 없습니다." }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + DEMO_TTL_SECONDS * 1000).toISOString();

  const { data: updated, error } = await supabase
    .from("demo_entities")
    .update({
      payload: { ...(existing.payload as object), ...body.payload },
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }

  // activity log
  const entityName = String(
    (updated.payload as Record<string, unknown>).name ??
      (updated.payload as Record<string, unknown>).title ??
      ""
  );
  await supabase.from("demo_entities").insert({
    demo_session_id: sessionId,
    entity_type: "activity",
    payload: {
      action: `${entityLabel(existing.entity_type)} 수정`,
      entity_type: existing.entity_type,
      entity_name: entityName,
      timestamp: new Date().toISOString(),
    },
    expires_at: expiresAt,
  });

  return NextResponse.json({ entity: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "데모 세션이 없습니다." }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("demo_entities")
    .select("id, entity_type, payload")
    .eq("id", params.id)
    .eq("demo_session_id", sessionId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "엔티티를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabase
    .from("demo_entities")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + DEMO_TTL_SECONDS * 1000).toISOString();
  const entityName = String(
    (existing.payload as Record<string, unknown>).name ??
      (existing.payload as Record<string, unknown>).title ??
      ""
  );
  await supabase.from("demo_entities").insert({
    demo_session_id: sessionId,
    entity_type: "activity",
    payload: {
      action: `${entityLabel(existing.entity_type)} 삭제`,
      entity_type: existing.entity_type,
      entity_name: entityName,
      timestamp: new Date().toISOString(),
    },
    expires_at: expiresAt,
  });

  return NextResponse.json({ ok: true });
}

function entityLabel(type: string): string {
  const map: Record<string, string> = { club: "클럽", member: "회원", match: "경기" };
  return map[type] ?? type;
}
