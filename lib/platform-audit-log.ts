/**
 * lib/platform-audit-log.ts — CENTER COURT 플랫폼 감사 로그 helper.
 * 서버 전용 (service_role 필요).
 *
 * ⚠ 민감 필드(password/token/session/cookie/secret/authorization/key/hash)는
 *   metadata에 절대 포함되지 않도록 recordPlatformAuditLog() 내부에서 redaction.
 * ⚠ 기록 실패가 원 API 성공을 막지 않는다. 오류 시 console.error만 남긴다.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { PlatformAdminSession } from "@/lib/platform-admin-session";

/* ── action / target type constants ───────────────────── */
export type AuditAction =
  | "club.create"
  | "club.update"
  | "club.status_change"
  | "club.operator_role_change"
  | "platform_admin.create"
  | "platform_admin.update"
  | "platform_admin.password_reset"
  | "platform_admin.status_change";

export type AuditTargetType = "club" | "platform_admin" | "club_member";

export interface AuditLogEntry {
  action:       AuditAction;
  targetType:   AuditTargetType;
  targetId?:    string;
  targetLabel?: string;
  clubId?:      string;
  metadata?:    Record<string, unknown>;
}

/* ── sensitive key patterns to redact ──────────────────── */
const SENSITIVE_PATTERN = /password|token|session|cookie|authorization|secret|key_?hash|api_?key/i;

function redactMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SENSITIVE_PATTERN.test(k)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* ── main function ─────────────────────────────────────── */
export async function recordPlatformAuditLog(
  session: PlatformAdminSession,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const metadata = entry.metadata ? redactMetadata(entry.metadata) : {};

    const row = {
      platform_admin_id: session.adminId,
      admin_username:    session.username,
      admin_role:        session.role,
      action:            entry.action,
      target_type:       entry.targetType,
      target_id:         entry.targetId  ?? null,
      target_label:      entry.targetLabel ?? null,
      club_id:           entry.clubId ?? null,
      metadata,
    };

    console.info("[platform-audit-log] attempting insert", {
      action:      entry.action,
      targetType:  entry.targetType,
      targetId:    entry.targetId,
      clubId:      entry.clubId,
      adminId:     session.adminId     ?? null,
      adminExists: !!session.adminId,
      usernameExists: !!session.username,
    });

    const { error } = await supabase.from("platform_audit_logs").insert(row);

    if (error) {
      console.error("[platform-audit-log] insert failed", {
        action:       entry.action,
        targetType:   entry.targetType,
        targetId:     entry.targetId,
        clubId:       entry.clubId,
        adminId:      session.adminId,
        adminUsername: session.username,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint:    error.hint,
        errorCode:    error.code,
      });
    } else {
      console.info("[platform-audit-log] inserted", {
        action:   entry.action,
        targetId: entry.targetId,
        clubId:   entry.clubId,
      });
    }
  } catch (err) {
    console.error("[platform-audit-log] unexpected error", {
      action:    entry.action,
      targetId:  entry.targetId,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }
}
