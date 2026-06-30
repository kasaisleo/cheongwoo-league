import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { MemberList } from "@/components/member/MemberList";
import { getAdminRole } from "@/lib/admin-auth";
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
  // 일괄 임포트는 owner 전용(Step 8-3) — 버튼도 owner에게만 보여준다.
  // 서버 컴포넌트라 useAdminRole()(클라이언트 훅) 대신 getAdminRole()을
  // 직접 호출한다. 이건 UI 표시 분기일 뿐, /api/members/import/* 의
  // requireRole("owner") 서버 검증은 그대로다 — 변경하지 않았다.
  const isOwner = getAdminRole() === "owner";

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-clay-400">
            Members
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">회원 관리</h1>
        </div>
        <div className="flex gap-2">
          {isOwner && (
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

      <MemberList members={members} />
    </main>
  );
}
