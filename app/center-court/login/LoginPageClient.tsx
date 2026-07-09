"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LoginPageClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/platform/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      startTransition(() => {
        router.push("/center-court");
        router.refresh();
      });
    } else {
      const data = await res.json().catch(() => ({}));
      if (data?.error === "invalid_credentials") {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      } else {
        setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    }
  }

  const busy = isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="overflow-hidden rounded-[18px] border border-line-200/40 bg-line-50">
        <div className="px-5 py-5">
          {/* 아이디 */}
          <div className="mb-4">
            <label
              htmlFor="cc-username"
              className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-widest text-line-500"
            >
              아이디
            </label>
            <input
              id="cc-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              className="h-11 w-full rounded-xl border border-line-200/50 bg-white/80 px-3.5 text-sm text-line-900 placeholder:text-line-300 focus:border-clay-400/50 focus:outline-none focus:ring-2 focus:ring-clay-400/20 disabled:opacity-50"
              placeholder="아이디 입력"
            />
          </div>

          {/* 비밀번호 */}
          <div className="mb-5">
            <label
              htmlFor="cc-password"
              className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-widest text-line-500"
            >
              비밀번호
            </label>
            <input
              id="cc-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="h-11 w-full rounded-xl border border-line-200/50 bg-white/80 px-3.5 text-sm text-line-900 placeholder:text-line-300 focus:border-clay-400/50 focus:outline-none focus:ring-2 focus:ring-clay-400/20 disabled:opacity-50"
              placeholder="비밀번호 입력"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="mb-4 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
              {error}
            </p>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="h-11 w-full rounded-xl bg-clay-400 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </div>
      </div>
    </form>
  );
}
