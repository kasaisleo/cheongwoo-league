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
      {/* 아이디 */}
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="cc-username"
          style={{
            display: "block",
            marginBottom: 6,
            color: "rgba(245,240,232,0.45)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
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
          placeholder="아이디 입력"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 10,
            border: "1px solid rgba(245,240,232,0.15)",
            background: "rgba(245,240,232,0.05)",
            color: "#f5f0e8",
            fontSize: 14,
            padding: "0 14px",
            outline: "none",
            boxSizing: "border-box",
            opacity: busy ? 0.5 : 1,
          }}
        />
      </div>

      {/* 비밀번호 */}
      <div style={{ marginBottom: 18 }}>
        <label
          htmlFor="cc-password"
          style={{
            display: "block",
            marginBottom: 6,
            color: "rgba(245,240,232,0.45)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
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
          placeholder="비밀번호 입력"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 10,
            border: "1px solid rgba(245,240,232,0.15)",
            background: "rgba(245,240,232,0.05)",
            color: "#f5f0e8",
            fontSize: 14,
            padding: "0 14px",
            outline: "none",
            boxSizing: "border-box",
            opacity: busy ? 0.5 : 1,
          }}
        />
      </div>

      {/* 에러 */}
      {error && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.25)",
            background: "rgba(248,113,113,0.08)",
            padding: "10px 14px",
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* 로그인 버튼 */}
      <button
        type="submit"
        disabled={busy || !username || !password}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: "none",
          background:
            busy || !username || !password
              ? "rgba(139,92,246,0.25)"
              : "rgba(139,92,246,0.75)",
          color: "#f5f0e8",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          cursor: busy || !username || !password ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {busy ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
