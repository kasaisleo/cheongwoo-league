"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { MATCH_SESSION_DAY_LABEL } from "@/lib/match-session-label";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats, AttendanceStatus, AttendanceSession } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v3 — 회원 정보, 카카오 연동, 활동 통계, 최근 출석 이력, 이번 출석 신청.
 *
 * 인증: getSession()으로 로그인 여부 확인.
 *   - 미로그인 → /login 이동
 *   - 로그인 됐지만 members.auth_user_id 미연결 → 안내 문구 표시(리다이렉트 없음)
 *
 * "이번 출석 신청" 섹션:
 *   - attendance_sessions.status = 'open' AND session_date >= 오늘 인 세션을 표시
 *   - 각 세션별로 참석/미정/불참 버튼 제공
 *   - 변경 시 POST /api/member/attendance 호출 (본인 확인은 서버에서 처리)
 *   - 기존 관리자 출석 관리(app/api/attendance/admin-update)와 완전히 독립
 */

const RECENT_ATTENDANCE_LIMIT = 5;

interface AttendanceRow {
  status: AttendanceStatus;
  event_date: string;
}

/** attendance 전체 row에서 통계와 최근 목록을 한 번에 계산 */
interface AttendanceData {
  totalResponses: number;
  attendingCount: number;
  attendanceRate: number;
  recent: AttendanceRow[];
}

