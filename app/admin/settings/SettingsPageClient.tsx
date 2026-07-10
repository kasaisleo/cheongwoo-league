"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

interface SearchMember {
  id: string;
  name: string;
  nickname: string;
  permission_role: string;
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
  const [actionId, setActionId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignRole, setAssignRole] = useState("manager");

  useEffect(() => {
    if (adminAccess === null) return;
    if (!adminAccess.isOwner) { router.replace("/admin"); return; }
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      let kakaoName: string | null = null;
      if (session) {
        const { data: member } = await supabase
          .from("members").select("name").eq("auth_user_id", session.user.id).eq("club_id", currentClubId).maybeSingle();
        kakaoName = member?.name ?? null;
      }
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

  async function handleUnlink(memberId: string, name: string) {
    if (!confirm(`${name}의 카카오 연결을 해제하시겠습니까?`)) return;
    setActionId(memberId);
    const res = await fetch("/api/admin/unlink-member", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const body = await res.json();
    setActionId(null);
    if (res.ok) { toast.success(body.message); loadAdminMembers(); }
    else toast.error(body.error ?? "연결 해제 실패");
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    setActionId(memberId);
    const res = await fetch("/api/admin/update-member-role", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, newRole }),
    });
    const body = await res.json();
    setActionId(null);
    if (res.ok) { toast.success(body.message); setAssigningId(null); loadAdminMembers(); }
    else toast.error(body.error ?? "권한 변경 실패");
  }

  if (auth.loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm" style={{ color: "var(--admin-muted)" }}>확인 중...</p>
      </main>
    );
  }

  const isKakaoMaster = auth.kakaoPermission === "master";
  const surfaceStyle: CSSProperties = { background: "var(--admin-surface)", borderColor: "var(--admin-border)" };
  const borderStyle: CSSProperties = { borderColor: "var(--admin-border)" };

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
            <div
              key={m.id}
              className="px-4 py-3"
              style={idx < adminMembers.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}
            >
              <div className="flex items-center gap-2">
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
              </div>

              {m.permission_role !== "master" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={actionId === m.id}
                    onClick={() => handleUpdateRole(m.id, "member")}
                    className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40 transition-opacity hover:opacity-70"
                    style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
                  >
                    권한 해제
                  </button>

                  {assigningId === m.id ? (
                    <>
                      <select
                        value={assignRole}
                        onChange={(e) => setAssignRole(e.target.value)}
                        className="h-6 rounded-sm border px-1.5 text-[10px]"
                        style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-text)" }}
                      >
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        disabled={actionId === m.id}
                        onClick={() => handleUpdateRole(m.id, assignRole)}
                        className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40"
                      >
                        적용
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigningId(null)}
                        className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70"
                        style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAssigningId(m.id); setAssignRole("manager"); }}
                      className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70"
                      style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
                    >
                      권한 변경
                    </button>
                  )}

                  {m.is_kakao_connected && (
                    <button
                      type="button"
                      disabled={actionId === m.id}
                      onClick={() => handleUnlink(m.id, m.name)}
                      className="rounded-sm border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40 hover:border-fault-400 hover:text-fault-400"
                      style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
                    >
                      카카오 해제
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 운영진 권한 지정 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
          권한 지정
        </p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border px-4 py-4" style={surfaceStyle}>
          <p className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>일반 회원 → 운영진 지정</p>
          <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--admin-muted)" }}>
            카카오 계정 연결 후 권한을 부여하면 카카오 로그인으로 관리 기능을 사용할 수 있습니다.
          </p>
          <MemberRoleAssigner currentClubId={currentClubId} onSuccess={loadAdminMembers} />
        </div>
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

/** 일반 회원 검색 후 운영진 지정 서브 컴포넌트 */
function MemberRoleAssigner({ currentClubId, onSuccess }: { currentClubId: string; onSuccess: () => void }) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState("manager");
  const [acting, setActing] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("members").select("id, name, nickname, permission_role")
      .or(`name.ilike.%${query}%,nickname.ilike.%${query}%`)
      .eq("club_id", currentClubId)
      .eq("is_active", true).limit(10);
    setResults(data ?? []);
    setSearching(false);
  }

  async function handleAssign() {
    if (!selectedId) return;
    setActing(true);
    const res = await fetch("/api/admin/update-member-role", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: selectedId, newRole: role }),
    });
    const body = await res.json();
    setActing(false);
    if (res.ok) {
      toast.success(body.message);
      setQuery(""); setResults([]); setSelectedId(null);
      onSuccess();
    } else {
      toast.error(body.error ?? "권한 지정 실패");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="이름 또는 닉네임 검색"
          className="h-9 flex-1 rounded-[var(--admin-button-radius,6px)] border px-3 text-sm placeholder:[color:var(--admin-muted)]"
          style={{ background: "var(--admin-surface-raised, var(--admin-surface))", borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="rounded-[var(--admin-button-radius,6px)] border px-3 text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-70"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
        >
          {searching ? "..." : "검색"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 transition-colors"
              style={
                selectedId === m.id
                  ? { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)" }
                  : { borderColor: "var(--admin-border)", background: "var(--admin-surface)" }
              }
            >
              <input
                type="radio"
                name="assign-member"
                value={m.id}
                checked={selectedId === m.id}
                onChange={() => setSelectedId(m.id)}
                className="accent-clay-400"
              />
              <span className="name-kr-sm" style={{ color: "var(--admin-text)" }}>{m.name}</span>
              <span className="text-xs" style={{ color: "var(--admin-muted)" }}>({m.nickname})</span>
              <span className="ml-auto rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold" style={getRoleChipStyle(m.permission_role)}>
                {ROLE_LABEL[m.permission_role] ?? m.permission_role}
              </span>
            </label>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 flex-1 rounded-[var(--admin-button-radius,6px)] border px-2 text-sm"
            style={{ background: "var(--admin-surface-raised, var(--admin-surface))", borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
          >
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={acting}
            className="rounded-[var(--admin-button-radius,6px)] bg-clay-400 px-4 text-sm font-bold text-line-25 disabled:opacity-40"
          >
            {acting ? "지정 중..." : "권한 지정"}
          </button>
        </div>
      )}
    </div>
  );
}
