"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { toast } from "@/components/ui/Toast";
import {
  MemberForm,
  getDefaultFormValues,
  NO_ROLE,
  type MemberFormValues,
} from "@/components/member/MemberForm";
import { deriveMemberStatus } from "@/lib/admin-member-status";
import type { AdminMemberDetail } from "./page";

const ROLE_LABEL: Record<string, string> = {
  master: "Master", admin: "Admin", manager: "Manager", member: "Member", scorer: "Scorer",
};

const ASSIGNABLE_ROLES = ["member", "manager", "admin"] as const;

interface Props {
  member: AdminMemberDetail;
  isOwner: boolean;
  isSelf: boolean;
}

export function AdminMemberDetailClient({ member, isOwner, isSelf }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<MemberFormValues>(
    getDefaultFormValues({
      name: member.name,
      nickname: member.nickname,
      phoneDigits: member.phone ?? "",
      age: member.age?.toString() ?? "",
      district: member.district ?? "",
      addressFull: member.address_full ?? "",
      mapoScore: member.mapo_score,
      role: member.role ?? NO_ROLE,
      isDormant: member.is_dormant,
      isPlayerOrigin: member.player_background !== "none",
      playerBackgroundDetail:
        member.player_background !== "none" ? (member.player_background as MemberFormValues["playerBackgroundDetail"]) : "elementary",
      memo: member.memo ?? "",
    })
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateConfirming, setReactivateConfirming] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkConfirming, setUnlinkConfirming] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateConfirming, setDeactivateConfirming] = useState(false);
  const [roleEditing, setRoleEditing] = useState(false);
  const [pendingRole, setPendingRole] = useState<string>(member.permission_role);
  const [roleConfirming, setRoleConfirming] = useState(false);
  const [roleActing, setRoleActing] = useState(false);

  const status = deriveMemberStatus(member.is_active, member.deleted_at);
  const isLinked = !!member.auth_user_id;
  const isMaster = member.permission_role === "master";

  // 권한 변경 가능 조건 — 서버(RPC)가 최종 source of truth이며, 여기 계산은
  // 사유 안내/UI 노출용 보조 판정일 뿐이다.
  const roleBlockReason: string | null = isSelf
    ? "자기 자신의 권한은 변경할 수 없습니다."
    : isMaster
      ? "Master 권한은 CENTER COURT에서만 변경 가능합니다."
      : status === "withdrawn"
        ? "탈퇴 회원입니다."
        : status === "dormant"
          ? "휴면 회원입니다."
          : member.is_dormant
            ? "활동 제외 회원입니다."
            : !isLinked
              ? "카카오 연결이 필요합니다."
              : null;
  const canChangeRole = isOwner && roleBlockReason === null;

  const surfaceStyle: React.CSSProperties = { background: "var(--admin-surface)", border: "1px solid var(--admin-border)" };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "이름을 입력해주세요.";
    if (!/^010\d{8}$/.test(values.phoneDigits)) e.phoneDigits = "010으로 시작하는 11자리를 입력해주세요.";
    if (values.age.trim()) {
      const n = Number(values.age);
      if (isNaN(n) || n < 0 || n > 120) e.age = "올바른 나이를 입력해주세요.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const res = await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        nickname: values.nickname.trim() || null,
        phone: values.phoneDigits,
        age: values.age.trim() ? Number(values.age) : null,
        addressFull: values.addressFull.trim() || null,
        district: values.district.trim() || null,
        mapoScore: values.mapoScore,
        memo: values.memo.trim() || null,
        playerBackground: values.isPlayerOrigin ? values.playerBackgroundDetail : "none",
        isDormant: values.isDormant,
        ...(isOwner ? { role: values.role === NO_ROLE ? null : values.role } : {}),
      }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      toast.error(body?.error ?? "회원 정보 수정에 실패했습니다.");
      return;
    }
    toast.success("회원 정보가 수정되었습니다.");
    setEditing(false);
    router.refresh();
  }

  async function handleReactivate() {
    setReactivating(true);
    setReactivateConfirming(false);
    const res = await fetch("/api/admin/reactivate-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    const body = await res.json().catch(() => null);
    setReactivating(false);
    if (!res.ok) { toast.error(body?.error ?? "복구에 실패했습니다."); return; }
    toast.success(body?.message ?? "복구했습니다.");
    router.refresh();
  }

  async function handleChangeRole() {
    setRoleActing(true);
    setRoleConfirming(false);
    const res = await fetch("/api/admin/update-member-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, newRole: pendingRole }),
    });
    const body = await res.json().catch(() => null);
    setRoleActing(false);
    if (!res.ok) { toast.error(body?.error ?? "권한 변경에 실패했습니다."); return; }
    toast.success(body?.message ?? "권한이 변경되었습니다.");
    setRoleEditing(false);
    router.refresh();
  }

  async function handleUnlink() {
    setUnlinking(true);
    setUnlinkConfirming(false);
    const res = await fetch("/api/admin/unlink-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    const body = await res.json().catch(() => null);
    setUnlinking(false);
    if (!res.ok) { toast.error(body?.error ?? "연결 해제에 실패했습니다."); return; }
    toast.success(body?.message ?? "카카오 연결이 해제되었습니다.");
    router.refresh();
  }

  async function handleDeactivate() {
    setDeactivating(true);
    setDeactivateConfirming(false);
    const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setDeactivating(false);
    if (!res.ok) { toast.error(body?.error ?? "탈퇴 처리에 실패했습니다."); return; }
    toast.success("회원을 탈퇴 처리했습니다.");
    router.refresh();
  }

  return (
    <main className="px-4 pt-6 pb-28">
      <AdminPageHeader
        eyebrow="MEMBER"
        title={member.name}
        description={member.nickname !== member.name ? member.nickname : undefined}
        backHref="/admin/members"
      />

      {/* ── 기본정보 ─────────────────────────────────────── */}
      <section className="mb-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>기본정보</p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)]" style={surfaceStyle}>
          {[
            { label: "회원구분", value: member.member_type },
            { label: "전화번호", value: member.phone ? `${member.phone.slice(0, 3)}-****-${member.phone.slice(-4)}` : "—" },
            { label: "나이", value: member.age?.toString() ?? "—" },
            { label: "동네", value: member.district ?? "—" },
            { label: "직책", value: member.role ?? "—" },
            { label: "메모", value: member.memo ?? "—" },
            { label: "등록일", value: member.created_at.slice(0, 10) },
            // is_dormant — 회원 상태(활동/휴면/탈퇴)와는 다른 축이라 "휴면"이라는 말을
            // 쓰지 않는다("Admin Members 활동 제외 라벨 정리" 정책). 기본정보에 두어
            // 상태 섹션의 활동/휴면/탈퇴와 시각적으로 분리한다.
            { label: "활동 제외", value: member.is_dormant ? "예" : "아니오" },
          ].map((row, idx, arr) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5"
              style={idx < arr.length - 1 ? { borderBottom: "1px solid var(--admin-border)" } : undefined}>
              <span className="text-xs font-semibold" style={{ color: "var(--admin-muted)" }}>{row.label}</span>
              <span className="text-sm" style={{ color: "var(--admin-text)" }}>{row.value}</span>
            </div>
          ))}
          {member.is_dormant && (
            <p className="px-4 pb-3 text-[11px]" style={{ color: "var(--admin-muted)" }}>
              회원 자격과 기록은 유지하되 신규 활동 대상에서 제외됩니다.
            </p>
          )}
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--admin-border)" }}>
            <button type="button" onClick={() => setEditing(true)}
              className="h-9 w-full rounded-[var(--admin-button-radius,6px)] text-xs font-semibold transition-colors"
              style={{ background: "var(--admin-accent-soft)", border: "1px solid var(--admin-accent)", color: "var(--admin-accent)" }}>
              회원 정보 수정
            </button>
          </div>
        </div>
      </section>

      {/* ── 상태 ─────────────────────────────────────────── */}
      <section className="mb-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-muted)" }}>상태</p>
        <div className="overflow-hidden rounded-[var(--admin-card-radius,14px)]" style={surfaceStyle}>
          {/* 활동 상태: 활동 / 휴면(is_active=false, deleted_at=null) / 탈퇴(deleted_at 있음) */}
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--admin-border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>활동 상태</span>
            {status === "active" && (
              <span className="rounded-sm px-2 py-0.5 text-[10px] font-semibold" style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                활동중
              </span>
            )}
            {status === "dormant" && (
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-sm px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--admin-alert-soft)", border: "1px solid var(--admin-alert)", color: "var(--admin-alert)" }}>
                  휴면
                </span>
                {reactivateConfirming ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>복구할까요?</span>
                    <button type="button" disabled={reactivating} onClick={handleReactivate}
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold disabled:opacity-40"
                      style={{ background: "var(--admin-accent-soft)", border: "1px solid var(--admin-accent)", color: "var(--admin-accent)" }}>
                      {reactivating ? "..." : "확인"}
                    </button>
                    <button type="button" onClick={() => setReactivateConfirming(false)}
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                      취소
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setReactivateConfirming(true)}
                    className="rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                    활동 상태로 복구
                  </button>
                )}
              </div>
            )}
            {status === "withdrawn" && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="rounded-sm px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--admin-alert-soft)", border: "1px solid var(--admin-alert)", color: "var(--admin-alert)" }}>
                  탈퇴
                </span>
                {member.deleted_at && (
                  <p className="text-[9px]" style={{ color: "var(--admin-muted)" }}>{member.deleted_at.slice(0, 10)}</p>
                )}
              </div>
            )}
          </div>

          {/* 권한 — master만 변경 가능. 실제 변경은 이 페이지에서만 수행한다(/admin/settings는 조회 전용). */}
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--admin-border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>권한</span>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-sm px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--admin-surface-raised, var(--admin-surface))", border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                {ROLE_LABEL[member.permission_role] ?? member.permission_role}
              </span>

              {isOwner && roleBlockReason && (
                <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>{roleBlockReason}</span>
              )}

              {canChangeRole && (
                roleEditing ? (
                  roleConfirming ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]" style={{ color: "var(--admin-text)" }}>
                        {ROLE_LABEL[pendingRole] ?? pendingRole}(으)로 변경할까요?
                      </span>
                      <button type="button" disabled={roleActing} onClick={handleChangeRole}
                        className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold disabled:opacity-40"
                        style={{ background: "var(--admin-accent-soft)", border: "1px solid var(--admin-accent)", color: "var(--admin-accent)" }}>
                        {roleActing ? "..." : "확인"}
                      </button>
                      <button type="button" onClick={() => setRoleConfirming(false)}
                        className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <select
                        value={pendingRole}
                        onChange={(e) => setPendingRole(e.target.value)}
                        className="h-6 rounded-sm border px-1.5 text-[10px]"
                        style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-raised, var(--admin-surface))", color: "var(--admin-text)" }}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={pendingRole === member.permission_role}
                        onClick={() => setRoleConfirming(true)}
                        className="rounded-sm px-2 py-0.5 text-[9px] font-semibold disabled:opacity-40"
                        style={{ border: "1px solid var(--admin-accent)", background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
                      >
                        적용
                      </button>
                      <button type="button" onClick={() => { setRoleEditing(false); setPendingRole(member.permission_role); }}
                        className="rounded-sm px-2 py-0.5 text-[9px] font-semibold"
                        style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                        취소
                      </button>
                    </div>
                  )
                ) : (
                  <button type="button" onClick={() => { setRoleEditing(true); setPendingRole(member.permission_role); }}
                    className="rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                    권한 변경
                  </button>
                )
              )}
            </div>
          </div>

          {/* 카카오 연결 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>카카오 연결</span>
            <div className="flex items-center gap-2">
              <span className="rounded-sm px-2 py-0.5 text-[10px] font-semibold" style={
                isLinked
                  ? { border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }
                  : { background: "var(--admin-alert-soft)", border: "1px solid var(--admin-alert)", color: "var(--admin-alert)" }
              }>
                {isLinked ? "연결됨" : "미연결"}
              </span>
              {isOwner && isLinked && !isMaster && (
                unlinkConfirming ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: "var(--admin-muted)" }}>해제할까요?</span>
                    <button type="button" disabled={unlinking} onClick={handleUnlink}
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold disabled:opacity-40"
                      style={{ background: "var(--admin-alert-soft)", border: "1px solid var(--admin-alert)", color: "var(--admin-alert)" }}>
                      {unlinking ? "..." : "확인"}
                    </button>
                    <button type="button" onClick={() => setUnlinkConfirming(false)}
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                      취소
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setUnlinkConfirming(true)}
                    className="rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                    연결 해제
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 기록 링크 ────────────────────────────────────── */}
      <section className="mb-4">
        <Link href={`/admin/records/players/member/${member.id}`}
          className="flex items-center justify-between rounded-[var(--admin-card-radius,14px)] px-4 py-3 transition-colors"
          style={surfaceStyle}>
          <span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>경기 · 출석 · 포인트 기록 보기</span>
          <span className="text-xs" style={{ color: "var(--admin-muted)" }}>→</span>
        </Link>
      </section>

      {/* ── 위험 구역 ────────────────────────────────────── */}
      {isOwner && status === "active" && (
        <section className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--admin-alert)" }}>위험 구역</p>
          <div className="rounded-[var(--admin-card-radius,14px)] p-4" style={{ background: "var(--admin-alert-soft)", border: "1px solid var(--admin-alert)" }}>
            {deactivateConfirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--admin-text)" }}>탈퇴 처리할까요? 기록은 유지됩니다.</span>
                <button type="button" disabled={deactivating} onClick={handleDeactivate}
                  className="ml-auto rounded-sm px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                  style={{ background: "var(--admin-alert)", color: "var(--admin-bg)" }}>
                  {deactivating ? "..." : "확인"}
                </button>
                <button type="button" onClick={() => setDeactivateConfirming(false)}
                  className="rounded-sm px-2.5 py-1 text-[11px] font-semibold"
                  style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>
                  취소
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setDeactivateConfirming(true)}
                className="h-10 w-full rounded-[var(--admin-button-radius,6px)] text-xs font-semibold"
                style={{ border: "1px solid var(--admin-alert)", color: "var(--admin-alert)" }}>
                탈퇴 처리
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── 수정 모달 ────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[var(--admin-card-radius,14px)] p-4" style={surfaceStyle}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: "var(--admin-accent)" }}>회원 정보 수정</p>
              <button type="button" onClick={() => setEditing(false)}
                className="text-xs font-semibold" style={{ color: "var(--admin-muted)" }}>
                닫기
              </button>
            </div>
            <MemberForm
              mode="edit"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              isOwner={isOwner}
              showStatus={true}
              errors={errors}
            />
            <button type="button" disabled={saving} onClick={handleSave}
              className="mt-4 h-12 w-full rounded-[var(--admin-button-radius,6px)] text-sm font-bold disabled:opacity-40"
              style={{ background: "var(--admin-action-bg)", color: "var(--admin-action-text)" }}>
              {saving ? "저장 중..." : "수정 내용 저장"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
