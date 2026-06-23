"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Member, MemberGrade } from "@/lib/supabase/database.types";

const GRADES: MemberGrade[] = ["A", "B", "C", "D"];

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewGuestPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);

  const [name, setName] = useState("");
  const [referredBy, setReferredBy] = useState<string>("");
  const [visitDate, setVisitDate] = useState(todayString());
  const [skillGrade, setSkillGrade] = useState<MemberGrade | "">("");
  const [mannerScore, setMannerScore] = useState<number | null>(null);
  const [reinvite, setReinvite] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("members")
      .select("*")
      .eq("is_active", true)
      .order("nickname")
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  const isReady = name.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("guests").insert({
      name: name.trim(),
      referred_by: referredBy || null,
      visit_date: visitDate,
      skill_grade: skillGrade || null,
      manner_score: mannerScore,
      reinvite,
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError("게스트 등록에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    router.push("/guests");
    router.refresh();
  }

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          New Guest
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">게스트 등록</h1>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">게스트 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 박지민"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">소개자</label>
            <select
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            >
              <option value="">선택 안 함</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">참석일</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">실력 등급 (추정)</label>
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSkillGrade(skillGrade === g ? "" : g)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    skillGrade === g
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {g}급
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">매너 평가</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setMannerScore(mannerScore === score ? null : score)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    mannerScore === score
                      ? "border-amber-400 bg-amber-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">재초청 여부</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReinvite(reinvite === true ? null : true)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  reinvite === true
                    ? "border-court-400 bg-court-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                재초청 희망
              </button>
              <button
                type="button"
                onClick={() => setReinvite(reinvite === false ? null : false)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  reinvite === false
                    ? "border-fault-400 bg-fault-400 text-line-25"
                    : "border-line-200 text-line-600"
                }`}
              >
                보류
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">메모</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="특이사항을 적어주세요"
              className="w-full rounded-lg border border-line-200 bg-line-25 px-3 py-2 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>
        </Card>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <Button type="submit" size="lg" className="mt-4 w-full" disabled={!isReady}>
          {submitting ? "등록 중..." : "게스트 등록"}
        </Button>
      </form>
    </main>
  );
}
