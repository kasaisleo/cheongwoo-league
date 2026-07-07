import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberList } from "@/components/member/MemberList";
import { getAdminRole } from "@/lib/admin-auth";
import type { MemberWithStats } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

export default async function MembersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnUrl=/members");

  const currentClubId = await getCurrentClubId();
  const { data } = await supabase
    .from("member_stats")
    .select("*")
    .eq("is_active", true)
    .eq("club_id", currentClubId)
    .order("league_point", { ascending: false })
    .order("nickname");

  const members = (data ?? []) as MemberWithStats[];
  const isOwner = getAdminRole() === "owner";
  const isAdmin = getAdminRole() !== null;

  return (
    <main className="px-4 pt-6 pb-28">
      {/* ── 페이지 헤더 ─────────────────────────────────── */}
      <header className="mb-5">
        <p className="eyebrow-en text-clay-400">Club Roster</p>
        <h1 className="headline-kr text-4xl text-line-900">선수 명단</h1>
      </header>

      {/* ── 운영진 관리 버튼 — 헤더에서 분리, compact 처리 ── */}
      {isAdmin && (
        <div className="mb-4 flex items-center justify-end gap-2">
          {isOwner && (
            <Link
              href="/members/import"
              className="rounded-sm border border-line-200/40 px-2.5 py-1 text-xs font-semibold text-line-500 transition-colors hover:border-line-300 hover:text-line-700"
            >
              명단 가져오기
            </Link>
          )}
          <Link
            href="/members/new"
            className="rounded-sm border border-clay-400/60 px-2.5 py-1 text-xs font-semibold text-clay-400 transition-colors hover:border-clay-400 hover:bg-clay-400/5"
          >
            + 회원 등록
          </Link>
        </div>
      )}

      <MemberList members={members} />
    </main>
  );
}
