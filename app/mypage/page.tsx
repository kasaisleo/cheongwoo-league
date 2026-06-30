"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { MemberWithStats } from "@/lib/supabase/database.types";

/**
 * 마이페이지 v1 — 로그인한 회원의 기본 정보, 카카오 연동 정보, 출석/경기 통계 표시.
 *
 * 인증: supabase.auth.getSession()으로 현재 로그인 사용자를 확인한다.
 *   - 미로그인 → /login 이동
 *   - 로그인 됐지만 members.auth_user_id 미연결 → 리다이렉트 없이 안내 문구 표시
 *
 * 데이터 조회 순서:
 *   1) getSession() → authUser 확보
 *   2) member_stats 조회 (auth_user_id = authUser.id)
 *   3) attendance count (member_id = member.id) — member.id 확정 후 실행
 *   카카오 정보는 session.user.user_metadata / user.email에서 직접 파싱한다.
 *
 * middleware.ts와 admin-auth.ts는 건드리지 않는다 — 클라이언트 컴포넌트 패턴으로
 * Supabase Auth 세션을 직접 읽는다(MemberAuthBar와 동일한 방식).
 */

interface AttendanceSummary {
  total: number;      // 세션 기록이 있는 전체 행 수
  attending: number;  // 실제 출석(attending) 횟수
}

export default function MyPage() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      try {
        // 1) 현재 로그인 세션 확인
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        setAuthUser(user);
        setInitialized(true);

        // 2) member_stats에서 로그인 회원과 연결된 row 조회
        const { data: memberData } = await supabase
          .from("member_stats")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const typedMember = memberData as MemberWithStats | null;
        setMember(typedMember);

        // 3) 출석 횟수 조회 — member.id가 확정된 뒤에만 실행
        if (typedMember) {
          const { data: attendanceRows } = await supabase
            .from("attendance")
            .select("status")
            .eq("member_id", typedMember.id);

          const rows = attendanceRows ?? [];
          setAttendance({
            total: rows.length,
            attending: rows.filter((r) => r.status === "attending").length,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // 세션 확인 전 — 레이아웃 자리 잡지 않게 null 반환
  if (!initialized) return null;

  if (loading) {
    return (
      <main className="px-4 pt-6">
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      </main>
    );
  }

  // 카카오 정보 파싱
  const kakaoNickname =
    (authUser?.user_metadata?.name as string | undefined) ??
    (authUser?.user_metadata?.full_name as string | undefined) ??
    (authUser?.user_metadata?.preferred_username as string | undefined) ??
    null;
  const kakaoEmail = authUser?.email ?? null;
  const matchesPlayed = member ? member.wins + member.losses : 0;

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

      {/* 회원 미연결 상태 — 리다이렉트 없이 안내만 표시 */}
      {!member && (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-line-900">회원 정보와 연결되지 않았습니다.</p>
          <p className="mt-1 text-sm text-line-500">
            운영진에게 회원 연결을 요청해주세요.
          </p>
        </Card>
      )}

      {member && (
        <div className="space-y-4">

          {/* 회원 정보 */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-line-400">
              회원 정보
            </p>
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

          {/* 카카오 연동 정보 */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-line-400">
              카카오 연동
            </p>
            <div className="space-y-2.5">
              <Row label="카카오 닉네임" value={kakaoNickname ?? "—"} />
              <Row label="이메일" value={kakaoEmail ?? "—"} />
              <Row label="연동 상태">
                <Badge tone="court">연동 완료</Badge>
              </Row>
            </div>
          </Card>

          {/* 활동 통계 */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-line-400">
              활동 통계
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatBox
                label="총 출석"
                value={attendance ? `${attendance.attending}회` : "—"}
                sub={attendance ? `전체 ${attendance.total}세션` : undefined}
              />
              <StatBox label="총 경기" value={`${matchesPlayed}경기`} />
              <StatBox label="승" value={`${member.wins}승`} tone="court" />
              <StatBox label="패" value={`${member.losses}패`} tone="fault" />
            </div>
          </Card>

        </div>
      )}
    </main>
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

/** 통계 박스 */
function StatBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "court" | "fault";
}) {
  const valueColor =
    tone === "court"
      ? "text-court-400"
      : tone === "fault"
        ? "text-fault-400"
        : "text-line-900";

  return (
    <div className="rounded-lg border border-line-200 bg-line-50 p-3 text-center">
      <p className={`font-score text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-line-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-line-400">{sub}</p>}
    </div>
  );
}
