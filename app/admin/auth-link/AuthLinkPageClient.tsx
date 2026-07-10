"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * /admin/auth-link — Owner/Master 전용 카카오 회원 연결 화면.
 *
 * 권한:
 *   - 서버: layout.tsx requireOwnerAccess() → cw_admin_session owner OR kakao master
 *   - API:  /api/auth/pending-users, /api/auth/link-member 모두 isOwner 기준
 *
 * 이 컴포넌트까지 도달하면 이미 owner/master 확인 완료.
 * 클라이언트 권한 차단 UI 불필요.
 */

interface PendingUser {
  id: string;
  email: string | null;
  nickname: string | null;
  kakaoId: string | null;
  createdAt: string;
}

interface UnlinkedMember {
  id: string;
  nickname: string;
  name: string;
}

export default function AuthLinkPageClient({ currentClubId }: { currentClubId: string }) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [unlinkedMembers, setUnlinkedMembers] = useState<UnlinkedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, { data: membersData }] = await Promise.all([
        fetch("/api/auth/pending-users"),
        supabase
          .from("members")
          .select("id, nickname, name")
          .is("auth_user_id", null)
          .eq("club_id", currentClubId)
          .order("nickname"),
      ]);

      if (!pendingRes.ok) {
        const body = await pendingRes.json().catch(() => null);
        toast.error(body?.error ?? "대기 사용자를 불러오지 못했습니다.");
        return;
      }

      const { pendingUsers: users } = await pendingRes.json();
      setPendingUsers(users ?? []);
      setUnlinkedMembers(membersData ?? []);
    } catch {
      toast.error("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase, currentClubId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleLink(authUserId: string) {
    const memberId = selections[authUserId];
    if (!memberId) { toast.error("연결할 회원을 선택해주세요."); return; }

    setLinking(authUserId);
    const res = await fetch("/api/auth/link-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authUserId, memberId }),
    });
    const body = await res.json().catch(() => null);
    setLinking(null);

    if (!res.ok) { toast.error(body?.error ?? "연결에 실패했습니다."); return; }
    toast.success("회원이 연결되었습니다.");
    loadData();
  }

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return unlinkedMembers;
    return unlinkedMembers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q)
    );
  }, [unlinkedMembers, memberQuery]);

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        title="카카오 회원 연결"
        description="카카오 로그인 후 회원 연결이 필요한 사용자를 연결합니다."
        backHref="/admin"
      />

      {/* ── 검색창 ───────────────────────────────────── */}
      <div className="mb-4">
        <input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder="회원 이름 검색"
          className="box-border block h-9 w-full rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 text-sm text-[color:var(--admin-text)] placeholder:[color:var(--admin-muted)]"
        />
      </div>

      {/* ── 본문 ─────────────────────────────────────── */}
      {loading ? (
        <div
          className="rounded-[var(--admin-card-radius,14px)] border p-8 text-center"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
        >
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            불러오는 중...
          </p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div
          className="rounded-[var(--admin-card-radius,14px)] border p-8 text-center"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
        >
          <p className="font-display text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--admin-muted)" }}>
            대기 없음
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>대기 중인 카카오 사용자가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="overflow-hidden rounded-[var(--admin-card-radius,14px)] border"
              style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
            >
              {/* 카카오 사용자 정보 */}
              <div
                className="border-b px-4 py-3 transition-colors hover:bg-[color:var(--admin-surface-raised,var(--admin-surface))]"
                style={{ borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-clay-400/40 bg-clay-400/10 px-2 py-0.5 text-[10px] font-bold text-clay-400">
                    KAKAO
                  </span>
                  <p className="name-kr-sm" style={{ color: "var(--admin-text)" }}>
                    {user.nickname ?? "이름 없음"}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--admin-muted)" }}>
                  {user.email ?? "이메일 없음"} · {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>

              {/* 연결할 회원 선택 */}
              <div className="flex items-center gap-2 px-4 py-3">
                <select
                  value={selections[user.id] ?? ""}
                  onChange={(e) =>
                    setSelections((prev) => ({ ...prev, [user.id]: e.target.value }))
                  }
                  className="h-9 flex-1 rounded-sm border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-raised,var(--admin-surface))] px-2 text-sm text-[color:var(--admin-text)]"
                >
                  <option value="">연결할 회원 선택</option>
                  {filteredMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.nickname})
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!selections[user.id] || linking === user.id}
                  onClick={() => handleLink(user.id)}
                >
                  {linking === user.id ? "연결 중..." : "연결"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
