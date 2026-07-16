"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "@/lib/hooks/useAdminAccess";
import { toast } from "@/components/ui/Toast";

interface AdminMember {
  id: string;
  name: string;
  nickname: string;
  permission_role: string;
  is_kakao_connected: boolean;
  auth_user_id_prefix: string | null;
}

interface AuthState {
  kakaoPermission: string | null;
  kakaoName: string | null;
  memberId: string | null;
  loading: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  master: "Master", admin: "Admin", manager: "Manager", member: "Member", scorer: "Scorer",
};

function getRoleChipStyle(role: string): CSSProperties {
  if (role === "master") return { borderColor: "rgba(201,168,76,0.45)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" };
  if (role === "admin")  return { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" };
  return { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-muted)" };
}

type SettingsPageClientProps = {
  currentClubId: string;
};

export default function SettingsPageClient({ currentClubId }: SettingsPageClientProps) {
  const router = useRouter();
  const adminAccess = useAdminAccess(currentClubId);

  const [auth, setAuth] = useState<AuthState>({
    kakaoPermission: null, kakaoName: null, memberId: null, loading: true,
  });
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    if (adminAccess === null) return;
    if (!adminAccess.isOwner) { router.replace("/admin"); return; }
    async function load() {
      let kakaoName: string | null = null;
      try {
        const res = await fetch("/api/auth/status");
        const body = await res.json();
        kakaoName = body?.memberName ?? null;
      } catch { /* 무시 */ }
      setAuth({
        kakaoPermission: adminAccess!.kakaoRole,
        kakaoName,
        memberId: adminAccess!.memberId,
        loading: false,
      });
    }
    load();
  }, [adminAccess, router, currentClubId]);

  const loadAdminMembers = useCallback(async () => {
    setLoadingAdmins(true);
    const res = await fetch("/api/admin/members/roles");
    const body = await res.json();
    setLoadingAdmins(false);
    if (res.ok) setAdminMembers(body.members ?? []);
    else toast.error(body.error ?? "목록 조회 실패");
  }, []);

  useEffect(() => { if (!auth.loading) loadAdminMembers(); }, [auth.loading, loadAdminMembers]);

  if (auth.loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm" style={{ color: "var(--admin-muted)" }}>확인 중...</p>
      </main>
    );
  }

  const isKakaoMaster = auth.kakaoPermission === "master";
  const surfaceStyle: CSSProperties = { background: "var(--admin-surface)", borderColor: "var(--admin-border)" };

  return (
    <main className="px-4 pt-6 pb-10">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-[9px]" style={{ color: "var(--admin-muted)" }}>SETTINGS</p>
          <h1 className="headline-kr text-4xl" style={{ color: "var(--admin-text)" }}>시스템 설정</h1>
        </div>
        <Link
          href="/admin"
          className="rounded-[var(--admin-button-radius,6px)] border px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          ← 관리자
        </Link>
      </header>

      {/* 현재 권한 상태 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          현재 상태
        </p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>카카오 계정</p>
              <p className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{auth.kakaoName ?? "로그인 없음"}</p>
            </div>
            <span
              className="rounded-[var(--admin-button-radius,6px)] border px-2.5 py-1 text-xs font-semibold"
              style={
                isKakaoMaster
                  ? { borderColor: "rgba(201,168,76,0.45)", background: "rgba(201,168,76,0.1)", color: "var(--admin-achievement)" }
                  : auth.kakaoPermission
                    ? { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-text)" }
                    : { borderColor: "var(--admin-border)", color: "var(--admin-muted)" }
              }
            >
              {isKakaoMaster ? "master" : auth.kakaoPermission ?? "없음"}
            </span>
          </div>
        </div>
      </section>

      {/* 관리자 목록 */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            운영진 목록
          </p>
          <button
            type="button"
            onClick={loadAdminMembers}
            className="text-[10px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--admin-muted)" }}
          >
            {loadingAdmins ? "로딩 중..." : "새로고침"}
          </button>
        </div>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
          {loadingAdmins ? (
            <div className="p-6 text-center">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
                불러오는 중...
              </p>
            </div>
          ) : adminMembers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: "var(--admin-muted)" }}>관리자 권한을 가진 회원이 없습니다.</p>
            </div>
          ) : adminMembers.map((m, idx) => (
            <Link
              key={m.id}
              href={`/admin/members/${m.id}`}
              className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-line-100/10"
              style={idx < adminMembers.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
            >
              <span className="rounded-sm border px-2 py-0.5 text-[10px] font-bold" style={getRoleChipStyle(m.permission_role)}>
                {ROLE_LABEL[m.permission_role] ?? m.permission_role}
              </span>
              <p className="name-kr-sm" style={{ color: "var(--admin-text)" }}>{m.name}</p>
              <p className="text-xs" style={{ color: "var(--admin-muted)" }}>({m.nickname})</p>
              <span
                className="ml-auto rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold"
                style={m.is_kakao_connected
                  ? { borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-muted)" }
                  : { borderColor: "var(--admin-border)", color: "var(--admin-muted)", opacity: 0.5 }
                }
              >
                {m.is_kakao_connected ? "카카오 연결" : "미연결"}
              </span>
              <span className="text-xs" style={{ color: "var(--admin-muted)" }}>→</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "var(--admin-muted)" }}>
          권한 지정 · 변경 · 해제 · 카카오 연결 해제는 회원 상세 페이지에서 수행합니다.
        </p>
      </section>

      {/* Coming Soon */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          예정 기능
        </p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border" style={surfaceStyle}>
          {[
            { label: "공유 정책 설정", sub: "공유 링크 및 접근 정책 관리" },
            { label: "클럽 기본 설정", sub: "클럽명 · 시즌 · 기본 정보" },
          ].map((item, idx, arr) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-4 py-3"
              style={idx < arr.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--admin-muted)" }}>{item.label}</p>
                <p className="text-[10px]" style={{ color: "var(--admin-muted)", opacity: 0.6 }}>{item.sub}</p>
              </div>
              <span
                className="rounded-sm border px-2 py-0.5 text-[9px] font-semibold"
                style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-muted)" }}
              >
                예정
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
