import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge, gradeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Guest, Member } from "@/lib/supabase/database.types";

type GuestWithReferrer = Guest & { referrer: Pick<Member, "nickname"> | null };

export default async function GuestsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("guests")
    .select("*, referrer:members!guests_referred_by_fkey(nickname)")
    .order("visit_date", { ascending: false });

  const guests = (data ?? []) as unknown as GuestWithReferrer[];

  return (
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Guests
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">게스트 관리</h1>
        </div>
        <Link href="/guests/new">
          <Button size="md">+ 게스트 등록</Button>
        </Link>
      </header>

      {guests.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          등록된 게스트가 없어요.
        </Card>
      ) : (
        <div className="space-y-2">
          {guests.map((guest) => (
            <Card key={guest.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-line-900">{guest.name}</span>
                  {guest.skill_grade && (
                    <Badge tone={gradeTone(guest.skill_grade)}>{guest.skill_grade}</Badge>
                  )}
                </div>
                <span className="text-xs text-line-400">{guest.visit_date}</span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-xs text-line-500">
                <span>소개자: {guest.referrer?.nickname ?? "없음"}</span>
                <div className="flex items-center gap-2">
                  {guest.manner_score !== null && <span>매너 {guest.manner_score}/5</span>}
                  {guest.reinvite !== null && (
                    <Badge tone={guest.reinvite ? "court" : "fault"}>
                      {guest.reinvite ? "재초청 희망" : "재초청 보류"}
                    </Badge>
                  )}
                </div>
              </div>

              {guest.notes && <p className="mt-1.5 text-xs text-line-400">{guest.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
