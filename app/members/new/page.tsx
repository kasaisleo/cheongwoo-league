"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { INITIAL_RATING_BY_GRADE } from "@/lib/elo";
import type { MemberGrade } from "@/lib/supabase/database.types";

const GRADES: MemberGrade[] = ["A", "B", "C", "D"];

export default function NewMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState<MemberGrade>("C");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReady = name.trim().length > 0 && nickname.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("members").insert({
      name: name.trim(),
      nickname: nickname.trim(),
      grade,
    });

    setSubmitting(false);

    if (insertError) {
      setError("회원 등록에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    router.push("/members");
    router.refresh();
  }

  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          New Member
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">회원 등록</h1>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김철수"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 철수"
              className="h-11 w-full rounded-lg border border-line-200 bg-line-25 px-3 text-sm text-line-900 placeholder:text-line-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-line-600">등급</label>
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    grade === g
                      ? "border-clay-400 bg-clay-400 text-line-25"
                      : "border-line-200 text-line-600"
                  }`}
                >
                  {g}급
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-line-400">
              초기 레이팅 {INITIAL_RATING_BY_GRADE[grade]}점으로 시작합니다.
            </p>
          </div>
        </Card>

        {error && <p className="mt-3 text-sm text-fault-400">{error}</p>}

        <Button type="submit" size="lg" className="mt-4 w-full" disabled={!isReady}>
          {submitting ? "등록 중..." : "회원 등록"}
        </Button>
      </form>
    </main>
  );
}
