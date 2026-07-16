"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { MemberGrade } from "@/lib/supabase/database.types";

const GRADES: MemberGrade[] = ["A", "B", "C", "D"];

interface ReferrerOption {
  id: string;
  name: string;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewGuestPageClient({ currentClubId }: { currentClubId: string }) {
  const [members, setMembers] = useState<ReferrerOption[]>([]);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [phone, setPhone] = useState("");
  const [visitDate, setVisitDate] = useState(todayString());

  const [showMore, setShowMore] = useState(false);
  const [referredBy, setReferredBy] = useState<string>("");
  const [skillGrade, setSkillGrade] = useState<MemberGrade | "">("");
  const [mannerScore, setMannerScore] = useState<number | null>(null);
  const [reinvite, setReinvite] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/members-list")
      .then((res) => res.json())
      .then((body) => setMembers(body?.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  const isReady = name.trim().length > 0 && visitDate.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    if (submittingRef.current) return;
    submittingRef.current = true;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          visit_date: visitDate,
          age: age ? Number(age) : null,
          years_playing: yearsPlaying ? Number(yearsPlaying) : null,
          phone: phone.trim() || null,
          referred_by: referredBy || null,
          skill_grade: skillGrade || null,
          manner_score: mannerScore,
          reinvite,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "게스트 등록에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      window.location.assign("/admin/guests");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const inactiveBtnCls = "flex-1 rounded-[var(--admin-button-radius,6px)] border border-[color:var(--admin-border)] py-2 text-sm font-semibold text-[color:var(--admin-muted)] transition-colors hover:border-[color:var(--admin-border-strong)]";

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="게스트 등록"
        backHref="/admin/guests"
      />

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 overflow-hidden p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 박지민"
              className="h-11 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">나이</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="예: 35"
                className="h-11 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">구력(년)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={yearsPlaying}
                onChange={(e) => setYearsPlaying(e.target.value)}
                placeholder="예: 2"
                className="h-11 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">휴대폰 번호</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="h-11 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
            />
          </div>

          <div className="w-full overflow-hidden">
            <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">방문일</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="box-border block h-11 w-full min-w-0 max-w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)]"
            />
          </div>
        </Card>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="mt-3 text-xs font-semibold"
          style={{ color: "var(--admin-accent)" }}
        >
          {showMore ? "추가 정보 닫기 ▲" : "추가 정보 입력 (소개자, 매너평가 등) ▼"}
        </button>

        {showMore && (
          <Card className="mt-3 space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">소개자</label>
              <select
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                className="h-11 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)]"
              >
                <option value="">선택 안 함</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">실력 등급 (추정)</label>
              <div className="flex gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSkillGrade(skillGrade === g ? "" : g)}
                    className={`flex-1 rounded-[var(--admin-button-radius,6px)] border py-2 text-sm font-semibold transition-colors ${
                      skillGrade === g
                        ? "border-[color:var(--admin-accent)] text-line-25"
                        : "border-[color:var(--admin-border)] text-[color:var(--admin-muted)] hover:border-[color:var(--admin-border-strong)]"
                    }`}
                    style={skillGrade === g ? { background: "var(--admin-accent)" } : undefined}
                  >
                    {g}급
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">매너 평가</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setMannerScore(mannerScore === score ? null : score)}
                    className={`flex-1 rounded-[var(--admin-button-radius,6px)] border py-2 text-sm font-semibold transition-colors ${
                      mannerScore === score
                        ? "border-amber-400 bg-amber-400 text-line-25"
                        : "border-[color:var(--admin-border)] text-[color:var(--admin-muted)] hover:border-[color:var(--admin-border-strong)]"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">재초청 여부</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReinvite(reinvite === true ? null : true)}
                  className={`flex-1 rounded-[var(--admin-button-radius,6px)] border py-2 text-sm font-semibold transition-colors ${
                    reinvite === true
                      ? "border-court-400 bg-court-400 text-line-25"
                      : inactiveBtnCls
                  }`}
                >
                  재초청 희망
                </button>
                <button
                  type="button"
                  onClick={() => setReinvite(reinvite === false ? null : false)}
                  className={`flex-1 rounded-[var(--admin-button-radius,6px)] border py-2 text-sm font-semibold transition-colors ${
                    reinvite === false
                      ? "border-fault-400 bg-fault-400 text-line-25"
                      : inactiveBtnCls
                  }`}
                >
                  보류
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[color:var(--admin-muted)]">메모</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="특이사항을 적어주세요"
                className="w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 py-2 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
              />
            </div>
          </Card>
        )}

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <Button type="submit" size="lg" className="mt-4 w-full" disabled={!isReady}>
          {submitting ? "등록 중..." : "게스트 등록"}
        </Button>
      </form>
    </main>
  );
}
