"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await fetch("/api/platform/auth/logout", { method: "POST" });
    router.push("/center-court/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="rounded-sm border border-line-200/40 bg-line-100 px-2.5 py-1 text-[10px] font-semibold text-line-500 transition-opacity hover:opacity-70 disabled:opacity-40"
    >
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
