"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { deriveMemberStatus, type AdminMemberStatus } from "@/lib/admin-member-status";
import type { AdminMemberRow } from "./page";

type ActiveFilter = "all" | "active" | "dormant" | "withdrawn";
type KakaoFilter = "all" | "linked" | "unlinked";
type RoleFilter = "all" | "master" | "admin" | "manager" | "member" | "scorer";
type SortOption = "name" | "created_asc" | "created_desc";

const ROLE_LABEL: Record<string, string> = {
  master: "Master", admin: "Admin", manager: "Manager", member: "Member", scorer: "Scorer",
};

const FILTER_LABEL_ACTIVE: Record<ActiveFilter, string> = { all: "전체", active: "활동", dormant: "휴면", withdrawn: "탈퇴" };
const FILTER_LABEL_KAKAO: Record<KakaoFilter, string> = { all: "전체", linked: "연결됨", unlinked: "미연결" };
// created_at은 row 생성 시각일 뿐 별도 "가입일" 컬럼이 없어 문구를 등록 기준으로 명확히 한다.
const SORT_LABEL: Record<SortOption, string> = { name: "이름순", created_asc: "오래된 등록순", created_desc: "최근등록순" };

function chipStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: "var(--admin-accent-soft)", border: "1px solid var(--admin-accent)", color: "var(--admin-accent)" }
    : { background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-muted)" };
}

