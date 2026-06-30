"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { createClient } from "@/lib/supabase/client";

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

/**
 * 카카오 로그인 대기 중인 사용자를 기존 회원과 수동으로 연결하는 운영진 전용 화면.
 *
 * 데이터 흐름:
 *   GET /api/auth/pending-users → 대기 중 카카오 사용자 목록
 *   Supabase 직접 쿼리 → auth_user_id IS NULL인 미연결 회원 목록
 *   POST /api/auth/link-member → 연결 실행
 *
 * 권한: useIsAdmin()으로 운영진 여부 확인 — 비운영진은 접근 불가 안내만 표시.
 * 서버 API는 requireAdmin()으로 별도 검증하므로 클라이언트 체크는 UX용이다.
 */
export default function AuthLinkPage() {
  const isAdmin = useIsAdmin();
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
        // auth_user_id IS NULL인 활성 회원만 조회한다
        supabase
          .from("members")
          .select("id, nickname, name, auth_user_id")
          .eq("is_active", true)
          .is("auth_user_id", null)
          .order("nickname"),
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingUsers(data.pendingUsers ?? []);
      } else {
        toast.error("대기 중 사용자 목록을 불러오지 못했습니다.");
      }

      setUnlinkedMembers((membersData ?? []) as UnlinkedMember[]);
    } catch (err) {
      console.error("[auth-link] 데이터 로딩 실패:", err);
      toast.error("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const filteredMembers = memberQuery.trim()
    ? unlinkedMembers.filter(
        (m) =>
          m.nickname.toLowerCase().includes(memberQuery.toLowerCase()) ||
          m.name.toLowerCase().includes(memberQuery.toLowerCase())
      )
    : unlinkedMembers;

  async function handleLink(authUserId: string) {
    const memberId = selections[authUserId];
    if (!memberId) {
      toast.error("연결할 회원을 선택해주세요.");
      return;
    }

    setLinking(authUserId);
    try {
      const res = await fetch("/api/auth/link-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId, memberId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "연결에 실패했습니다.");
        return;
      }

      toast.success("회원 연결이 완료되었습니다.");
      // 낙관적 업데이트: 연결된 항목을 즉시 두 목록에서 제거
      setPendingUsers((prev) => prev.filter((u) => u.id !== authUserId));
      setUnlinkedMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSelections((prev) => {
        const next = { ...prev };
        delete next[authUserId];
        return next;
      });
    } catch {
      toast.error("연결 중 오류가 발생했습니다.");
    } finally {
      setLinking(null);
    }
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <Card className="w-full max-w-sm p-6 text-center">
          <p className="text-sm text-line-500">운영진만 접근할 수 있는 페이지입니다.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="px-4 pt-6 pb-10">
      <header className="mb-5">
        <p className="font-score text-xs font-semibold uppercase tracking-[0.2em] text-clay-400">Admin</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-line-900">
          카카오 회원 연결
        </h1>
        <p className="mt-1 text-sm text-line-500">
          카카오 로그인은 했지만 아직 회원 정보와 연결되지 않은 사용자를 기존 회원과 연결합니다.
        </p>
      </header>

      {/* 회원 검색 — 드롭다운 내 선택 편의를 위해 전체 공유 */}
      <div className="mb-4">
        <input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder="연결할 회원 검색 (이름, 닉네임)"
          className="box-border block h-10 w-full rounded-lg border border-line-200 bg-line-100 px-3 text-sm text-line-900 placeholder:text-line-400"
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-line-400">불러오는 중...</p>
      ) : pendingUsers.length === 0 ? (
        <Card className="p-6 text-center text-sm text-line-400">
          대기 중인 카카오 사용자가 없습니다.
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-line-900">
                  {user.nickname ?? "(닉네임 없음)"}
                </p>
                {user.email && (
                  <p className="text-xs text-line-500">{user.email}</p>
                )}
                <p className="mt-0.5 text-xs text-line-400">
                  가입일: {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={selections[user.id] ?? ""}
                  onChange={(e) =>
                    setSelections((prev) => ({ ...prev, [user.id]: e.target.value }))
                  }
                  className="h-10 flex-1 rounded-lg border border-line-200 bg-line-50 px-2 text-sm text-line-900"
                >
                  <option value="">회원 선택 ({filteredMembers.length}명)</option>
                  {filteredMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nickname} ({m.name})
                    </option>
                  ))}
                </select>
                <Button
                  size="md"
                  disabled={!selections[user.id] || linking === user.id}
                  onClick={() => handleLink(user.id)}
                >
                  {linking === user.id ? "연결 중..." : "연결"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={loadData}
          className="text-xs text-line-400 underline"
        >
          목록 새로고침
        </button>
      </div>
    </main>
  );
}
