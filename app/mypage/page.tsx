"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats, AttendanceStatus } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v2 — 회원 정보, 카카오 연동, 활동 통계(재정리), 최근 출석 이력.
 *
 * 인증: getSession()으로 로그인 여부 확인.
 *   - 미로그인 → /login 이동
 *   - 로그인 됐지만 members.auth_user_id 미연결 → 안내 문구 표시(리다이렉트 없음)
 *
 * 데이터 조회:
 *   1) getSession() → authUser
 *   2) member_stats (auth_user_id = authUser.id)
 *   3) attendance 전체 조회 (member_id, 최신순) — 한 번 조회로 통계+최근5개 동시 계산
 *      - 출석률 = attending / 전체 row 수
 *      - 승률 = wins / (wins + losses)
 *      - 최근 출석 5개 = 상위 5 row
 */

const RECENT_ATTENDANCE_LIMIT = 5;

interface AttendanceRow {
  status: AttendanceStatus;
  event_date: string;
}

/** attendance 전체 row에서 통계와 최근 목록을 한 번에 계산 */
interface AttendanceData {
  totalResponses: number;   // 전체 attendance row 수(출석률 분모)
  attendingCount: number;   // status === "attending" 수
  attendanceRate: number;   // attending / total * 100 (total=0이면 0)
  recent: AttendanceRow[];  // 최신순 상위 5개
}

function buildAttendanceData(rows: AttendanceRow[]): AttendanceData {
  const totalResponses = rows.length;
  const attendingCount = rows.filter((r) => r.status === "attending").length;
  const attendanceRate =
    totalResponses > 0 ? Math.round((attendingCount / totalResponses) * 100) : 0;
  const recent = rows.slice(0, RECENT_ATTENDANCE_LIMIT);
  return { totalResponses, attendingCount, attendanceRate, recent };
}

/** 날짜 문자열(YYYY-MM-DD)을 "6/29" 형식으로 */
function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** attendance status → 한국어 레이블 */
const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: "참석",
  undecided: "미정",
  absent: "불참",
};

/** status → Badge tone */
const STATUS_TONE: Record<AttendanceStatus, "court" | "amber" | "fault" | "neutral"> = {
  attending: "court",
  undecided: "amber",
  absent: "fault",
};

export default function MyPage() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        // 1) 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        // 2) member_stats 조회
        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        // 3) attendance 전체 조회 (한 번으로 통계 + 최근 5개 계산)
        if (typedMember) {
          const { data: rows } = await supabase
            .from("attendance")
            .select("status, event_date")
            .eq("member_id", typedMember.id)
            .order("event_date", { ascending: false });

          setAttendanceData(buildAttendanceData((rows ?? []) as AttendanceRow[]));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (!initialized) return null;

  if (loading) {
    return (
      <main className="px-4 pt-6">
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      </main>
    );
  }

  // 카카오 정보
  const kakaoNickname =
    (authUser?.user_metadata?.name as string | undefined) ??
    (authUser?.user_metadata?.full_name as string | undefined) ??
    (authUser?.user_metadata?.preferred_username as string | undefined) ??
    null;
  const kakaoEmail = authUser?.email ?? null;

  // 통계 계산
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

      {/* 미연결 상태 */}
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

          {/* 3. 활동 통계 (재정리: 출석률 / 총 경기 / 승률 / 마포점수) */}
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
              <KpiBox label="승률" number={winRate} unit="%" tone="court"
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

          {/* 4. 최근 출석 */}
          <Card className="p-4">
            <SectionTitle>최근 출석</SectionTitle>
            {!attendanceData || attendanceData.recent.length === 0 ? (
              <p className="text-sm text-line-400">아직 출석 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {attendanceData.recent.map((row) => (
                  <div
                    key={row.event_date}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-line-700">{formatDate(row.event_date)}</span>
                    <Badge tone={STATUS_TONE[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      )}
    </main>
  );
}

/** 섹션 소제목 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-line-400">
      {children}
    </p>
  );
}

/** 정보 행 — 레이블 + 텍스트 값 또는 ReactNode */
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

/**
 * KPI 박스 — 활동 통계용. 대시보드 느낌으로 정리.
 * font-score(픽셀 계열) 제거, 기본 UI 폰트 + text-4xl + font-extrabold 적용.
 * 단위는 숫자보다 작게(text-base), 색상 그림자 없음.
 */
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
  displayValue?: string;  // number 대신 표시할 문자열 (예: "—")
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
