import "server-only";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requirePublicClubBySlug } from "@/lib/public-club";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toPublicDisplayMatches } from "@/lib/match-display";
import { MATCH_SESSION_DAY_FILTERS, MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { memberPublicToken, resolveMemberByToken } from "@/lib/public-member-token";
import { EmptyState } from "@/components/ui/SectionHeader";
import { PublicShell, ClubPageHeader } from "@/components/shell";
import type { Member, SessionDay } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

interface MatchesPageProps {
  params: { slug: string };
  searchParams: { member?: string; sessionType?: string; showPlayers?: string };
}

const VALID_SESSION_TYPES: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];

function isValidSessionType(value: string | undefined): value is SessionDay {
  return value !== undefined && (VALID_SESSION_TYPES as string[]).includes(value);
}

function buildHref(slug: string, params: Record<string, string | undefined>) {
  const base = `/c/${slug}/matches`;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

export default async function ClubMatchesPage({ params, searchParams }: MatchesPageProps) {
  const { slug } = params;
  const club = await requirePublicClubBySlug(slug);
  const clubId = club.id;

  const supabase = createClient();
  const filterMemberToken = searchParams.member;
  const filterSessionType = isValidSessionType(searchParams.sessionType)
    ? searchParams.sessionType
    : null;
  const showPlayers = searchParams.showPlayers === "1";

  let sessionIdsForType: string[] | null = null;
  if (filterSessionType) {
    const { data: sessionRows } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("session_day", filterSessionType)
      .eq("club_id", clubId);
    sessionIdsForType = (sessionRows ?? []).map((s) => s.id);
  }

  // members는 anon/authenticated GRANT가 회수되어(0037) service-role로 조회한다.
  const supabaseService = createServiceClient();

  const { data: members } = await supabaseService
    .from("members")
    .select("id, name")
    .eq("is_active", true)
    .eq("club_id", clubId)
    .order("name");

  const memberList = (members ?? []) as Pick<Member, "id" | "name">[];
  // 토큰이 이 클럽 회원 목록 안에서 매칭되는 경우에만 실제 회원으로 취급한다.
  // 타 클럽 토큰이나 잘못된 토큰은 절대 "필터 없음"으로 되돌리지 않고, 아래에서
  // 명시적으로 빈 결과를 만든다.
  const selectedMember = filterMemberToken
    ? resolveMemberByToken(clubId, filterMemberToken, memberList)
    : undefined;
  const invalidMemberFilter = Boolean(filterMemberToken) && !selectedMember;

  // MATCH_SELECT_WITH_PLAYERS가 members를 임베드 조회하므로 service-role 필요(0037).
  let matchesQuery = supabaseService
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("club_id", clubId)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (selectedMember) {
    matchesQuery = matchesQuery.or(
      `team_a_player1_member.eq.${selectedMember.id},team_a_player2_member.eq.${selectedMember.id},team_b_player1_member.eq.${selectedMember.id},team_b_player2_member.eq.${selectedMember.id}`
    );
  } else if (invalidMemberFilter) {
    // 토큰이 어느 회원과도 매칭되지 않음 — 필터를 무시하지 않고 명시적으로 0건 처리한다.
    matchesQuery = matchesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  if (sessionIdsForType !== null) {
    if (sessionIdsForType.length === 0) {
      return (
        <PublicShell>
          <MatchesHeader slug={slug} clubName={club.name} />
          <EmptyState message="해당 세션 유형의 경기 기록이 없어요." />
        </PublicShell>
      );
    }
    matchesQuery = matchesQuery.in("session_id", sessionIdsForType);
  }

  const { data: matchRows } = await matchesQuery.limit(200);
  const displayMatches = toPublicDisplayMatches(matchRows ?? []);

  return (
    <PublicShell>
      <MatchesHeader slug={slug} clubName={club.name} />

      {/* 세션 타입 필터 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link href={buildHref(slug, { member: filterMemberToken })}>
          <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${!filterSessionType ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
            전체
          </span>
        </Link>
        {MATCH_SESSION_DAY_FILTERS.map(({ value, label }) => (
          <Link key={value} href={buildHref(slug, { sessionType: value, member: filterMemberToken })}>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${filterSessionType === value ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* 선수 필터 */}
      <div className="mb-4">
        {!showPlayers && !selectedMember && (
          <Link href={buildHref(slug, { sessionType: filterSessionType ?? undefined, member: filterMemberToken, showPlayers: "1" })}>
            <span className="inline-flex items-center rounded-full border border-line-200 bg-line-50 px-3 py-1.5 text-sm text-line-600 hover:border-line-300">
              Filter Player ↓
            </span>
          </Link>
        )}
        {!showPlayers && selectedMember && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-clay-400 bg-clay-400/10 px-3 py-1.5 text-sm font-semibold text-clay-400">
              {selectedMember.name}
            </span>
            <Link href={buildHref(slug, { sessionType: filterSessionType ?? undefined, showPlayers: "1" })} className="text-xs text-line-500 hover:text-line-700">
              변경
            </Link>
            <Link href={buildHref(slug, { sessionType: filterSessionType ?? undefined })} className="text-xs text-line-500 hover:text-line-700">
              ✕ 초기화
            </Link>
          </div>
        )}
        {showPlayers && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-line-500">선수 선택</span>
              <Link href={buildHref(slug, { sessionType: filterSessionType ?? undefined, member: filterMemberToken })} className="text-xs text-line-500 hover:text-line-700">
                닫기 ↑
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link href={buildHref(slug, { sessionType: filterSessionType ?? undefined, showPlayers: "1" })}>
                <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${!filterMemberToken ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
                  전체
                </span>
              </Link>
              {memberList.map((member) => {
                const token = memberPublicToken(clubId, member.id);
                return (
                  <Link key={token} href={buildHref(slug, { sessionType: filterSessionType ?? undefined, member: token, showPlayers: "1" })}>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${filterMemberToken === token ? "border-clay-400 bg-clay-400 text-line-25" : "border-line-200 bg-line-50 text-line-800"}`}>
                      {member.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {invalidMemberFilter ? (
        <EmptyState message="선택한 선수를 찾을 수 없어요." />
      ) : displayMatches.length === 0 ? (
        <EmptyState message="경기 기록이 없어요." />
      ) : (
        <div className="space-y-3">
          {displayMatches.map((match) => (
            <MatchCard key={match.id} match={match} currentClubId={clubId} />
          ))}
        </div>
      )}
    </PublicShell>
  );
}

function MatchesHeader({ slug, clubName }: { slug: string; clubName: string }) {
  return (
    <ClubPageHeader
      eyebrow={`${clubName} · Match Results`}
      title="경기 기록"
      showDot
      rightSlot={
        <Link href={`/c/${slug}`} className="club-back-link mt-1">
          ← 클럽 홈
        </Link>
      }
    />
  );
}
