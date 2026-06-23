"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("비밀번호가 올바르지 않습니다.");
      return;
    }

    const redirectTo = searchParams.get("redirect") || "/matches/new";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm border-clay-400/30 p-6">
      <div className="mb-1 inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-clay-400" />
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          Mapo Cheongwoo Club
        </p>
      </div>
      <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-line-900">운영진 로그인</h1>
      <p className="mt-1 text-sm text-line-500">경기 결과 입력 등 관리 기능은 운영진 비밀번호가 필요해요.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="운영진 비밀번호"
          className="h-12 w-full rounded-lg border border-line-200 bg-line-50 px-4 text-base text-line-900 placeholder:text-line-400"
        />
        {error && <p className="text-sm text-fault-400">{error}</p>}
        <Button type="submit" size="lg" disabled={loading || password.length === 0} className="w-full">
          {loading ? "확인 중..." : "로그인"}
        </Button>
      </form>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
