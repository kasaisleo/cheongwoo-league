import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/platform-admin-session";
import LoginPageClient from "./LoginPageClient";

export default async function CenterCourtLoginPage() {
  const session = await getPlatformAdminSession();
  if (session) {
    redirect("/center-court");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* ── 헤더 ─────────────────────────────────────────── */}
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-clay-400">Center Court</p>
          <h1 className="headline-kr text-3xl text-line-900">센터코트</h1>
          <p className="mt-2 text-xs text-line-400">플랫폼 어드민 전용 영역입니다.</p>
        </header>

        <LoginPageClient />

        <p className="mt-4 text-center text-[10px] text-line-300">
          CENTER COURT · Platform Admin Only
        </p>
      </div>
    </main>
  );
}