export function MembersPageClient({ members }: { members: AdminMemberRow[] }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [kakaoFilter, setKakaoFilter] = useState<KakaoFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = members.filter((m) => {
      const matchesQuery = !q ||
        m.name.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q);
      const matchesActive = activeFilter === "all" || deriveMemberStatus(m.is_active, m.deleted_at) === activeFilter;
      // auth_user_id를 source of truth로 쓴다 — is_kakao_linked는 실제 데이터에서 auth_user_id와
      // 어긋나는 row가 있어(연결은 됐는데 플래그만 false) 신뢰하지 않는다.
      const matchesKakao = kakaoFilter === "all" || (kakaoFilter === "linked" ? !!m.auth_user_id : !m.auth_user_id);
      // permission_role이 null인 회원도 일반회원으로 취급한다(스키마상 nullable, 현재 데이터엔 없지만 방어적으로 처리).
      const matchesRole = roleFilter === "all" ||
        (roleFilter === "member" ? (m.permission_role === "member" || !m.permission_role) : m.permission_role === roleFilter);
      return matchesQuery && matchesActive && matchesKakao && matchesRole;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "created_asc") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });

    return rows;
  }, [members, query, activeFilter, kakaoFilter, roleFilter, sortBy]);

  const surfaceStyle: React.CSSProperties = { background: "var(--admin-surface)", border: "1px solid var(--admin-border)" };

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        eyebrow="MEMBERS"
        title="회원 관리"
        description="이름·닉네임·전화번호로 검색하고 상태별로 필터링합니다."
      />

      {/* ── 검색 ─────────────────────────────────────────── */}
      <section className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 · 닉네임 · 전화번호 검색"
          className="h-10 w-full rounded-[var(--admin-button-radius,6px)] border px-3 text-sm placeholder:[color:var(--admin-muted)]"
          style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
        />
      </section>

      {/* ── 필터 ─────────────────────────────────────────── */}
      <section className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABEL_ACTIVE) as ActiveFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setActiveFilter(f)}
              className="rounded-[var(--admin-button-radius,6px)] px-2.5 py-1 text-xs font-semibold transition-colors"
              style={chipStyle(activeFilter === f)}>
              {FILTER_LABEL_ACTIVE[f]}
            </button>
          ))}
          <span className="mx-1 self-center text-xs" style={{ color: "var(--admin-border)" }}>|</span>
          {(Object.keys(FILTER_LABEL_KAKAO) as KakaoFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setKakaoFilter(f)}
              className="rounded-[var(--admin-button-radius,6px)] px-2.5 py-1 text-xs font-semibold transition-colors"
              style={chipStyle(kakaoFilter === f)}>
              {FILTER_LABEL_KAKAO[f]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "master", "admin", "manager", "member", "scorer"] as RoleFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setRoleFilter(f)}
              className="rounded-[var(--admin-button-radius,6px)] px-2.5 py-1 text-xs font-semibold transition-colors"
              style={chipStyle(roleFilter === f)}>
              {f === "all" ? "역할 전체" : ROLE_LABEL[f]}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="ml-auto h-8 rounded-[var(--admin-button-radius,6px)] border px-2 text-xs font-semibold"
            style={{ background: "var(--admin-surface)", borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
          >
            {(Object.keys(SORT_LABEL) as SortOption[]).map((s) => (
              <option key={s} value={s}>{SORT_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ── 결과 수 ──────────────────────────────────────── */}
      <div className="mb-2 text-[11px] font-semibold" style={{ color: "var(--admin-muted)" }}>
        {filtered.length}명 {filtered.length !== members.length && `(전체 ${members.length}명 중)`}
      </div>

      {/* ── 목록 ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--admin-card-radius,14px)] p-6 text-center" style={surfaceStyle}>
          <p className="text-sm" style={{ color: "var(--admin-muted)" }}>
            {members.length === 0 ? "등록된 회원이 없어요." : "검색 결과가 없어요."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)]" style={surfaceStyle}>
          {filtered.map((m, idx) => (
            <MemberRow key={m.id} member={m} isLast={idx === filtered.length - 1} />
          ))}
        </div>
      )}
    </main>
  );
}

const STATUS_BADGE_LABEL: Record<AdminMemberStatus, string> = { active: "활동", dormant: "휴면", withdrawn: "탈퇴" };

function MemberRow({ member, isLast }: { member: AdminMemberRow; isLast: boolean }) {
  const isLinked = !!member.auth_user_id;
  const status = deriveMemberStatus(member.is_active, member.deleted_at);
  const isElevatedRole = !!member.permission_role && member.permission_role !== "member";
  const createdDate = member.created_at.slice(0, 10);

  return (
    <Link href={`/admin/members/${member.id}`}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]"
        style={isLast ? undefined : { borderBottom: "1px solid var(--admin-border)" }}
      >
        <div className="min-w-0 flex-1">
          {/* 1순위: 이름 + 닉네임 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold" style={{ color: "var(--admin-text)" }}>{member.name}</span>
            {member.nickname && member.nickname !== member.name && (
              <span className="text-xs" style={{ color: "var(--admin-muted)" }}>({member.nickname})</span>
            )}
          </div>

          {/* 2순위: 상태 배지 — 정상 상태는 표시하지 않고 이상 신호만 강조 */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold" style={{
              background: "var(--admin-surface-raised, var(--admin-surface))",
              border: "1px solid var(--admin-border)",
              color: "var(--admin-muted)",
            }}>
              {member.member_type}
            </span>
            {isElevatedRole && (
              <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold" style={{
                background: "var(--admin-accent-soft)",
                border: "1px solid var(--admin-accent)",
                color: "var(--admin-accent)",
              }}>
                {ROLE_LABEL[member.permission_role] ?? member.permission_role}
              </span>
            )}
            {!isLinked && (
              <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold" style={{
                background: "var(--admin-alert-soft)",
                border: "1px solid var(--admin-alert)",
                color: "var(--admin-alert)",
              }}>
                카카오 미연결
              </span>
            )}
            {status !== "active" && (
              <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold" style={{
                background: "var(--admin-alert-soft)",
                border: "1px solid var(--admin-alert)",
                color: "var(--admin-alert)",
              }}>
                {STATUS_BADGE_LABEL[status]}
              </span>
            )}
            {member.is_dormant && (
              <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold" style={{
                background: "var(--admin-surface-raised, var(--admin-surface))",
                border: "1px solid var(--admin-border)",
                color: "var(--admin-muted)",
              }}>
                활동 제외
              </span>
            )}
          </div>

          {/* 3순위: 등록일 */}
          <p className="mt-1 text-[9px]" style={{ color: "var(--admin-muted)", opacity: 0.7 }}>
            {createdDate} 등록
          </p>
        </div>

        <span className="flex-shrink-0 text-xs" style={{ color: "var(--admin-muted)" }}>→</span>
      </div>
    </Link>
  );
}
