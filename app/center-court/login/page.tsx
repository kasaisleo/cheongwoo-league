export default function CenterCourtLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* ── 헤더 ─────────────────────────────────────────── */}
        <header className="mb-8 text-center">
          <p className="eyebrow-en mb-1 text-clay-400">Center Court</p>
          <h1 className="headline-kr text-3xl text-line-900">센터코트</h1>
          <p className="mt-2 text-xs text-line-400">플랫폼 어드민 전용 영역입니다.</p>
        </header>

        {/* ── 로그인 폼 (placeholder) ────────────────────── */}
        <div className="overflow-hidden rounded-[18px] border border-line-200/40 bg-line-50">
          <div className="px-5 py-5">
            <div className="mb-4">
              <label className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                아이디
              </label>
              <div className="h-11 w-full rounded-xl border border-line-200/50 bg-white/60" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
                비밀번호
              </label>
              <div className="h-11 w-full rounded-xl border border-line-200/50 bg-white/60" />
            </div>
            <div className="h-11 w-full rounded-xl bg-line-200/40" />
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-line-300">
          CENTER COURT · Platform Admin Only
        </p>
      </div>
    </main>
  );
}
