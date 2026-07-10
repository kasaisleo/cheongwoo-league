import TennisBallLoader from "@/components/common/TennisBallLoader";

/**
 * /c/[slug]/* 로딩 UI.
 *
 * layout.tsx가 먼저 렌더링되어 [data-club-skin] wrapper + CSS 변수를 주입한다.
 * 이 컴포넌트는 layout wrapper 안에서 렌더링되므로
 * var(--club-bg) 등 스킨 변수를 params 없이도 올바르게 상속받는다.
 */
export default function ClubLoading() {
  return (
    <main
      className="flex min-h-[100svh] w-full items-center justify-center px-4"
      style={{ background: "var(--club-bg)" }}
    >
      <TennisBallLoader variant="inline" />
    </main>
  );
}
