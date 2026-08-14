import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ConvertGuestButton } from "@/components/guest/ConvertGuestButton";
import { GuestAdminActions } from "@/components/guest/GuestAdminActions";
import type { MemberGrade } from "@/lib/supabase/database.types";
import { normalizePublicGuestRow, type PublicGuestListRow, type RawPublicGuestListRow } from "@/lib/public-guest";
import { buildMatchRecord } from "@/lib/match-stats";

/**
 * Admin 게스트 목록 row. guests 원본을 service-role로 직접 조회해 필요한
 * 필드만 선택하고, win_rate는 wins/losses로 서버에서 계산, 소개자 닉네임은
 * 별도 배치 조회로 붙인다. 전환 회원 닉네임은 실제 렌더에 쓰이지 않아
 * 조회하지 않는다.
 */
interface AdminGuestRow {
  id: string;
  name: string;
  visit_date: string;
  phone: string | null;
  age: number | null;
  years_playing: number | null;
  wins: number;
  losses: number;
  notes: string | null;
  skill_grade: MemberGrade | null;
  referred_by: string | null;
  converted_to_member_id: string | null;
  is_active: boolean;
  win_rate: number;
  /** 2A-8D-4: winner_team=D 참여 수. win_rate 분모에 포함된다. */
  draws: number;
  referrer: { nickname: string } | null;
}

interface GuestListProps {
  mode: "public" | "admin";
  /** caller가 validate한 club.id. 이 값으로만 쿼리 — getCurrentClubId() 금지. */
  clubId: string;
  /** mode="admin"일 때만 사용. 호출부(page.tsx)가 getAdminAccessServer()를
   *  이미 실행했다면 그 결과를 그대로 전달 — 여기서 중복 호출하지 않는다. */
  canEdit?: boolean;
  canDeactivate?: boolean;
}

export async function GuestList({ mode, clubId, canEdit = false, canDeactivate = false }: GuestListProps) {
  // Public과 Admin은 데이터 소스(RPC vs guests 원본 직접 조회)와 반환 컬럼이
  // 완전히 다르므로, state/타입을 공유하지 않고 분기 자체를 완전히 분리한다.
  if (mode === "public") {
    return <PublicGuestListContainer clubId={clubId} />;
  }
  return <AdminGuestListContainer clubId={clubId} canEdit={canEdit} canDeactivate={canDeactivate} />;
}

