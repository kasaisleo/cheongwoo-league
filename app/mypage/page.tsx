import { Card } from "@/components/ui/Card";

/**
 * 마이페이지 — stub 페이지. Step 11-1에서 /mypage 경로만 확보하고,
 * 실제 회원 정보 표시/수정 기능은 후속 Step에서 구현한다.
 */
export default function MyPage() {
  return (
    <main className="px-4 pt-6">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">
          My Page
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          마이페이지
        </h1>
      </header>

      <Card className="p-6 text-center text-sm text-line-400">
        마이페이지 기능은 준비 중입니다.
      </Card>
    </main>
  );
}
