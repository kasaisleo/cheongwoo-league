import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

/**
 * Card v2 — Step 15-6 Surface 계층 정리.
 *
 * Surface 계층:
 *   body background  = bg-line-50  (#0E1F33) — 가장 어두운 기본 배경
 *   card surface     = bg-line-100 (#142943) — 카드, 컨텐츠 컨테이너
 *   elevated surface = bg-line-200 (#1E3A5C) — hover, 선택, 강조 상태
 *
 * Border: border-line-200/50 — 이전 border-line-200(100%)보다 미묘하게
 *   ATP/Flashscore 스타일: 테두리가 너무 강하면 "대시보드" 느낌이 됨
 *   반투명 테두리로 surface 간 경계를 자연스럽게
 *
 * shadow-card: 기존 유지 (딥 네이비 위에서 그림자는 미묘하게만 작동)
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line-200/50 bg-line-100 shadow-card",
        className
      )}
      {...props}
    />
  );
}
