"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AttendanceToggle } from "@/components/attendance/AttendanceToggle";
import type { AttendanceStatus, Member } from "@/lib/supabase/database.types";

const MIN_REQUIRED_PLAYERS = 4;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MemberAttendance {
  member: Member;
  status: AttendanceStatus;
  attendanceId: string | null;
}

export default function AttendancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [eventDate, setEventDate] = useState(todayString());
  const [rows, setRows] = useState<MemberAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    async function load() {
      const [{ data: members }, { data: attendance }] = await Promise.all([
        supabase.from("members").select("*").eq("is_active", true).order("nickname"),
        supabase.from("attendance").select("*").eq("event_date", eventDate),
      ]);

      if (!isCurrent) return;

      const attendanceByMember = new Map(
        (attendance ?? []).map((a) => [a.member_id, a])
      );

      setRows(
        (members ?? []).map((member) => {
          const existing = attendanceByMember.get(member.id);
          return {
            member,
            status: existing?.status ?? "undecided",
            attendanceId: existing?.id ?? null,
          };
        })
      );
      setLoading(false);
    }

    load();
    return () => {
      isCurrent = false;
    };
  }, [eventDate, supabase]);

  async function updateStatus(memberId: string, status: AttendanceStatus) {
    setRows((prev) =>
      prev.map((row) => (row.member.id === memberId ? { ...row, status } : row))
    );

    const { data } = await supabase
      .from("attendance")
      .upsert(
        { member_id: memberId, event_date: eventDate, status, updated_at: new Date().toISOString() },
        { onConflict: "member_id,event_date" }
      )
      .select()
      .single();

    if (data) {
      setRows((prev) =>
        prev.map((row) => (row.member.id === memberId ? { ...row, attendanceId: data.id } : row))
      );
    }
  }

  const attending = rows.filter((r) => r.status === "attending").length;
  const undecided = rows.filter((r) => r.status === "undecided").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const shortage = Math.max(0, MIN_REQUIRED_PLAYERS - attending);

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-clay-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
            Attendance
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">출석 체크</h1>
      </header>

      <input
        type="date"
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
        className="mb-4 h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
      />

      <Card className="mb-4 flex items-center justify-between p-4">
        <div>
          <p className="font-score text-2xl font-bold text-line-900">
            {attending}
            <span className="text-sm text-line-400"> / {rows.length}명</span>
          </p>
          <p className="text-xs text-line-500">
            미정 {undecided} · 불참 {absent}
          </p>
        </div>
        {shortage > 0 ? (
          <Badge tone="fault">{shortage}명 더 필요해요</Badge>
        ) : (
          <Badge tone="court">복식 경기 가능</Badge>
        )}
      </Card>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ member, status }) => (
            <Card key={member.id} className="flex items-center justify-between p-3">
              <span className="text-sm font-medium text-line-900">{member.nickname}</span>
              <AttendanceToggle value={status} onChange={(s) => updateStatus(member.id, s)} />
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
