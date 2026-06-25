"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-3 flex items-center gap-1 text-sm font-semibold text-line-600"
    >
      <span aria-hidden="true">←</span> 회원목록
    </button>
  );
}
