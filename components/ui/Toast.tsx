"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastTone = "success" | "error";

interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

let listeners: ((toast: ToastMessage) => void)[] = [];
let nextId = 0;

/** 어디서든 호출해서 토스트를 띄우는 함수. alert() 대체용. */
export function showToast(text: string, tone: ToastTone = "success") {
  const toast: ToastMessage = { id: nextId++, tone, text };
  listeners.forEach((listener) => listener(toast));
}

/** 자주 쓰는 공통 메시지 헬퍼 */
export const toast = {
  success: (text: string) => showToast(text, "success"),
  error: (text: string) => showToast(text, "error"),
};

const toneClasses: Record<ToastTone, string> = {
  success: "border-court-400 bg-line-100 text-line-900",
  error: "border-fault-400 bg-line-100 text-line-900",
};

const dotClasses: Record<ToastTone, string> = {
  success: "bg-court-400",
  error: "bg-fault-400",
};

/** 앱 최상단(layout)에 한 번만 렌더링하는 토스트 출력 영역 */
export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 2600);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-card ${toneClasses[t.tone]}`}
        >
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotClasses[t.tone]}`} />
          {t.text}
        </div>
      ))}
    </div>,
    document.body
  );
}
