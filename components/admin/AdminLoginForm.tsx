"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

function AdminLoginInner() {
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

    const redirectTo = searchParams.get("redirect") || "/";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm overflow-hidden rounded-[14px] border border-clay-400/30 bg-line-50 p-6">
        <p className="eyebrow-en text-clay-400">Admin Access</p>
        <h1 className="headline-kr mt-1 text-2xl text-line-900">운영진 로그인</h1>
        <p className="mt-1 text-sm text-line-500">
          경기 결과 입력 등 관리 기능은 운영진 비밀번호가 필요해요.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="운영진 비밀번호"
            className="h-12 w-full rounded-sm border border-line-200/40 bg-line-100 px-4 text-base text-line-900 placeholder:text-line-500"
          />
          {error && <p className="text-sm text-fault-400">{error}</p>}
          <Button type="submit" size="lg" disabled={loading || password.length === 0} className="w-full">
            {loading ? "확인 중..." : "로그인"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs text-line-500 hover:text-line-700">
            회원 카카오 로그인 →
          </Link>
        </div>
      </div>
    </main>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}
