/**
 * lib/platform-password.ts — CENTER COURT 비밀번호/세션 토큰 crypto helper.
 * 서버 전용. "use client" 파일에서 절대 import하지 말 것.
 */

import "server-only";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

/**
 * verifyPlatformPassword — scrypt 비밀번호 검증.
 *
 * storedHash 포맷: "<salt_hex>:<hash_hex>"
 * 검증 실패나 포맷 오류 모두 false 반환 (예외 throw 없음).
 */
export async function verifyPlatformPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const keyLen = expected.length; // 마이그레이션 노트 기준 64바이트
    const derived = (await scrypt(password, salt, keyLen)) as Buffer;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * createPlatformSessionToken — 256비트 CSPRNG 토큰 생성.
 * raw 토큰은 쿠키에만 저장한다 — DB에 저장하지 말 것.
 */
export function createPlatformSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * hashPlatformSessionToken — raw 토큰 → SHA-256 hex.
 * DB의 platform_admin_sessions.token_hash에 저장하는 값.
 */
export function hashPlatformSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
