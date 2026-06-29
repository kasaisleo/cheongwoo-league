import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * 회원 전체 로그인은 없음. 운영진만 단일 비밀번호로 입력/관리 화면에 접근한다.
 * 비밀번호는 환경변수 ADMIN_PASSWORD에 저장하고, 인증 성공 시 서명된 세션 쿠키를 발급한다.
 */

const COOKIE_NAME = "cw_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function buildToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `admin:${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyToken(token: string): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length) return false;

  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!signaturesMatch) return false;

  const [, expiresAtStr] = payload.split(":");
  const expiresAt = Number(expiresAtStr);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

/** 입력된 비밀번호가 운영진 비밀번호와 일치하는지 확인 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  if (password.length !== adminPassword.length) return false;
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));
}

/** 로그인 성공 시 발급할 세션 쿠키 정보 */
export function createAdminSession(): { name: string; value: string; maxAge: number } {
  return {
    name: COOKIE_NAME,
    value: buildToken(),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

/** 서버 컴포넌트/라우트 핸들러에서 현재 요청이 운영진 세션인지 확인 */
export function isAdminSession(): boolean {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

/**
 * API route 인증 가드. 운영진이 아니면 401 NextResponse를 반환하고,
 * 운영진이면 null을 반환한다. 14개 route에 반복되던
 * `if (!isAdminSession()) return NextResponse.json(...)` 패턴을 한 곳으로
 * 모은 것일 뿐, 응답 형식/상태 코드/에러 메시지는 기존과 완전히 동일하다.
 *
 * 사용:
 *   const authError = requireAdmin();
 *   if (authError) return authError;
 */
export function requireAdmin(): NextResponse | null {
  if (!isAdminSession()) {
    return NextResponse.json(
      { error: "운영진 인증이 필요합니다." },
      { status: 401 }
    );
  }

  return null;
}
