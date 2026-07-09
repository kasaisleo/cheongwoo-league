import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function checkAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// GET: Vercel cron 호출용 (Authorization: Bearer CRON_SECRET)
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}

// POST: 수동 트리거용 (동일하게 CRON_SECRET 필요)
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}

async function runCleanup() {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("demo_entities")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
