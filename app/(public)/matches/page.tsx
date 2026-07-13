import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { MATCH_SESSION_DAY_FILTERS, MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { getAdminAccessServer } from "@/lib/admin-permissions";
import { EmptyState } from "@/components/ui/SectionHeader";
import type { Member, SessionDay } from "@/lib/supabase/database.types";
import { getCurrentClubId } from "@/lib/current-club";

/**
 * Matches Page v2 — Step 17-3 Filter Hierarchy Recovery.
 *
 * 문제: 회원 필터 38개 버튼이 화면 상단을 점령해 경기 결과보다 먼저 보임.
 *
 * 해결:
 *   1. 세션 구분 필터(5개): 유지 — compact chip row, 항상 표시
 *   2. 회원 필터(38개): 기본 접힘 — ?showPlayers=1 일 때만 펼침
 *      - 선수 미선택: "Filter Player ↓" 버튼 한 줄
 *      - 선수 선택됨: "선수: [이름] ×" 칩 한 개 + "변경" 링크
 *      - showPlayers=1: 전체 목록 표시 + 닫기 링크
 *
 * 서버 컴포넌트 기반: URL searchParams로만 상태 관리 (useState 불필요)
 * MatchCard 구조, 경기 정렬, DB/API — 변경 없음
 */

interface MatchesPageProps {
  searchParams: { member?: string; sessionType?: string; showPlayers?: string };
}

const VALID_SESSION_TYPES: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];

