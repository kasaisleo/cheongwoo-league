import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { MatchCard } from "@/components/match/MatchCard";
import { MATCH_SELECT_WITH_PLAYERS, toDisplayMatches } from "@/lib/match-display";
import { MATCH_SESSION_DAY_FILTERS, MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import { isAdminSession } from "@/lib/admin-auth";
import { EmptyState } from "@/components/ui/SectionHeader";
import type { Member, SessionDay } from "@/lib/supabase/database.types";

interface MatchesPageProps {
  searchParams: { member?: string; sessionType?: string };
}

const VALID_SESSION_TYPES: SessionDay[] = ["saturday", "sunday", "holiday", "custom"];

function isValidSessionType(value: string | undefined): value is SessionDay {
  return value !== undefined && (VALID_SESSION_TYPES as string[]).includes(value);
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const supabase = createClient();
  const filterMemberId = searchParams.member;
  const filterSessionType = isValidSessionType(searchParams.sessionType)
    ? searchParams.sessionType
    : null;

  // 운영진 여부 — "경기 입력" 버튼 노출 제어용
  const isAdmin = isAdminSession();

  // 세션 타입 필터가 걸려있으면, 그 타입에 해당하는 세션 id 목록을 먼저 조회한다.
  let sessionIdsForType: string[] | null = null;
  if (filterSessionType) {
    const { data: sessionRows } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("session_day", filterSessionType);
    sessionIdsForType = (sessionRows ?? []).map((s) => s.id);
  }

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("is_active", true)
    .order("name");

  let matchesQuery = supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (filterMemberId) {
    matchesQuery = matchesQuery.or(
      `team_a_player1_member.eq.${filterMemberId},team_a_player2_member.eq.${filterMemberId},team_b_player1_member.eq.${filterMemberId},team_b_player2_member.eq.${filterMemberId}`
    );
  }

  // 세션 타입 필터: 해당 타입의 세션이 하나도 없으면 빈 결과가 되도록 불가능한 값을 넣는다.
  if (sessionIdsForType !== null) {
    matchesQuery = matchesQuery.in(
      "session_id",
      sessionIdsForType.length > 0 ? sessionIdsForType : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  const matchesResult = await matchesQuery;

  const memberList = (members ?? []) as Member[];
  const matches = toDisplayMatches(matchesResult.data);

  function buildHref(params: { member?: string; sessionType?: string }): string {
    const query = new URLSearchParams();
    if (params.member) query.set("member", params.member);
    if (params.sessionType) query.set("sessionType", params.sessionType);
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
    <main className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">
            Match History
          </p>
          <h1 className="headline-kr text-4xl text-line-900">
            경기 기록
          </h1>
        </div>

        {/* 경기 입력 버튼 — manager/owner 에게만 노출 */}
        {isAdmin && (
          <Link
            href="/matches/new"
            className="flex h-10 items-center rounded-lg bg-clay-400 px-4 text-sm font-bold text-line-25 transition-colors hover:bg-clay-300"
          >
            + 경기 입력
          </Link>
        )}
      </header>

      {/* 세션 구분 필터: 전체보기 / 토요정기매치 / 일요정기매치 / 휴일매치 / 이벤트매치 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Link href={buildHref({ member: filterMemberId })}>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !filterSessionType
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200 bg-line-50 text-line-800"
            }`}
          >
            전체보기
          </span>
        </Link>
        {MATCH_SESSION_DAY_FILTERS.map((f) => (
          <Link key={f.value} href={buildHref({ member: filterMemberId, sessionType: f.value })}>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filterSessionType === f.value
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : "border-line-200 bg-line-50 text-line-800"
              }`}
            >
              {f.label}
            </span>
          </Link>
        ))}
      </div>

      {/* 회원 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={buildHref({ sessionType: filterSessionType ?? undefined })}>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !filterMemberId
                ? "border-clay-400 bg-clay-400 text-line-25"
                : "border-line-200 bg-line-50 text-line-800"
            }`}
          >
            전체
          </span>
        </Link>
        {memberList.map((member) => (
          <Link
            key={member.id}
            href={buildHref({ member: member.id, sessionType: filterSessionType ?? undefined })}
          >
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                filterMemberId === member.id
                  ? "border-clay-400 bg-clay-400 text-line-25"
                  : "border-line-200 bg-line-50 text-line-800"
              }`}
            >
              {member.name}
            </span>
          </Link>
        ))}
      </div>

      {matches.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <div key={match.id}>
              {match.sessionDay && (
                <p className="mb-1 px-1 text-[11px] font-semibold text-line-500">
                  {/* 세션 제목 표시 정책: title 기반 메인, session_day 라벨 보조 */}
                  {match.sessionTitle
                    ? `${match.sessionTitle} · ${MATCH_SESSION_DAY_LABEL[match.sessionDay]}`
                    : MATCH_SESSION_DAY_LABEL[match.sessionDay]}
                </p>
              )}
              <MatchCard match={match} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
