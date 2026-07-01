"use client";

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
  auth_user_id: string | null;
  is_kakao_linked: boolean;
}

interface SearchMember {
  id: string;
  name: string;
  nickname: string;
  permission_role: string;
}

interface AuthState {
  cookieRole: "owner" | "manager" | null;
  kakaoPermission: string | null;
  kakaoName: string | null;
  memberId: string | null;
  loading: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  master: "Master", admin: "Admin", manager: "Manager", member: "Member", scorer: "Scorer",
};
const ROLE_CHIP: Record<string, string> = {
  master: "border-gold/40 bg-gold/10 text-gold",
  admin: "border-clay-400/40 bg-clay-400/10 text-clay-400",
  manager: "border-line-400/40 bg-line-200 text-line-700",
  member: "border-line-200/40 bg-line-100 text-line-500",
  scorer: "border-line-200/40 bg-line-100 text-line-500",
};

export default function SettingsPage() {
  const router = useRouter();
  const adminAccess = useAdminAccess();

  const [auth, setAuth] = useState<AuthState>({
    cookieRole: null, kakaoPermission: null,
    kakaoName: null, memberId: null, loading: true,
  });
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ success?: string; error?: string } | null>(null);
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignRole, setAssignRole] = useState("manager");

  // auth 상태 로드
  useEffect(() => {
    if (adminAccess === null) return;
    if (!adminAccess.isOwner) { router.replace("/admin"); return; }
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      let kakaoName: string | null = null;
      if (session) {
        const { data: member } = await supabase
          .from("members").select("name").eq("auth_user_id", session.user.id).maybeSingle();
        kakaoName = member?.name ?? null;
      }
      setAuth({
        cookieRole: adminAccess!.cookieRole,
        kakaoPermission: adminAccess!.kakaoRole,
        kakaoName,
        memberId: adminAccess!.memberId,
        loading: false,
      });
    }
    load();
  }, [adminAccess, router]);

  // 관리자 목록
  const loadAdminMembers = useCallback(async () => {
    setLoadingAdmins(true);
    const res = await fetch("/api/admin/members/roles");
    const body = await res.json();
    setLoadingAdmins(false);
    if (res.ok) setAdminMembers(body.members ?? []);
    else toast.error(body.error ?? "목록 조회 실패");
  }, []);

  useEffect(() => { if (!auth.loading) loadAdminMembers(); }, [auth.loading, loadAdminMembers]);

  async function handlePromoteOwner() {
    setPromoting(true); setPromoteResult(null);
    const res = await fetch("/api/admin/promote-owner", { method: "POST" });
    const body = await res.json();
    setPromoting(false);
    if (!res.ok) { setPromoteResult({ error: body.error }); return; }
    setPromoteResult({ success: body.message });
    toast.success(body.message);
    setAuth((prev) => ({ ...prev, kakaoPermission: "master" }));
  }

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
        <p className="text-sm text-line-500">확인 중...</p>
      </main>
    );
  }

  const isCookieOwner = auth.cookieRole === "owner";
  const isKakaoMaster = auth.kakaoPermission === "master";
  const canPromote = isCookieOwner && auth.kakaoName !== null && !isKakaoMaster;

  return (
    <main className="px-4 pt-6 pb-10">
      {/* 헤더 */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow-en text-clay-400">Admin · Settings</p>
          <h1 className="headline-kr text-4xl text-line-900">시스템 설정</h1>
        </div>
        <Link href="/admin"
          className="rounded-sm border border-line-200/40 px-2.5 py-1.5 text-xs font-semibold text-line-500 hover:text-line-700">
          ← 관리자
        </Link>
      </header>

      {/* 현재 권한 상태 */}
      <section className="mb-5">
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Current Status</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          <div className="flex items-center justify-between border-b border-line-200/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-line-900">Owner Session</p>
              <p className="text-[10px] text-line-500">cw_admin_session 쿠키 기반</p>
            </div>
            <span className={`rounded-sm border px-2.5 py-1 text-xs font-semibold ${
              isCookieOwner ? "border-gold/40 bg-gold/10 text-gold"
              : auth.cookieRole === "manager" ? "border-clay-400/40 bg-clay-400/10 text-clay-400"
              : "border-line-200/40 bg-line-100 text-line-500"}`}>
              {isCookieOwner ? "Owner" : auth.cookieRole === "manager" ? "Manager" : "없음"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-line-900">Kakao Account</p>
              <p className="text-[10px] text-line-500">{auth.kakaoName ?? "로그인 없음"}</p>
            </div>
            <span className={`rounded-sm border px-2.5 py-1 text-xs font-semibold ${
              isKakaoMaster ? "border-gold/40 bg-gold/10 text-gold"
              : auth.kakaoPermission ? "border-line-200/40 bg-line-100 text-line-600"
              : "border-line-200/40 bg-line-50 text-line-500"}`}>
              {isKakaoMaster ? "master" : auth.kakaoPermission ?? "없음"}
            </span>
          </div>
        </div>
      </section>

      {/* Owner 카카오 연결 */}
      {isCookieOwner && (
        <section className="mb-5">
          <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Owner Account</p>
          <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-4">
            <p className="text-sm font-semibold text-line-900">Owner 카카오 계정 연결</p>
            <p className="mt-0.5 text-xs text-line-500">현재 로그인한 카카오 계정을 Owner(master) 권한으로 연결합니다.</p>
            {!auth.kakaoName && (
              <div className="mt-3 rounded-sm border border-line-200/40 bg-line-100 px-3 py-2">
                <p className="text-xs text-line-500">카카오 로그인 세션이 없습니다.
                  <Link href="/login?returnUrl=/admin/settings" className="ml-1 text-clay-400">카카오 로그인 →</Link>
                </p>
              </div>
            )}
            {auth.kakaoName && isKakaoMaster && (
              <div className="mt-3 rounded-sm border border-gold/30 bg-gold/5 px-3 py-2">
                <p className="text-xs font-semibold text-gold">✓ {auth.kakaoName} 계정이 이미 Owner 권한으로 연결되어 있습니다.</p>
              </div>
            )}
            {canPromote && (
              <button type="button" disabled={promoting} onClick={handlePromoteOwner}
                className="mt-3 w-full rounded-sm bg-clay-400 py-2.5 text-sm font-bold text-line-25 disabled:opacity-40">
                {promoting ? "처리 중..." : `${auth.kakaoName} → Owner 권한 연결하기`}
              </button>
            )}
            {promoteResult?.success && <p className="mt-2 text-xs font-semibold text-gold">{promoteResult.success}</p>}
            {promoteResult?.error && <p className="mt-2 text-xs text-fault-400">{promoteResult.error}</p>}
          </div>
        </section>
      )}

      {/* 관리자 목록 */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Admin Members</p>
          <button type="button" onClick={loadAdminMembers}
            className="text-[10px] font-semibold text-line-500 hover:text-line-700">
            {loadingAdmins ? "로딩 중..." : "새로고침"}
          </button>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {loadingAdmins ? (
            <div className="p-6 text-center">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Loading...</p>
            </div>
          ) : adminMembers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-line-500">관리자 권한을 가진 회원이 없습니다.</p>
            </div>
          ) : adminMembers.map((m, idx) => (
            <div key={m.id}
              className={`px-4 py-3 ${idx < adminMembers.length - 1 ? "border-b border-line-200/30" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold ${ROLE_CHIP[m.permission_role] ?? ROLE_CHIP.member}`}>
                  {ROLE_LABEL[m.permission_role] ?? m.permission_role}
                </span>
                <p className="text-sm font-semibold text-line-900">{m.name}</p>
                <p className="text-xs text-line-500">({m.nickname})</p>
                <span className={`ml-auto rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${
                  m.auth_user_id ? "border-line-200/40 bg-line-100 text-line-500" : "border-line-200/30 text-line-400"}`}>
                  {m.auth_user_id ? "카카오 연결" : "미연결"}
                </span>
              </div>

              {m.permission_role !== "master" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button"
                    disabled={actionId === m.id}
                    onClick={() => handleUpdateRole(m.id, "member")}
                    className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 disabled:opacity-40 hover:border-line-300">
                    권한 해제
                  </button>

                  {assigningId === m.id ? (
                    <>
                      <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                        className="h-6 rounded-sm border border-line-200/40 bg-line-100 px-1.5 text-[10px] text-line-900">
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button type="button" disabled={actionId === m.id}
                        onClick={() => handleUpdateRole(m.id, assignRole)}
                        className="rounded-sm border border-clay-400/60 bg-clay-400/10 px-2 py-0.5 text-[10px] font-semibold text-clay-400 disabled:opacity-40">
                        적용
                      </button>
                      <button type="button" onClick={() => setAssigningId(null)}
                        className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500">
                        취소
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setAssigningId(m.id); setAssignRole("manager"); }}
                      className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 hover:border-line-300">
                      권한 변경
                    </button>
                  )}

                  {m.auth_user_id && (
                    <button type="button" disabled={actionId === m.id}
                      onClick={() => handleUnlink(m.id, m.name)}
                      className="rounded-sm border border-line-200/40 px-2 py-0.5 text-[10px] font-semibold text-line-500 disabled:opacity-40 hover:border-fault-400 hover:text-fault-400">
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
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Assign Role</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50 px-4 py-4">
          <p className="text-sm font-semibold text-line-900">일반 회원 → 운영진 지정</p>
          <p className="mt-0.5 mb-3 text-xs text-line-500">
            카카오 계정 연결 후 권한을 부여하면 카카오 로그인으로 관리 기능을 사용할 수 있습니다.
          </p>
          <MemberRoleAssigner onSuccess={loadAdminMembers} />
        </div>
      </section>

      {/* Coming Soon */}
      <section>
        <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-line-500">Coming Soon</p>
        <div className="overflow-hidden rounded-[14px] border border-line-200/40 bg-line-50">
          {[
            { label: "공유 정책 설정", sub: "공유 링크 및 접근 정책 관리" },
            { label: "클럽 기본 설정", sub: "클럽명 · 시즌 · 기본 정보" },
          ].map((item, idx, arr) => (
            <div key={item.label}
              className={`flex items-center justify-between px-4 py-3 ${idx < arr.length - 1 ? "border-b border-line-200/30" : ""}`}>
              <div>
                <p className="text-sm font-semibold text-line-500">{item.label}</p>
                <p className="text-[10px] text-line-400">{item.sub}</p>
              </div>
              <span className="rounded-sm border border-line-200/40 bg-line-100 px-2 py-0.5 text-[9px] font-semibold text-line-500">예정</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/** 일반 회원 검색 후 운영진 지정 서브 컴포넌트 */
function MemberRoleAssigner({ onSuccess }: { onSuccess: () => void }) {
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
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="이름 또는 닉네임 검색"
          className="h-9 flex-1 rounded-sm border border-line-200/40 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-500" />
        <button type="button" onClick={handleSearch} disabled={searching}
          className="rounded-sm border border-line-200/40 px-3 text-xs font-semibold text-line-600 disabled:opacity-40">
          {searching ? "..." : "검색"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((m) => (
            <label key={m.id}
              className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 transition-colors ${
                selectedId === m.id ? "border-clay-400/60 bg-clay-400/10" : "border-line-200/40 bg-line-50"}`}>
              <input type="radio" name="assign-member" value={m.id}
                checked={selectedId === m.id} onChange={() => setSelectedId(m.id)}
                className="accent-clay-400" />
              <span className="text-sm font-semibold text-line-900">{m.name}</span>
              <span className="text-xs text-line-500">({m.nickname})</span>
              <span className={`ml-auto rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold ${ROLE_CHIP[m.permission_role] ?? ROLE_CHIP.member}`}>
                {ROLE_LABEL[m.permission_role] ?? m.permission_role}
              </span>
            </label>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="flex gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="h-9 flex-1 rounded-sm border border-line-200/40 bg-line-100 px-2 text-sm text-line-900">
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" onClick={handleAssign} disabled={acting}
            className="rounded-sm bg-clay-400 px-4 text-sm font-bold text-line-25 disabled:opacity-40">
            {acting ? "지정 중..." : "권한 지정"}
          </button>
        </div>
      )}
    </div>
  );
}
