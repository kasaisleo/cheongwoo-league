import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * LoginClubSelectPrompt — /login에 club context(returnUrl의 /c/{slug})가
 * 전혀 없을 때 보여주는 안내 화면.
 *
 * selected_club_id 쿠키나 DEFAULT_CLUB_ID로 클럽을 임의 추정해 로그인 폼을
 * 보여주지 않는다 — 클럽이 특정되지 않은 상태에서 OAuth를 시작하면 의도치
 * 않은 클럽으로 로그인/연결될 수 있기 때문이다. 대신 클럽을 먼저 선택하도록
 * 안내한다. club 정체성이 없는 화면이라 --club-* 토큰이 아닌 앱 기본
 * 뉴트럴 팔레트(clay/line)를 그대로 쓴다.
 */
export default function LoginClubSelectPrompt() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-clay-400/30 p-6 text-center">
        <p className="eyebrow-en text-clay-400">Club Login</p>
        <h1 className="headline-kr mt-1 text-2xl text-line-900">클럽을 먼저 선택해주세요</h1>
        <p className="mt-2 text-sm text-line-500">
          로그인은 이용 중인 클럽 페이지에서 진행됩니다.
          <br />
          클럽을 선택한 뒤 다시 로그인해주세요.
        </p>

        <Link
          href="/"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-clay-400/10 text-sm font-bold text-clay-400 transition-opacity hover:opacity-90"
        >
          클럽 선택하러 가기
        </Link>
      </Card>
    </main>
  );
}
