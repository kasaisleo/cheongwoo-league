"use client";

import { useState } from "react";
import Link from "next/link";

const BASE_URL = "https://cheongwoo-league.vercel.app";

interface ShareItem {
  label: string;
  description: string;
  url: string;
  message?: string;
}

const MEMBER_LINKS: ShareItem[] = [
  {
    label: "홈",
    description: "청우회 리그 메인 페이지",
    url: `${BASE_URL}/`,
    message: `[청우회 리그]\n청우회 리그 앱입니다.\n${BASE_URL}/`,
  },
  {
    label: "출석 체크",
    description: "출석 신청 페이지",
    url: `${BASE_URL}/attendance`,
    message: `[청우회 리그]\n이번 주 출석 체크 부탁드립니다.\n${BASE_URL}/attendance`,
  },
  {
    label: "랭킹",
    description: "현재 시즌 랭킹",
    url: `${BASE_URL}/ranking`,
    message: `[청우회 리그]\n현재 랭킹을 확인하세요.\n${BASE_URL}/ranking`,
  },
  {
    label: "경기 기록",
    description: "최근 경기 결과",
    url: `${BASE_URL}/matches`,
    message: `[청우회 리그]\n최근 경기 결과를 확인하세요.\n${BASE_URL}/matches`,
  },
];

const ADMIN_LINKS: ShareItem[] = [
  {
    label: "경기 입력",
    description: "경기 결과 입력 (관리자 전용)",
    url: `${BASE_URL}/matches/new`,
  },
  {
    label: "회원 등록",
    description: "신규 회원 등록 (관리자 전용)",
    url: `${BASE_URL}/members/new`,
  },
  {
    label: "게스트 등록",
    description: "게스트 등록 (관리자 전용)",
    url: `${BASE_URL}/guests/new`,
  },
  {
    label: "관리자 대시보드",
    description: "운영 현황 및 관리 기능",
    url: `${BASE_URL}/admin`,
  },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors ${
        copied
          ? "border-gold/40 bg-gold/10 text-gold"
          : "border-line-200/40 bg-line-50 text-line-500 hover:border-line-300 hover:text-line-700"
      }`}
    >
      {copied ? "복사됨 ✓" : `${label} 복사`}
    </button>
  );
}

function ShareRow({ item, showMessage = false }: { item: ShareItem; showMessage?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-line-900">{item.label}</p>
        <p className="truncate text-[10px] text-line-500">{item.description}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <CopyButton text={item.url} label="링크" />
        {showMessage && item.message && (
          <CopyButton text={item.message} label="문구" />
        )}
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <main className="px-4 pt-6 pb-10">
      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-xs text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
        <div>
          <p className="eyebrow-en text-clay-400">Share Center</p>
          <h1 className="headline-kr text-4xl text-line-900">공유센터</h1>
        </div>
      </header>

      {/* ── 회원 공유용 링크 ─────────────────────────── */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          회원 공유용
        </p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {MEMBER_LINKS.map((item, idx) => (
            <div
              key={item.url}
              className={idx < MEMBER_LINKS.length - 1 ? "border-b border-line-200/30" : ""}
            >
              <ShareRow item={item} showMessage />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-line-500">
          · 링크: URL만 복사 · 문구: 카카오톡 전송용 메시지 포함
        </p>
      </section>

      {/* ── 운영진 전용 링크 ─────────────────────────── */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">
          운영진 전용
        </p>

        {/* 경고 배너 */}
        <div className="mb-2 flex items-start gap-2 rounded-sm border border-line-300/40 bg-line-200/40 px-3 py-2.5">
          <span className="shrink-0 font-score text-sm text-line-500">⚠</span>
          <div>
            <p className="text-xs font-semibold text-line-700">운영진 전용 링크입니다.</p>
            <p className="text-[10px] text-line-500">일반 회원에게 공유하지 마세요.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {ADMIN_LINKS.map((item, idx) => (
            <div
              key={item.url}
              className={idx < ADMIN_LINKS.length - 1 ? "border-b border-line-200/30" : ""}
            >
              <ShareRow item={item} showMessage={false} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-line-500">
          · 접근 시 운영진 비밀번호가 필요합니다.
        </p>
      </section>
    </main>
  );
}
