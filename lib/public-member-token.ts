import "server-only";
import { createHash } from "node:crypto";

/**
 * Public 회원 필터 링크(/matches?member=...)용 비식별 토큰.
 * clubId를 해시에 포함시켜, 다른 클럽 회원의 토큰이 이 클럽 회원과
 * 우연히 일치하지 않도록 한다 — 인증/권한 검증 수단이 아니라 URL에서
 * raw member UUID를 감추기 위한 용도일 뿐이다.
 */
export function memberPublicToken(clubId: string, memberId: string): string {
  return createHash("sha256")
    .update(`member-filter:${clubId}:${memberId}`)
    .digest("hex")
    .slice(0, 24);
}

/** token → 이 클럽의 실제 회원을 역매핑. 불일치 시 null(빈 필터 취급, 무시하지 않음). */
export function resolveMemberByToken<T extends { id: string }>(
  clubId: string,
  token: string,
  members: T[]
): T | null {
  return members.find((m) => memberPublicToken(clubId, m.id) === token) ?? null;
}
