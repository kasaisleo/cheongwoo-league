"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats, AttendanceStatus } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v4 — 내 회원 정보 확인 중심.
 *
 * Step 14-4: "신청 가능한 일정" 출석 신청 섹션 제거.
 * 출석 신청은 홈(HomeAttendanceSection)과 /attendance에서만 담당한다.
 *
 * 섹션 구성:
 *   1. 회원 정보
 *   2. 카카오 연동
 *   3. 활동 통계
 *   4. 최근 출석 이력
 *
 * 인증:
 *   - 미로그인 → /login 이동
 *   - 로그인 됐지만 members.auth_user_id 미연결 → 안내 문구 표시
 */

const RECENT_ATTENDANCE_LIMIT = 5;

interface AttendanceRow {
  status: AttendanceStatus;
  event_date: string;
}

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

const STATUS_TONE: Record<AttendanceStatus, "win" | "amber" | "loss" | "neutral"> = {
  attending: "win",
  undecided: "amber",
  absent: "loss",
};

export default function MyPage() {
  const router = useRouter();
  // initialized: 세션 확인 전 null 반환으로 MemberAuthBar 높이만큼 화면이 점프하는 것 방지
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        // 1) 세션 확인 — 미로그인이면 /login으로 이동
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        // 2) member_stats 조회 (auth_user_id 기준)
        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        // 3) 출석 통계 + 최근 이력 조회
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

  // 세션 확인 전 — null 반환으로 레이아웃 점프 방지
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
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-clay-400">
          My Page
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          마이페이지
        </h1>
      </header>

      {/* 회원 미연결 상태 */}
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
                <Badge tone="win">연동 완료</Badge>
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
                tone="win"
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

        </div>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-line-500">
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
  tone?: "win" | "loss" | "muted";
  displayValue?: string;
}) {
  const numColor =
    tone === "win"
      ? "text-win"
      : tone === "loss"
        ? "text-loss"
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