// ── Public ───────────────────────────────────────────────────────────
// Public은 phone/notes/referred_by 등을 포함하지 않는 최소 projection만
// 반환하는 get_public_guest_list RPC(0038)만 사용한다.
async function PublicGuestListContainer({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("get_public_guest_list", { p_club_id: clubId })
    .order("visit_date", { ascending: false });

  if (error) {
    console.error("[GuestList] get_public_guest_list RPC 조회 실패:", error.code, error.message);
  }
  // 2A-8D-4: RPC 경계 정규화(0067 적용 전 응답 호환).
  const guests: PublicGuestListRow[] = (data ?? []).map((r: RawPublicGuestListRow) => normalizePublicGuestRow(r));

  return <PublicGuestList guests={guests} />;
}

// ── Admin ────────────────────────────────────────────────────────────
async function AdminGuestListContainer({
  clubId,
  canEdit,
  canDeactivate,
}: {
  clubId: string;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const admin = createServiceClient();

  // 관리자 모드에서는 비활성 게스트도 표시(상태 확인용) — is_active 필터 없음.
  const { data: guestRows, error } = await admin
    .from("guests")
    .select(
      "id, name, visit_date, phone, age, years_playing, wins, losses, notes, skill_grade, referred_by, converted_to_member_id, is_active"
    )
    .eq("club_id", clubId)
    .order("visit_date", { ascending: false });

  if (error) {
    // 조회 실패가 "게스트 0명"으로 위장되지 않도록 별도 오류 상태로 분리한다.
    console.error("[GuestList] guests 조회 실패:", error.code, error.message);
    return <AdminGuestList guests={[]} canEdit={canEdit} canDeactivate={canDeactivate} loadError />;
  }

  // 2A-8D-4: 무승부 수는 matches에서 파생한다(guests에 draws 컬럼을 두지 않는다).
  // 게스트마다 조회하면 N+1이므로, club scope의 winner_team=D Match를 한 번만
  // 읽고 게스트 슬롯 4개를 순회해 guestId → drawCount map을 만든다.
  // event_game_id는 보지 않는다 — legacy·Event-linked 무승부를 모두 포함한다.
  const drawByGuest = new Map<string, number>();
  {
    const { data: drawRows, error: drawError } = await admin
      .from("matches")
      .select("id, team_a_player1_guest, team_a_player2_guest, team_b_player1_guest, team_b_player2_guest")
      .eq("club_id", clubId)
      .eq("winner_team", "D");
    if (drawError) {
      console.error("[GuestList] 무승부 집계 실패:", drawError.code, drawError.message);
      return <AdminGuestList guests={[]} canEdit={canEdit} canDeactivate={canDeactivate} loadError />;
    }
    for (const m of drawRows ?? []) {
      // 한 Match에 같은 게스트가 여러 슬롯에 있어도 Match당 1무만 센다.
      const ids = new Set(
        [m.team_a_player1_guest, m.team_a_player2_guest, m.team_b_player1_guest, m.team_b_player2_guest]
          .filter((id): id is string => id !== null)
      );
      for (const id of ids) drawByGuest.set(id, (drawByGuest.get(id) ?? 0) + 1);
    }
  }

  const referrerIds = [...new Set((guestRows ?? []).map((g) => g.referred_by).filter((id): id is string => id !== null))];
  const referrerMap = new Map<string, string>();
  if (referrerIds.length > 0) {
    const { data: referrerRows, error: referrerError } = await admin
      .from("members")
      .select("id, nickname")
      .in("id", referrerIds)
      .eq("club_id", clubId);

    if (referrerError) {
      // 소개자 닉네임 조회 실패는 게스트 목록 자체를 막지 않는다 — 목록은 유지하고
      // 서버에만 기록한다(PII 없음, error code/message만).
      console.error("[GuestList] 소개자 members 조회 실패:", referrerError.code, referrerError.message);
    } else {
      for (const m of referrerRows ?? []) referrerMap.set(m.id, m.nickname);
    }
  }

  const guests: AdminGuestRow[] = (guestRows ?? []).map((g) => ({
    ...g,
    draws: drawByGuest.get(g.id) ?? 0,
    // 2A-8D-4: 승률 정의는 buildMatchRecord 하나로만 계산한다(DB 0067과 동일 식).
    // 표시 자릿수(소수 1자리)는 기존 스타일을 유지한다.
    win_rate: Math.round(buildMatchRecord(g.wins, g.losses, drawByGuest.get(g.id) ?? 0).winRate * 10) / 10,
    referrer: g.referred_by && referrerMap.has(g.referred_by)
      ? { nickname: referrerMap.get(g.referred_by)! }
      : null,
  }));

  return <AdminGuestList guests={guests} canEdit={canEdit} canDeactivate={canDeactivate} />;
}

// ── 관리자 목록 ──────────────────────────────────────────────────────
function AdminGuestList({
  guests,
  canEdit,
  canDeactivate,
  loadError = false,
}: {
  guests: AdminGuestRow[];
  canEdit: boolean;
  canDeactivate: boolean;
  loadError?: boolean;
}) {
  const active = guests.filter((g) => g.is_active !== false);
  const inactive = guests.filter((g) => g.is_active === false);

  if (loadError) {
    return (
      <div className="rounded-[14px] border border-fault-400/40 bg-fault-400/5 p-8 text-center">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-fault-400">Load Failed</p>
        <p className="mt-1 text-sm text-line-500">게스트 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-8 text-center">
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">No Guests</p>
        <p className="mt-1 text-sm text-line-500">등록된 게스트가 없어요.</p>
        <Link href="/admin/guests/new"
          className="mt-3 inline-block rounded-sm border border-clay-400/60 px-3 py-1.5 text-xs font-semibold text-clay-400">
          첫 게스트 등록 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 활성 게스트 */}
      {active.length > 0 && (
        <section>
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Active Guests <span className="ml-1 text-line-400">({active.length})</span>
          </p>
          <div className="space-y-3">
            {active.map((guest) => (
              <AdminGuestCard
                key={guest.id}
                guest={guest}
                canEdit={canEdit}
                canDeactivate={canDeactivate}
              />
            ))}
          </div>
        </section>
      )}

      {/* 비활성 게스트 */}
      {inactive.length > 0 && (
        <section>
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-400">
            Inactive <span className="ml-1">({inactive.length})</span>
          </p>
          <div className="space-y-3 opacity-60">
            {inactive.map((guest) => (
              <AdminGuestCard
                key={guest.id}
                guest={guest}
                canEdit={canEdit}
                canDeactivate={false}  // 이미 비활성
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminGuestCard({
  guest,
  canEdit,
  canDeactivate,
}: {
  guest: AdminGuestRow;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const isInactive = guest.is_active === false;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
      {/* 상단 */}
      <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-score text-[10px] font-bold tabular-nums text-line-500">
            {guest.visit_date}
          </span>
          {isInactive && (
            <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-400">
              비활성
            </span>
          )}
          {guest.converted_to_member_id && (
            <span className="rounded-sm border border-line-200/40 bg-line-100 px-1.5 py-0.5 text-[9px] font-semibold text-line-500">
              정회원 전환됨
            </span>
          )}
        </div>
        {/* 수정/비활성화 액션 — 클라이언트 컴포넌트 */}
        {!isInactive && (canEdit || canDeactivate) && (
          <GuestAdminActions
            guestId={guest.id}
            guestName={guest.name}
            guestPhone={guest.phone}
            guestAge={guest.age}
            guestYearsPlaying={guest.years_playing}
            guestReferredBy={guest.referred_by}
            guestNotes={guest.notes}
            guestVisitDate={guest.visit_date}
            canEdit={canEdit}
            canDeactivate={canDeactivate}
          />
        )}
      </div>

      {/* 본문 */}
      <div className="px-4 py-3">
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
        {guest.referrer ? (
          <p className="mt-0.5 text-[11px] text-line-400">소개: {guest.referrer.nickname}</p>
        ) : guest.referred_by ? (
          <p className="mt-0.5 text-[11px] text-line-400 opacity-60">소개자 정보 확인 불가</p>
        ) : null}
        {guest.notes && (
          <p className="mt-1 text-[11px] text-line-400">{guest.notes}</p>
        )}

        {/* 정회원 전환 */}
        {!guest.converted_to_member_id && !isInactive && (
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
  );
}

// ── 공개 목록 (기존 /guests 유지) ────────────────────────────────────
// get_public_guest_list RPC(0038) 결과만 받는다 — phone/notes/referred_by/
// age/years_playing/skill_grade/manner_score/소개자·전환회원 닉네임은
// 애초에 데이터에 없으므로 렌더할 수 없다.
function PublicGuestList({ guests }: { guests: PublicGuestListRow[] }) {
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
            <span className="text-sm font-semibold text-line-900">{guest.name}</span>
            <span className="text-xs text-line-400">{guest.visit_date}</span>
          </div>
          {(guest.wins > 0 || guest.losses > 0) && (
            <p className="mt-1 text-xs text-line-500">
              {guest.wins}승 {guest.losses}패 · 승률 {guest.win_rate}%
            </p>
          )}
          {guest.is_converted && (
            <p className="mt-2 text-xs font-semibold text-clay-400">
              ✓ 정회원으로 전환됨
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
