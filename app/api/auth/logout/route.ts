import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, ADMIN_CLUB_SLUG_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(ADMIN_CLUB_SLUG_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
