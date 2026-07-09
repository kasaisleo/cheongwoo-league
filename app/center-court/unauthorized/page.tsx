import Link from "next/link";

export default function CenterCourtUnauthorizedPage() {
  return (
    <main className="px-4 pt-10 pb-10">
      <header className="mb-8 text-center">
        <p className="eyebrow-en text-clay-400">Center Court</p>
        <h1 className="headline-kr mt-1 text-4xl text-line-900">센터코트</h1>
      </header>

      <section className="mb-5">
        <div className="rounded-[14px] border border-line-200/40 bg-line-50 p-5 text-center">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
            Access Denied
          </p>
          <p className="mt-3 text-sm font-semibold text-line-900">
            플랫폼 어드민 권한이 없습니다
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-line-500">
            센터코트는 슈퍼매치 플랫폼 운영자 전용 영역입니다.
            <br />
            클럽 관리자 화면은 아래 링크를 이용해주세요.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/admin"
              className="flex h-10 items-center justify-center rounded-sm border border-line-200/40 bg-line-100 text-sm font-semibold text-line-700"
            >
              클럽 관리자 화면으로
            </Link>
            <Link
              href="/"
              className="flex h-10 items-center justify-center rounded-sm text-sm text-line-500"
            >
              홈으로
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
