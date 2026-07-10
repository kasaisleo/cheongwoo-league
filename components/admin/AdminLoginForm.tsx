"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * AdminLoginForm v2 — 카드 안에 내장되는 Owner 비밀번호 로그인 폼.
 *
 * 변경: <main> 래퍼와 카드 div 제거 — 부모(admin/page.tsx)에서 카드를 감쌈.
 * 로그인 성공 후: redirect 파라미터 있으면 해당 경로, 없으면 /admin.
 */
function AdminLoginInner() {
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

    const redirectTo = searchParams.get("redirect") || "/admin";
    // router.push + router.refresh 레이스 조건으로 캐시된 로그인 화면이 다시 표시되는
    // 버그를 방지하기 위해 전체 페이지 이동을 사용한다.
    window.location.href = redirectTo;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Owner 비밀번호"
        className="h-12 w-full rounded-sm border border-line-200/40 bg-line-100 px-4 text-base text-line-900 placeholder:text-line-500"
      />
      {error && <p className="text-sm text-fault-400">{error}</p>}
      <Button
        type="submit"
        size="lg"
        disabled={loading || password.length === 0}
        className="w-full"
      >
        {loading ? "확인 중..." : "로그인"}
      </Button>
    </form>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}