function isValidSessionType(value: string | undefined): value is SessionDay {
  return value !== undefined && (VALID_SESSION_TYPES as string[]).includes(value);
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const supabase = createClient();
  const currentClubId = await getCurrentClubId();
  const filterMemberId = searchParams.member;
  const filterSessionType = isValidSessionType(searchParams.sessionType)
    ? searchParams.sessionType
    : null;
  // ?showPlayers=1 일 때 회원 필터 펼침
  const showPlayers = searchParams.showPlayers === "1";

  const { isAdmin } = await getAdminAccessServer();

  // 세션 타입 필터가 걸려있으면 해당 세션 id 목록 먼저 조회
  let sessionIdsForType: string[] | null = null;
  if (filterSessionType) {
    const { data: sessionRows } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("session_day", filterSessionType)
      .eq("club_id", currentClubId);
    sessionIdsForType = (sessionRows ?? []).map((s) => s.id);
  }

  const { data: members } = await supabase
    .from("members")
    .select("id, name")
    .eq("is_active", true)
    .eq("club_id", currentClubId)
    .order("name");

  let matchesQuery = supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("club_id", currentClubId)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (filterMemberId) {
    matchesQuery = matchesQuery.or(
      `team_a_player1_member.eq.${filterMemberId},team_a_player2_member.eq.${filterMemberId},team_b_player1_member.eq.${filterMemberId},team_b_player2_member.eq.${filterMemberId}`
    );
  }

  if (sessionIdsForType !== null) {
    matchesQuery = matchesQuery.in(
      "session_id",
      sessionIdsForType.length > 0 ? sessionIdsForType : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const matchesResult = await matchesQuery;
  const memberList = (members ?? []) as Pick<Member, "id" | "name">[];
  const matches = toDisplayMatches(matchesResult.data);

  // 현재 선택된 선수 이름 (선택 상태 칩 표시용)
  const selectedMember = filterMemberId
    ? memberList.find((m) => m.id === filterMemberId)
    : null;

  function buildHref(params: {
    member?: string;
    sessionType?: string;
    showPlayers?: boolean;
  }): string {
    const query = new URLSearchParams();
    if (params.member) query.set("member", params.member);
    if (params.sessionType) query.set("sessionType", params.sessionType);
    if (params.showPlayers) query.set("showPlayers", "1");
    const qs = query.toString();
    return qs ? `/matches?${qs}` : "/matches";
  }

  const emptyMessage = (() => {
    if (filterSessionType && filterMemberId) return "조건에 맞는 경기 기록이 없어요.";
    if (filterSessionType) return "이 세션 구분에는 아직 등록된 경기가 없어요.";
    if (filterMemberId) return "이 회원의 경기 기록이 없어요.";
    return "아직 등록된 경기가 없어요.";
  })();

  return (
    <main className="px-4 pt-6 pb-28">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Records</p>
          <h1 className="headline-kr text-4xl text-line-900">기록</h1>
        </div>
        {isAdmin && (
          <Link
            href="/admin/matches/new"
            className="flex h-10 items-center rounded-sm bg-clay-400 px-4 text-sm font-bold text-line-25 transition-colors hover:bg-clay-300"
          >
            + 경기 입력
          </Link>
        )}
      </header>

      {/* ── 기록 탭 — 매치 히스토리 / 경기 기록 ── */}
      <div className="mb-4 flex gap-2">
        <Link href="/matches/history"
          className="rounded-sm border border-line-200/40 px-3 py-1.5 text-xs font-semibold text-line-500 hover:border-clay-400/60 hover:text-clay-400">
          매치 히스토리
        </Link>
        <span className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-3 py-1.5 text-xs font-semibold text-clay-400">
          경기 기록
        </span>
      </div>

      {/* ── 세션 구분 필터 — compact chip row, 항상 표시 ── */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link href={buildHref({ member: filterMemberId })}>
          <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
            !filterSessionType
              ? "border-clay-400 bg-clay-400 text-line-25"
              : "border-line-200/40 bg-line-50 text-line-500"
          }`}>
            전체
          </span>
        </Link>
        {MATCH_SESSION_DAY_FILTERS.map((f) => (
          <Link key={f.value} href={buildHref({ member: filterMemberId, sessionType: f.value })}>
            <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
              filterSessionType === f.value
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200/40 bg-line-50 text-line-500"
            }`}>
              {f.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ── 선수 필터 — 기본 접힘, URL 기반 토글 ─────────── */}
      {!showPlayers ? (
        /* 닫힘 상태 */
        <div className="mb-4 flex items-center gap-2">
          {selectedMember ? (
            /* 선수 선택됨: 선택 상태 칩 + 변경 링크 */
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-clay-400 bg-clay-400/10 px-3 py-1 text-xs font-semibold text-clay-400">
                {selectedMember.name}
                <Link
                  href={buildHref({ sessionType: filterSessionType ?? undefined })}
                  className="ml-0.5 text-clay-400/70 hover:text-clay-400"
                  aria-label="선수 필터 해제"
                >
                  ×
                </Link>
              </span>
              <Link
                href={buildHref({
                  member: filterMemberId,
                  sessionType: filterSessionType ?? undefined,
                  showPlayers: true,
                })}
                className="text-xs font-semibold text-line-500 hover:text-line-700"
              >
                변경
              </Link>
            </>
          ) : (
            /* 선수 미선택: Filter Player 버튼 */
            <Link
              href={buildHref({
                sessionType: filterSessionType ?? undefined,
                showPlayers: true,
              })}
              className="inline-flex items-center gap-1 rounded-full border border-line-200/40 bg-line-50 px-3 py-1 text-xs font-semibold text-line-500 transition-colors hover:border-line-300 hover:text-line-700"
            >
              <span>선수 필터</span>
              <span className="text-line-400">↓</span>
            </Link>
          )}
        </div>
      ) : (
        /* 열림 상태 — 전체 회원 목록 */
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
              Select Player
            </span>
            <Link
              href={buildHref({
                member: filterMemberId,
                sessionType: filterSessionType ?? undefined,
              })}
              className="text-[10px] font-semibold text-line-500 hover:text-line-700"
            >
              닫기 ↑
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link href={buildHref({ sessionType: filterSessionType ?? undefined })}>
              <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
                !filterMemberId
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : "border-line-200/40 bg-line-50 text-line-500"
              }`}>
                전체
              </span>
            </Link>
            {memberList.map((member) => (
              <Link
                key={member.id}
                href={buildHref({ member: member.id, sessionType: filterSessionType ?? undefined })}
              >
                <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filterMemberId === member.id
                    ? "border-clay-400 bg-clay-400 text-line-25"
                    : "border-line-200/40 bg-line-50 text-line-500"
                }`}>
                  {member.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 경기 목록 ─────────────────────────────────────── */}
      {matches.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <div key={match.id}>
              {match.sessionDay && (
                <p className="mb-1 px-1 text-[11px] font-semibold text-line-500">
                  {match.sessionTitle
                    ? `${match.sessionTitle} · ${MATCH_SESSION_DAY_LABEL[match.sessionDay]}`
                    : MATCH_SESSION_DAY_LABEL[match.sessionDay]}
                </p>
              )}
              <MatchCard match={match} currentClubId={currentClubId} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
