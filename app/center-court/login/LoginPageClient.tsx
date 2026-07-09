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
        setError("Invalid username or password.");
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  }

  const busy = isPending;

  return (
    <>
      <style>{`
        .cc-input {
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: 1px solid rgba(245,240,232,0.15);
          background: rgba(2,6,4,0.70);
          color: #f5f0e8;
          font-size: 14px;
          padding: 0 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cc-input:focus {
          border-color: rgba(139,92,246,0.6);
          box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
        }
        .cc-input:disabled { opacity: 0.45; }
        .cc-sign-in-btn {
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: none;
          color: #f5f0e8;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          transition: background 0.2s, box-shadow 0.2s;
          cursor: pointer;
        }
        .cc-sign-in-btn:not(:disabled) {
          background: rgba(109,40,217,0.75);
        }
        .cc-sign-in-btn:not(:disabled):hover {
          background: rgba(109,40,217,0.88);
          box-shadow: 0 0 16px rgba(109,40,217,0.3);
        }
        .cc-sign-in-btn:disabled {
          background: rgba(109,40,217,0.22);
          cursor: not-allowed;
        }
      `}</style>
      <form onSubmit={handleSubmit} noValidate>

        {/* USERNAME */}
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="cc-username"
            style={{
              display: "block",
              marginBottom: 6,
              color: "rgba(245,240,232,0.4)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              fontFamily: "Georgia, serif",
            }}
          >
            USERNAME
          </label>
          <input
            id="cc-username"
            className="cc-input"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            placeholder="Enter username"
            style={{ opacity: busy ? 0.45 : 1 }}
          />
        </div>

        {/* PASSWORD */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="cc-password"
            style={{
              display: "block",
              marginBottom: 6,
              color: "rgba(245,240,232,0.4)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              fontFamily: "Georgia, serif",
            }}
          >
            PASSWORD
          </label>
          <input
            id="cc-password"
            className="cc-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            placeholder="Enter password"
            style={{ opacity: busy ? 0.45 : 1 }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 8,
              border: "1px solid rgba(248,113,113,0.28)",
              background: "rgba(60,10,10,0.6)",
              padding: "10px 14px",
              color: "#fca5a5",
              fontSize: 12,
              letterSpacing: "0.01em",
            }}
          >
            {error}
          </div>
        )}

        {/* SIGN IN */}
        <button
          type="submit"
          disabled={busy || !username || !password}
          className="cc-sign-in-btn"
        >
          {busy ? "Signing in…" : "SIGN IN"}
        </button>
      </form>
    </>
  );
}
