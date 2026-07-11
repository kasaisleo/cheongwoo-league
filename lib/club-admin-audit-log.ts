/**
 * lib/club-admin-audit-log.ts — /admin(club master) 권한 변경 RPC 호출 + 에러 매핑.
 *
 * 실제 mutation + audit insert는 DB 함수(assign_member_permission_role,
 * unlink_member_kakao)가 단일 트랜잭션으로 처리한다 — 이 파일은 그 RPC를
 * 호출하고, RPC가 raise exception한 코드를 HTTP status/한국어 메시지로
 * 변환하는 역할만 한다. platform_audit_logs와는 완전히 분리된 테이블
 * (club_admin_audit_logs)을 사용하며, service_role로만 호출 가능하다.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { PermissionRole } from "@/lib/supabase/database.types";

export interface RpcErrorMapping {
  status: number;
  message: string;
}

/** RPC가 raise exception한 코드 → HTTP status/한국어 메시지 매핑 */
const ERROR_MAP: Record<string, RpcErrorMapping> = {
  member_not_found: { status: 404, message: "회원을 찾을 수 없습니다." },
  owner_required: { status: 403, message: "Owner 또는 master 권한이 필요합니다." },
  self_change_forbidden: { status: 403, message: "본인 권한은 변경할 수 없습니다." },
  master_locked: { status: 403, message: "master 권한은 변경할 수 없습니다." },
  member_withdrawn: { status: 409, message: "탈퇴 회원에게는 권한을 부여할 수 없습니다." },
  member_dormant: { status: 409, message: "휴면 회원에게는 권한을 부여할 수 없습니다." },
  member_excluded: { status: 409, message: "활동 제외 회원에게는 권한을 부여할 수 없습니다." },
  member_unlinked: { status: 409, message: "카카오 계정이 연결되지 않은 회원입니다." },
  role_unchanged: { status: 409, message: "이미 해당 역할입니다." },
  invalid_role: { status: 400, message: "허용되지 않는 역할입니다." },
  already_unlinked: { status: 400, message: "이미 카카오 연결이 해제된 회원입니다." },
};

const DEFAULT_ERROR: RpcErrorMapping = { status: 500, message: "요청 처리에 실패했습니다." };

/** Postgres 예외 메시지(raise exception 'code')에서 코드를 추출해 매핑한다. */
export function mapRpcError(rawMessage: string | undefined | null): RpcErrorMapping {
  if (!rawMessage) return DEFAULT_ERROR;
  // Postgres 에러 메시지는 "code" 그대로 오거나 "code\nCONTEXT: ..." 형태로 붙는 경우가 있어 첫 줄만 사용.
  const code = rawMessage.split("\n")[0].trim();
  return ERROR_MAP[code] ?? DEFAULT_ERROR;
}

export interface AssignRoleResult {
  name: string;
  old_role: PermissionRole;
  new_role: PermissionRole;
  action: "role_assign" | "role_change" | "role_revoke";
}

/**
 * assign_member_permission_role RPC 호출.
 * 성공: { ok: true, data }. 실패: { ok: false, error: RpcErrorMapping }.
 */
export async function assignMemberPermissionRole(params: {
  clubId: string;
  actorAuthUserId: string;
  targetMemberId: string;
  newRole: PermissionRole;
}): Promise<{ ok: true; data: AssignRoleResult } | { ok: false; error: RpcErrorMapping }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("assign_member_permission_role", {
    p_club_id: params.clubId,
    p_actor_auth_user_id: params.actorAuthUserId,
    p_target_member_id: params.targetMemberId,
    p_new_role: params.newRole,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }
  return { ok: true, data: data as AssignRoleResult };
}

export interface UnlinkKakaoResult {
  name: string;
}

/**
 * unlink_member_kakao RPC 호출.
 * 성공: { ok: true, data }. 실패: { ok: false, error: RpcErrorMapping }.
 */
export async function unlinkMemberKakao(params: {
  clubId: string;
  actorAuthUserId: string;
  targetMemberId: string;
}): Promise<{ ok: true; data: UnlinkKakaoResult } | { ok: false; error: RpcErrorMapping }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("unlink_member_kakao", {
    p_club_id: params.clubId,
    p_actor_auth_user_id: params.actorAuthUserId,
    p_target_member_id: params.targetMemberId,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }
  return { ok: true, data: data as UnlinkKakaoResult };
}
