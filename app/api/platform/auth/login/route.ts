import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPlatformPassword,
  createPlatformSessionToken,
  hashPlatformSessionToken,
} from "@/lib/platform-password";
import {
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE,
} from "@/lib/platform-auth";

const INVALID = { error: "invalid_credentials" } as const;

export async function POST(req: NextRequest) {
  let username: string | undefined;
  let password: string | undefined;

  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username.trim() : undefined;
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // username 조회
  const { data: admin, error } = await supabase
    .from("platform_admins")
    .select("id, password_hash, status, role, display_name")
    .eq("username", username)
    .maybeSingle();

  // username 없음 / DB 오류 / status inactive / 비밀번호 틀림 → 모두 동일한 401
  if (error || !admin) {
    return NextResponse.json(INVALID, { status: 401 });
  }

  if (admin.status !== "active") {
    return NextResponse.json(INVALID, { status: 401 });
  }

  const passwordOk = await verifyPlatformPassword(password, admin.password_hash);
  if (!passwordOk) {
    return NextResponse.json(INVALID, { status: 401 });
  }

  // 세션 생성
  const rawToken = createPlatformSessionToken();
  const tokenHash = hashPlatformSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + PLATFORM_SESSION_MAX_AGE * 1000).toISOString();

  const { error: insertError } = await supabase
    .from("platform_admin_sessions")
    .insert({ admin_id: admin.id, token_hash: tokenHash, expires_at: expiresAt });

  if (insertError) {
    return NextResponse.json({ error: "session_error" }, { status: 500 });
  }

  // last_login_at 갱신 (실패해도 로그인 자체는 허용)
  await supabase
    .from("platform_admins")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", admin.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLATFORM_SESSION_MAX_AGE,
  });
  return res;
}
