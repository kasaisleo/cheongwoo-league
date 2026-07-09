import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEMO_SESSION_COOKIE,
  DEMO_TTL_SECONDS,
  generateDemoSessionId,
} from "@/lib/demo-session";

async function seedDemoData(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  expiresAt: string
) {
  const clubId1 = crypto.randomUUID();
  const clubId2 = crypto.randomUUID();

  const now = new Date().toISOString();

  const rows = [
    // clubs
    {
      id: clubId1,
      demo_session_id: sessionId,
      entity_type: "club",
      payload: {
        name: "CHEONGWOO SAMPLE",
        slug: "cheongwoo-demo",
        status: "active",
        description: "Demo club for platform showcase",
      },
      expires_at: expiresAt,
    },
    {
      id: clubId2,
      demo_session_id: sessionId,
      entity_type: "club",
      payload: {
        name: "NAMASTE SAMPLE",
        slug: "namaste-demo",
        status: "active",
        description: "Second demo club",
      },
      expires_at: expiresAt,
    },
    // members
    {
      demo_session_id: sessionId,
      entity_type: "member",
      payload: {
        name: "이후승 Demo",
        club_id: clubId1,
        club_name: "CHEONGWOO SAMPLE",
        role: "master",
        is_active: true,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "member",
      payload: {
        name: "김나윤 Demo",
        club_id: clubId1,
        club_name: "CHEONGWOO SAMPLE",
        role: "admin",
        is_active: true,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "member",
      payload: {
        name: "박서브 Demo",
        club_id: clubId1,
        club_name: "CHEONGWOO SAMPLE",
        role: "manager",
        is_active: true,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "member",
      payload: {
        name: "최랠리 Demo",
        club_id: clubId2,
        club_name: "NAMASTE SAMPLE",
        role: "member",
        is_active: true,
      },
      expires_at: expiresAt,
    },
    // matches
    {
      demo_session_id: sessionId,
      entity_type: "match",
      payload: {
        title: "Mixed Doubles",
        club_id: clubId1,
        club_name: "CHEONGWOO SAMPLE",
        score: "6-4, 7-5",
        status: "completed",
        type: "doubles",
        played_at: "2026-07-01",
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "match",
      payload: {
        title: "Singles Ladder",
        club_id: clubId1,
        club_name: "CHEONGWOO SAMPLE",
        score: "6-3, 6-1",
        status: "completed",
        type: "singles",
        played_at: "2026-07-05",
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "match",
      payload: {
        title: "Sunday League",
        club_id: clubId2,
        club_name: "NAMASTE SAMPLE",
        score: "7-6, 4-6, 6-4",
        status: "completed",
        type: "doubles",
        played_at: "2026-07-06",
      },
      expires_at: expiresAt,
    },
    // activity log
    {
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: "데모 세션 시작",
        entity_type: "session",
        entity_name: "SUPER MATCH Demo",
        timestamp: now,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: "클럽 생성",
        entity_type: "club",
        entity_name: "CHEONGWOO SAMPLE",
        timestamp: now,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: "클럽 생성",
        entity_type: "club",
        entity_name: "NAMASTE SAMPLE",
        timestamp: now,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: "회원 추가 · master 배정",
        entity_type: "member",
        entity_name: "이후승 Demo",
        timestamp: now,
      },
      expires_at: expiresAt,
    },
    {
      demo_session_id: sessionId,
      entity_type: "activity",
      payload: {
        action: "경기 기록",
        entity_type: "match",
        entity_name: "Sunday League",
        timestamp: now,
      },
      expires_at: expiresAt,
    },
  ];

  await supabase.from("demo_entities").insert(rows);
}

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const sessionId = generateDemoSessionId();
  const expiresAt = new Date(Date.now() + DEMO_TTL_SECONDS * 1000).toISOString();

  const supabase = createServiceClient();
  await seedDemoData(supabase, sessionId, expiresAt);

  const response = NextResponse.redirect(new URL("/demo", origin));
  response.cookies.set(DEMO_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: DEMO_TTL_SECONDS,
    path: "/",
  });
  return response;
}
