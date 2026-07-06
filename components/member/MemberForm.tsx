"use client";

/**
 * MemberForm — 회원 등록/수정 공용 폼.
 *
 * mode="create" : 신규 등록 (NewMemberClient에서 사용)
 * mode="edit"   : 기존 수정 (EditMemberModal에서 사용)
 *
 * 필드 체계는 EditMemberModal 기준으로 통일:
 *   이름 / 닉네임 / 휴대폰 / 나이 / 동네 / 주소 /
 *   지역점수 / 직책(edit+isOwner) / 회원상태(edit만) /
 *   선수출신(player_background) / 메모
 *
 * grade 필드 없음 — 더 이상 사용하지 않음.
 */

import { useState } from "react";
import {
  PLAYER_BACKGROUND_OPTIONS,
  type PlayerBackground,
} from "@/lib/constants/member-timeline";

// ── 상수 ─────────────────────────────────────────────────
const PLAYER_BG_DETAIL_OPTIONS = PLAYER_BACKGROUND_OPTIONS.filter(
  (o) => o.value !== "none"
);

const ROLES = ["회장", "부회장", "총무", "경기이사", "홍보이사", "섭외이사", "운영이사"] as const;
const NO_ROLE = "__NO_ROLE__";

// ── 유틸 ─────────────────────────────────────────────────
export function formatPhoneForDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

export function sanitizePhoneDigits(val: string): string {
  return val.replace(/\D/g, "").slice(0, 11);
}

// ── 타입 ─────────────────────────────────────────────────
export interface MemberFormValues {
  name: string;
  nickname: string;
  phoneDigits: string;
  age: string;
  district: string;
  addressFull: string;
  mapoScore: number | null;
  role: string;           // NO_ROLE 또는 직책명
  isDormant: boolean;
  isPlayerOrigin: boolean;
  playerBackgroundDetail: PlayerBackground;
  memo: string;
}

export function getDefaultFormValues(partial?: Partial<MemberFormValues>): MemberFormValues {
  return {
    name: "",
    nickname: "",
    phoneDigits: "",
    age: "",
    district: "",
    addressFull: "",
    mapoScore: null,
    role: NO_ROLE,
    isDormant: false,
    isPlayerOrigin: false,
    playerBackgroundDetail: "elementary",
    memo: "",
    ...partial,
  };
}

interface MemberFormProps {
  mode: "create" | "edit";
  values: MemberFormValues;
  onChange: (patch: Partial<MemberFormValues>) => void;
  isOwner?: boolean;      // 직책 수정 허용 여부
  showStatus?: boolean;   // 회원상태(휴면) 표시 여부 — edit만
  errors?: Record<string, string>;
}