function buildAttendanceData(rows: AttendanceRow[]): AttendanceData {
  const totalResponses = rows.length;
  const attendingCount = rows.filter((r) => r.status === "attending").length;
  const attendanceRate =
    totalResponses > 0 ? Math.round((attendingCount / totalResponses) * 100) : 0;
  const recent = rows.slice(0, RECENT_ATTENDANCE_LIMIT);
  return { totalResponses, attendingCount, attendanceRate, recent };
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

const STATUS_TONE: Record<AttendanceStatus, "court" | "amber" | "fault" | "neutral"> = {
  attending: "court",
  undecided: "amber",
  absent: "fault",
};

/** 출석 신청 가능한 세션 + 현재 내 상태 */
interface SessionWithMyStatus {
  session: AttendanceSession;
  myStatus: AttendanceStatus | null;  // null = 아직 응답 없음
}

export default function MyPage() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  // 이번 출석 신청 섹션
  const [openSessions, setOpenSessions] = useState<SessionWithMyStatus[]>([]);
  const [submittingSessionId, setSubmittingSessionId] = useState<string | null>(null);

  const loadOpenSessions = useCallback(async (memberId: string) => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    // 신청 가능 세션: open + session_date >= 오늘, 오름차순
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("status", "open")
      .gte("session_date", today)
      .order("session_date", { ascending: true });

    if (!sessions || sessions.length === 0) {
      setOpenSessions([]);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);

    // 현재 내 attendance 상태 조회
    const { data: myAttendances } = await supabase
      .from("attendance")
      .select("session_id, status")
      .eq("member_id", memberId)
      .in("session_id", sessionIds);

    const statusMap = new Map<string, AttendanceStatus>(
      (myAttendances ?? []).map((a) => [a.session_id as string, a.status as AttendanceStatus])
    );

    setOpenSessions(
      sessions.map((session) => ({
        session: session as AttendanceSession,
        myStatus: statusMap.get(session.id) ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        if (typedMember) {
          // 출석 통계 + 최근 이력
          const { data: rows } = await supabase
            .from("attendance")
            .select("status, event_date")
            .eq("member_id", typedMember.id)
            .order("event_date", { ascending: false });

          setAttendanceData(buildAttendanceData((rows ?? []) as AttendanceRow[]));

          // 이번 출석 신청 세션 로드
          await loadOpenSessions(typedMember.id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadOpenSessions]);

  async function handleAttendanceChange(sessionId: string, status: AttendanceStatus) {
    setSubmittingSessionId(sessionId);

    // 낙관적 업데이트 — 응답 전에 UI 먼저 반영
    setOpenSessions((prev) =>
      prev.map((s) =>
        s.session.id === sessionId ? { ...s, myStatus: status } : s
      )
    );

    try {
      const res = await fetch("/api/member/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 실패 시 낙관적 업데이트 롤백
        setOpenSessions((prev) =>
          prev.map((s) =>
            s.session.id === sessionId
              ? { ...s, myStatus: s.myStatus }  // 이미 반영됐으므로 재조회
              : s
          )
        );
        toast.error(data?.error ?? "출석 변경에 실패했습니다.");
        // 정확한 상태로 재조회
        if (member) await loadOpenSessions(member.id);
      } else {
        toast.success(`${STATUS_LABEL[status]}으로 변경되었습니다.`);
      }
    } catch {
      toast.error("출석 변경 중 오류가 발생했습니다.");
      if (member) await loadOpenSessions(member.id);
    } finally {
      setSubmittingSessionId(null);
    }
  }

  if (!initialized) return null;

  if (loading) {
    return (
      <main className="px-4 pt-6">
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      </main>
    );
  }

  const kakaoNickname =
    (authUser?.user_metadata?.name as string | undefined) ??
    (authUser?.user_metadata?.full_name as string | undefined) ??
    (authUser?.user_metadata?.preferred_username as string | undefined) ??
    null;
  const kakaoEmail = authUser?.email ?? null;
  const matchesPlayed = member ? member.wins + member.losses : 0;
  const winRate =
    matchesPlayed > 0 ? Math.round((member!.wins / matchesPlayed) * 100) : 0;

  return (
    <main className="px-4 pt-6 pb-10">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          My Page
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          마이페이지
        </h1>
      </header>

      {!member && (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-line-900">회원 정보와 연결되지 않았습니다.</p>
          <p className="mt-1 text-sm text-line-500">운영진에게 회원 연결을 요청해주세요.</p>
        </Card>
      )}

      {member && (
        <div className="space-y-4">

          {/* 1. 회원 정보 */}
          <Card className="p-4">
            <SectionTitle>회원 정보</SectionTitle>
            <div className="space-y-2.5">
              <Row label="이름" value={member.name} />
              <Row label="닉네임" value={member.nickname} />
              <Row label="회원 유형">
                <Badge tone="neutral">{member.member_type}</Badge>
              </Row>
              <Row
                label="마포점수"
                value={member.mapo_score !== null ? `${member.mapo_score}점` : "—"}
              />
            </div>
          </Card>

          {/* 2. 카카오 연동 */}
          <Card className="p-4">
            <SectionTitle>카카오 연동</SectionTitle>
            <div className="space-y-2.5">
              <Row label="카카오 닉네임" value={kakaoNickname ?? "—"} />
              <Row label="이메일" value={kakaoEmail ?? "—"} />
              <Row label="연동 상태">
                <Badge tone="court">연동 완료</Badge>
              </Row>
            </div>
          </Card>

          {/* 3. 활동 통계 */}
          <Card className="p-4">
            <SectionTitle>활동 통계</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <KpiBox
                label="출석률"
                number={attendanceData ? attendanceData.attendanceRate : 0}
                unit="%"
                sub={
                  attendanceData
                    ? `${attendanceData.attendingCount} / ${attendanceData.totalResponses}세션`
                    : undefined
                }
              />
              <KpiBox label="총 경기" number={matchesPlayed} unit="경기" />
              <KpiBox
                label="승률"
                number={winRate}
                unit="%"
                tone="court"
                sub={matchesPlayed > 0 ? `${member.wins}승 ${member.losses}패` : undefined}
              />
              <KpiBox
                label="마포점수"
                number={member.mapo_score ?? 0}
                unit="점"
                tone={member.mapo_score !== null ? undefined : "muted"}
                displayValue={member.mapo_score !== null ? undefined : "—"}
              />
            </div>
          </Card>

          {/* 4. 최근 출석 이력 */}
          <Card className="p-4">
            <SectionTitle>최근 출석</SectionTitle>
            {!attendanceData || attendanceData.recent.length === 0 ? (
              <p className="text-sm text-line-400">아직 출석 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {attendanceData.recent.map((row) => (
                  <div key={row.event_date} className="flex items-center justify-between">
                    <span className="text-sm text-line-700">{formatDate(row.event_date)}</span>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 5. 이번 출석 신청 */}
          <Card className="p-4">
            <SectionTitle>이번 출석 신청</SectionTitle>
            {openSessions.length === 0 ? (
              <p className="text-sm text-line-400">현재 신청 가능한 세션이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {openSessions.map(({ session, myStatus }) => {
                  const isSubmitting = submittingSessionId === session.id;
                  const sessionLabel = MATCH_SESSION_DAY_LABEL[session.session_day];
                  const dateLabel = formatDate(session.session_date);
                  return (
                    <div key={session.id}>
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-line-900">{sessionLabel}</p>
                          <p className="text-xs text-line-500">{dateLabel}</p>
                        </div>
                        {myStatus && (
                          <Badge tone={STATUS_TONE[myStatus]}>{STATUS_LABEL[myStatus]}</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(["attending", "undecided", "absent"] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleAttendanceChange(session.id, s)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              myStatus === s
                                ? s === "attending"
                                  ? "border-court-400 bg-court-400 text-line-25"
                                  : s === "absent"
                                    ? "border-fault-400 bg-fault-400 text-line-25"
                                    : "border-amber-400 bg-amber-400 text-line-900"
                                : "border-line-200 bg-line-50 text-line-700"
                            }`}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-line-400">
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-line-500">{label}</span>
      {children ?? <span className="text-sm font-medium text-line-900">{value}</span>}
    </div>
  );
}

function KpiBox({
  label,
  number,
  unit,
  sub,
  tone,
  displayValue,
}: {
  label: string;
  number: number;
  unit: string;
  sub?: string;
  tone?: "court" | "fault" | "muted";
  displayValue?: string;
}) {
  const numColor =
    tone === "court"
      ? "text-court-400"
      : tone === "fault"
        ? "text-fault-400"
        : tone === "muted"
          ? "text-line-400"
          : "text-line-900";

  return (
    <div className="rounded-lg border border-line-200 bg-line-50 p-3 text-center">
      {displayValue !== undefined ? (
        <p className={`text-4xl font-extrabold leading-none ${numColor}`}>{displayValue}</p>
      ) : (
        <p className={`leading-none ${numColor}`}>
          <span className="text-4xl font-extrabold">{number}</span>
          <span className="ml-0.5 text-base font-semibold">{unit}</span>
        </p>
      )}
      <p className="mt-1.5 text-xs text-line-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-line-400">{sub}</p>}
    </div>
  );
}
