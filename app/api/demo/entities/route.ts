import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE, DEMO_TTL_SECONDS } from "@/lib/demo-session";

async function lazyCleanup(supabase: ReturnType<typeof createServiceClient>) {
  await supabase
    .from("demo_entities")
    .delete()
    .lt("expires_at", new Date().toISOString());
}

export async function GET() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "데모 세션이 없습니다." }, { status: 401 });
  }

  const supabase = createServiceClient();
  await lazyCleanup(supabase);

  const { data, error } = await supabase
    .from("demo_entities")
    .select("*")
    .eq("demo_session_id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "데이터를 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json({ entities: data ?? [] });
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "데모 세션이 없습니다." }, { status: 401 });
  }

  let body: { entity_type: string; payload: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 잘못되었습니다." }, { status: 400 });
  }

  const { entity_type, payload } = body;
  const validTypes = ["club", "member", "match", "activity"];
  if (!entity_type || !validTypes.includes(entity_type)) {
    return NextResponse.json({ error: "entity_type이 유효하지 않습니다." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "payload가 필요합니다." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + DEMO_TTL_SECONDS * 1000).toISOString();
  const supabase = createServiceClient();
  await lazyCleanup(supabase);

  const { data: created, error } = await supabase
    .from("demo_entities")
    .insert({
      demo_session_id: sessionId,
      entity_type,
      payload,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !created) {
    return NextResponse.json({ error: "생성에 실패했습니다." }, { status: 500 });
  }

  // activity log
  if (entity_type !== "activity") {
    await supabase.from("demo_entities").insert({
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: `${entityLabel(entity_type)} 추가`,
        entity_type,
        entity_name: String(payload.name ?? payload.title ?? ""),
        timestamp: new Date().toISOString(),
      },
      expires_at: expiresAt,
    });
  }

  return NextResponse.json({ entity: created }, { status: 201 });
}

function entityLabel(type: string): string {
  const map: Record<string, string> = { club: "클럽", member: "회원", match: "경기" };
  return map[type] ?? type;
}