// ── 컴포넌트 ─────────────────────────────────────────────
export function MemberForm({
  mode,
  values,
  onChange,
  isOwner = false,
  showStatus = false,
  errors = {},
}: MemberFormProps) {
  const set = (patch: Partial<MemberFormValues>) => onChange(patch);

  // 입력 공통 클래스
  const inputCls = (err?: string) =>
    `h-11 w-full rounded-sm border px-3 text-sm text-line-900 placeholder:text-line-400 ${
      err
        ? "border-fault-400/60 bg-fault-400/5"
        : "border-line-200/40 bg-line-50"
    }`;

  const labelCls = "mb-1 block text-xs font-semibold text-line-600";

  return (
    <div className="space-y-4">

      {/* ── 이름 ─────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>
          이름 <span className="text-fault-400">*</span>
        </label>
        <input
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="실명"
          className={inputCls(errors.name)}
        />
        {errors.name && <p className="mt-1 text-[11px] text-fault-400">{errors.name}</p>}
      </div>

      {/* ── 닉네임 ───────────────────────────────────────── */}
      <div>
        <label className={labelCls}>
          닉네임{" "}
          <span className="text-line-400 text-[10px] font-normal">(비우면 이름과 동일)</span>
        </label>
        <input
          value={values.nickname}
          onChange={(e) => set({ nickname: e.target.value })}
          placeholder="닉네임"
          className={inputCls()}
        />
      </div>

      {/* ── 휴대폰 ───────────────────────────────────────── */}
      <div>
        <label className={labelCls}>
          휴대폰 번호
          {mode === "edit" && <span className="text-fault-400"> *</span>}
        </label>
        <input
          type="tel"
          inputMode="numeric"
          value={formatPhoneForDisplay(values.phoneDigits)}
          onChange={(e) => set({ phoneDigits: sanitizePhoneDigits(e.target.value) })}
          maxLength={13}
          placeholder="010-0000-0000"
          className={inputCls(errors.phoneDigits)}
        />
        {errors.phoneDigits && (
          <p className="mt-1 text-[11px] text-fault-400">{errors.phoneDigits}</p>
        )}
      </div>

      {/* ── 나이 + 동네 ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>나이</label>
          <input
            type="number"
            inputMode="numeric"
            value={values.age}
            onChange={(e) => set({ age: e.target.value })}
            placeholder="예: 35"
            className={inputCls(errors.age)}
          />
          {errors.age && <p className="mt-1 text-[11px] text-fault-400">{errors.age}</p>}
        </div>
        <div>
          <label className={labelCls}>동네(district)</label>
          <input
            value={values.district}
            onChange={(e) => set({ district: e.target.value })}
            placeholder="예: 망원"
            className={inputCls()}
          />
        </div>
      </div>

      {/* ── 주소 ─────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>주소</label>
        <input
          value={values.addressFull}
          onChange={(e) => set({ addressFull: e.target.value })}
          placeholder="상세 주소"
          className={inputCls()}
        />
      </div>

      {/* ── 지역점수 ─────────────────────────────────────── */}
      <div>
        <label className={labelCls}>
          지역점수 (1~10)
          {errors.mapoScore && (
            <span className="ml-2 font-normal text-fault-400">{errors.mapoScore}</span>
          )}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => set({ mapoScore: values.mapoScore === score ? null : score })}
              className={`flex h-9 w-9 items-center justify-center rounded-sm border text-sm font-semibold transition-colors ${
                values.mapoScore === score
                  ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                  : "border-line-200/40 bg-line-50 text-line-600"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      </div>

      {/* ── 직책 (edit + isOwner만) ───────────────────────── */}
      {mode === "edit" && (
        <div>
          <label className={labelCls}>직책</label>
          <select
            value={values.role}
            onChange={(e) => set({ role: e.target.value })}
            disabled={!isOwner}
            className={`h-11 w-full rounded-sm border px-3 text-sm ${
              isOwner
                ? "border-line-200/40 bg-line-50 text-line-900"
                : "border-line-200/40 bg-line-200/40 text-line-500"
            }`}
          >
            <option value={NO_ROLE}>직책 없음</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {!isOwner && (
            <p className="mt-1 text-[11px] text-line-400">직책 변경은 최고관리자만 가능합니다.</p>
          )}
        </div>
      )}

      {/* ── 회원 상태 (edit만) ───────────────────────────── */}
      {mode === "edit" && showStatus && (
        <div>
          <label className={labelCls}>회원 상태</label>
          <div className="flex gap-2">
            {[
              { val: false, label: "활동" },
              { val: true,  label: "휴면" },
            ].map(({ val, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => set({ isDormant: val })}
                className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
                  values.isDormant === val
                    ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                    : "border-line-200/40 text-line-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-line-400">
            휴면회원은 목록·랭킹에는 남지만 출석 체크·경기 등록 대상에서 제외됩니다.
          </p>
        </div>
      )}

      {/* ── 선수 구분 (player_background) ────────────────── */}
      <div>
        <label className={labelCls}>선수 구분</label>
        <div className="flex gap-2">
          {[
            { val: false, label: "비선출" },
            { val: true,  label: "선출" },
          ].map(({ val, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => set({ isPlayerOrigin: val })}
              className={`flex-1 rounded-sm border py-2 text-sm font-semibold transition-colors ${
                values.isPlayerOrigin === val
                  ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                  : "border-line-200/40 text-line-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {values.isPlayerOrigin && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLAYER_BG_DETAIL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ playerBackgroundDetail: opt.value })}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  values.playerBackgroundDetail === opt.value
                    ? "border-clay-400/60 bg-clay-400/10 text-clay-400"
                    : "border-line-200/40 text-line-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 메모 ─────────────────────────────────────────── */}
      <div>
        <label className={labelCls}>메모 (운영진 전용)</label>
        <textarea
          value={values.memo}
          onChange={(e) => set({ memo: e.target.value })}
          rows={3}
          className="w-full resize-none rounded-sm border border-line-200/40 bg-line-50 px-3 py-2 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>
    </div>
  );
}

// NO_ROLE 상수 export (EditMemberModal에서 재사용)
export { NO_ROLE };
