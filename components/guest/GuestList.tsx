import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConvertGuestButton } from "@/components/guest/ConvertGuestButton";
import type { GuestWithStats, Member } from "@/lib/supabase/database.types";

type GuestWithReferrer = GuestWithStats & {
  referrer: Pick<Member, "nickname"> | null;
  converted_member: Pick<Member, "nickname"> | null;
};

interface GuestListProps {
  mode: "public" | "admin";
}

/**
 * GuestList — 공용 게스트 목록 컴포넌트.
 *
 * mode="public" : 기존 /guests 화면 (디자인 유지)
 * mode="admin"  : /admin/guests — 관리자 디자인 언어 적용 + 수정 액션
 *
 * 데이터: guest_stats 뷰 (기존 쿼리 그대로)
 */
export async function GuestList({ mode }: GuestListProps) {
  const supabase = createClient();
  const isAdmin = mode === "admin";

  const { data } = await supabase
    .from("guest_stats")
    .select(
      "*, referrer:members!guests_referred_by_fkey(nickname), converted_member:members!guests_converted_to_member_id_fkey(nickname)"
    )
    .order("visit_date", { ascending: false });

  const guests = (data ?? []) as unknown as GuestWithReferrer[];

  if (mode === "admin") {
    return <AdminGuestList guests={guests} />;
  }

  return <PublicGuestList guests={guests} isAdmin={false} />;
}

// ── 관리자 게스트 목록 ──────────────────────────────────────────────
function AdminGuestList({ guests }: { guests: GuestWithReferrer[] }) {
  return (
    <>
      {guests.length === 0 ? (
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            No Guests
          </p>
          <p className="mt-1 text-sm text-line-500">등록된 게스트가 없어요.</p>
          <Link href="/guests/new"
            className="mt-3 inline-block rounded-sm border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400">
            첫 게스트 등록 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {guests.map((guest) => (
            <div key={guest.id}
              className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">

              {/* 상단 — 날짜 + 전환 여부 */}
              <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
                <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
                  {guest.visit_date}
                </span>
                {guest.converted_to_member_id ? (
                  <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[9px] font-semibold text-line-500">
                    정회원 전환됨
                  </span>
                ) : (
                  <span className="rounded-sm border border-clay-400/30 bg-clay-400/5 px-2 py-0.5 text-[9px] font-semibold text-clay-400">
                    게스트
                  </span>
                )}
              </div>

              {/* 본문 */}
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="name-kr-sm text-line-900">{guest.name}</p>
                    <p className="mt-0.5 text-xs text-line-500">
                      {[
                        guest.age !== null && `${guest.age}세`,
                        guest.years_playing !== null && `구력 ${guest.years_playing}년`,
                        guest.phone,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {(guest.wins > 0 || guest.losses > 0) && (
                      <p className="mt-0.5 font-display text-[10px] font-bold tabular-nums text-line-500">
                        {guest.wins}W {guest.losses}L · {guest.win_rate}%
                      </p>
                    )}
                    {guest.referrer && (
                      <p className="mt-0.5 text-[11px] text-line-400">
                        소개: {guest.referrer.nickname}
                      </p>
                    )}
                    {guest.notes && (
                      <p className="mt-1 text-[11px] text-line-400">{guest.notes}</p>
                    )}
                  </div>

                  {/* 재초청/매너 */}
                  <div className="flex flex-col items-end gap-1">
                    {guest.manner_score !== null && (
                      <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[9px] font-semibold text-line-500">
                        매너 {guest.manner_score}/5
                      </span>
                    )}
                    {guest.reinvite !== null && (
                      <span className={`rounded-sm border px-2 py-0.5 text-[9px] font-semibold ${
                        guest.reinvite
                          ? "border-clay-400/40 bg-clay-400/10 text-clay-400"
                          : "border-line-200/40 text-line-500"
                      }`}>
                        {guest.reinvite ? "재초청 희망" : "재초청 보류"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 정회원 전환 버튼 (미전환 게스트만) */}
                {!guest.converted_to_member_id && (
                  <div className="mt-3">
                    <ConvertGuestButton
                      guestId={guest.id}
                      guestName={guest.name}
                      suggestedGrade={guest.skill_grade}
                      guestPhone={guest.phone}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── 공개 게스트 목록 (기존 /guests 유지) ───────────────────────────
function PublicGuestList({ guests, isAdmin }: { guests: GuestWithReferrer[]; isAdmin: boolean }) {
  if (guests.length === 0) {
    return (
      <div className="rounded-lg border border-line-200 bg-line-50 p-6 text-center text-sm text-line-400">
        등록된 게스트가 없어요.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {guests.map((guest) => (
        <div key={guest.id} className="rounded-lg border border-line-200 bg-line-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-line-900">{guest.name}</span>
            </div>
            <span className="text-xs text-line-400">{guest.visit_date}</span>
          </div>
          <p className="mt-1 text-xs text-line-500">
            {[
              guest.age !== null && `${guest.age}세`,
              guest.years_playing !== null && `구력 ${guest.years_playing}년`,
              guest.phone,
            ].filter(Boolean).join(" · ")}
          </p>
          {(guest.wins > 0 || guest.losses > 0) && (
            <p className="mt-1 text-xs text-line-500">
              {guest.wins}승 {guest.losses}패 · 승률 {guest.win_rate}%
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between text-xs text-line-500">
            <span>소개자: {guest.referrer?.nickname ?? "없음"}</span>
            <div className="flex items-center gap-2">
              {guest.manner_score !== null && <span>매너 {guest.manner_score}/5</span>}
              {guest.reinvite !== null && (
                <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold ${
                  guest.reinvite ? "text-clay-400" : "text-line-400"
                }`}>
                  {guest.reinvite ? "재초청 희망" : "재초청 보류"}
                </span>
              )}
            </div>
          </div>
          {guest.notes && <p className="mt-1.5 text-xs text-line-400">{guest.notes}</p>}
          {guest.converted_to_member_id ? (
            <p className="mt-2 text-xs font-semibold text-clay-400">
              ✓ 정회원으로 전환됨 ({guest.converted_member?.nickname ?? "회원"})
            </p>
          ) : (
            isAdmin && (
              <ConvertGuestButton
                guestId={guest.id}
                guestName={guest.name}
                suggestedGrade={guest.skill_grade}
                guestPhone={guest.phone}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}
