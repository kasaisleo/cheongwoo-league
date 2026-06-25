import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { MemberList } from "@/components/member/MemberList";
import { isAdminSession } from "@/lib/admin-auth";
import type { MemberWithStats } from "@/lib/supabase/database.types";

export default async function MembersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("member_stats")
    .select("*")
    .eq("is_active", true)
    .order("league_point", { ascending: false })
    .order("nickname");

  const members = (data ?? []) as MemberWithStats[];
  const isAdmin = isAdminSession();

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Members
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">회원 관리</h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/members/import">
              <Button size="md" variant="ghost">
                명단 가져오기
              </Button>
            </Link>
          )}
          <Link href="/members/new">
            <Button size="md">+ 회원 등록</Button>
          </Link>
        </div>
      </header>

      <MemberList members={members} isAdmin={isAdmin} />
    </main>
  );
}
