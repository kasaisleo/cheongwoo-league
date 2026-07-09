import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashPlatformSessionToken } from "@/lib/platform-password";
import { PLATFORM_SESSION_COOKIE } from "@/lib/platform-auth";

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(PLATFORM_SESSION_COOKIE)?.value;

  if (rawToken) {
    const tokenHash = hashPlatformSessionToken(rawToken);
    const supabase = createServiceClient();
    // 세션 revoke (실패해도 쿠키는 삭제)
    await supabase
      .from("platform_admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
