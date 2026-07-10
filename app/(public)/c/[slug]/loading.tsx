import TennisBallLoader from "@/components/common/TennisBallLoader";

/**
 * /c/[slug]/* 공통 로딩 UI.
 *
 * layout.tsx가 먼저 렌더링되어 [data-club-skin] wrapper + CSS 변수를 주입.
 * TennisBallLoader의 .cw-tennis-ball과 .cw-loader-eyebrow는
 * var(--club-primary)를 직접 참조하므로 스킨 색상이 자동 적용됨.
 * 청우회 → 라임 볼, 나마스테 → 퍼플 볼.
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
