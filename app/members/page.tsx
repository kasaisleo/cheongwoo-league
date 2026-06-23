import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge, gradeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MemberWithStats } from "@/lib/supabase/database.types";

export default async function MembersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("member_stats")
    .select("*")
    .order("grade")
    .order("nickname");

  const members = (data ?? []) as MemberWithStats[];

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Members
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">회원 관리</h1>
        </div>
        <Link href="/members/new">
          <Button size="md">+ 회원 등록</Button>
        </Link>
      </header>

      {members.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          등록된 회원이 없어요. 첫 회원을 등록해보세요.
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <Link key={member.id} href={`/members/${member.id}`}>
              <Card className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={gradeTone(member.grade)}>{member.grade}</Badge>
                  <div>
                    <p className="text-sm font-semibold text-line-900">
                      {member.nickname}
                      {!member.is_active && (
                        <span className="ml-1 text-xs text-line-400">(비활성)</span>
                      )}
                    </p>
                    <p className="text-xs text-line-500">{member.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-score text-lg font-bold text-line-900">{member.rating}</p>
                  <p className="text-xs text-line-500">
                    {member.wins}승 {member.losses}패
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
