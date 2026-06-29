import { Card } from "@/components/ui/Card";

/**
 * 카카오 로그인은 성공했지만 members.auth_user_id로 연결된 회원이 없는
 * 경우의 안내 화면. 이번 Step(10-1)에서는 전화번호 자동 매칭을 구현하지
 * 않으므로, 기존 회원이어도 운영진이 수동으로 연결해주기 전까지는 항상 이
 * 화면을 보게 된다. 운영진이 직접 연결하는 화면은 후속 Step(10-2)에서 다룬다.
 */
export default function AuthPendingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-amber-400/30 p-6 text-center">
        <div className="mb-1 inline-flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            Pending
          </p>
        </div>
        <h1 className="mt-1 font-display text-xl font-bold uppercase tracking-tight text-line-900">
          회원 연결 대기 중
        </h1>
        <p className="mt-3 text-sm text-line-600">
          회원 정보와 연결되지 않았습니다.
        </p>
        <p className="mt-1 text-sm text-line-600">
          운영진에게 회원 연결을 요청해주세요.
        </p>
      </Card>
    </main>
  );
}
