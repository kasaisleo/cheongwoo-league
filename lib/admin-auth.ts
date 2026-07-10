import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * 회원 전체 로그인은 없음. 운영진만 비밀번호로 입력/관리 화면에 접근한다.
 *
 * 2단계 권한(Step 8-3): ADMIN_PASSWORD = owner, MANAGER_PASSWORD = manager.
 * 로그인 시 입력한 비밀번호가 둘 중 무엇과 일치하는지에 따라 세션에 role을
 * 함께 서명해 담는다. owner는 모든 기능, manager는 회원 삭제/직책 변경/
 * 일괄 임포트를 제외한 운영 기능에 접근할 수 있다.
 */

const COOKIE_NAME = "cw_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

export type AdminRole = "owner" | "manager";

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

/**
 * payload 형식: "admin:{role}:{expiresAt}"
 * "admin"은 과거(role 없던 시절)부터 있던 고정 prefix로, 검증에는 쓰이지
 * 않지만 토큰 형식을 한눈에 알아볼 수 있게 그대로 둔다.
 */
function buildToken(role: AdminRole): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `admin:${role}:${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

interface TokenVerification {
  valid: boolean;
  role: AdminRole | null;
}

/**
 * 서명/만료를 검증하고 role을 함께 돌려준다.
 *
 * 하위 호환: Step 8-3 이전에 발급된 토큰은 payload가 "admin:{expiresAt}"
 * (2-필드)였다. 그 토큰은 role 자리에 숫자(만료 시각)가 와서 "owner"/
 * "manager"로 인식되지 않으므로, 이 경우 owner로 폴백한다 — 그 시절 로그인
 *할 수 있었던 사람은 전부 지금 정책상 owner였던 사람들이라 사실과 일치하고,
 * 배포 직후 기존 운영진이 갑자기 권한을 잃거나 재로그인을 강제당하지 않는다.
 * 이 폴백은 기존 토큰이 만료되는 최대 7일 후 자연 소멸한다.
 */
function verifyToken(token: string): TokenVerification {
  const invalid: TokenVerification = { valid: false, role: null };

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return invalid;

  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length) return invalid;

  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!signaturesMatch) return invalid;

  const parts = payload.split(":");
  // parts: ["admin", role, expiresAt] (신규) 또는 ["admin", expiresAt] (구버전 — role 없음)
  const expiresAtStr = parts.length >= 3 ? parts[2] : parts[1];
  const roleCandidate = parts.length >= 3 ? parts[1] : null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return invalid;

  const role: AdminRole = roleCandidate === "owner" || roleCandidate === "manager" ? roleCandidate : "owner";
  return { valid: true, role };
}

/**
 * 입력된 비밀번호가 owner(ADMIN_PASSWORD) 또는 manager(MANAGER_PASSWORD) 중
 * 어느 쪽과 일치하는지 확인한다. owner를 먼저 검사한다 — 두 비밀번호를 실수로
 * 같은 값으로 설정하면 owner로 판정되니, 운영자는 반드시 서로 다른 값으로
 * 설정해야 한다.
 */
export function verifyAdminPassword(password: string): AdminRole | null {
  const ownerPassword = process.env.ADMIN_PASSWORD;
  if (ownerPassword && password.length === ownerPassword.length) {
    if (crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ownerPassword))) {
      return "owner";
    }
  }

  const managerPassword = process.env.MANAGER_PASSWORD;
  if (managerPassword && password.length === managerPassword.length) {
    if (crypto.timingSafeEqual(Buffer.from(password), Buffer.from(managerPassword))) {
      return "manager";
    }
  }

  return null;
}

/** 로그인 성공 시 발급할 세션 쿠키 정보 */
export function createAdminSession(role: AdminRole): { name: string; value: string; maxAge: number } {
  return {
    name: COOKIE_NAME,
    value: buildToken(role),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

/** admin context 쿠키 — /api/admin/enter 에서 설정, getAdminAccessServer()가 읽음.
 *  cw_admin_session과 달리 서명 없이 slug 문자열만 담는다.
 *  admin context 전용이므로 공개 페이지 데이터 기준으로 쓰면 안 된다. */
export const ADMIN_CLUB_SLUG_COOKIE = "admin_club_slug";

/**
 * Manager 비밀번호 로그인 시 접근 가능한 클럽 slug 목록을 반환한다. Fail-closed.
 *
 * - MANAGER_CLUB_SLUGS 미설정 또는 빈 문자열 → [] (어느 클럽도 접근 불가)
 * - 값 파싱: comma split → trim → lowercase → 빈 값 제거 → 중복 제거
 * - 비교 시 substring 매칭 금지, slug 정확 일치만 허용
 *
 * 예: MANAGER_CLUB_SLUGS=cheongwoo 또는 MANAGER_CLUB_SLUGS=cheongwoo,namaste
 */
export function getManagerAllowedSlugs(): string[] {
  const env = process.env.MANAGER_CLUB_SLUGS;
  if (!env || env.trim() === "") return [];
  return [...new Set(
    env.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )];
}

/** 현재 요청의 운영진 역할을 반환한다. 세션이 없거나 무효하면 null. */
export function getAdminRole(): AdminRole | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const { valid, role } = verifyToken(token);
  return valid ? role : null;
}

/** 서버 컴포넌트/라우트 핸들러에서 현재 요청이 운영진(owner 또는 manager) 세션인지 확인 */
export function isAdminSession(): boolean {
  return getAdminRole() !== null;
}

/**
 * API route 인증 가드. minRole에 필요한 역할 이상이 아니면 적절한
 * NextResponse를 반환하고, 통과하면 null을 반환한다.
 *
 *   - 세션이 없으면: 401 { error: "운영진 인증이 필요합니다." }
 *   - 세션은 있지만 minRole="owner"인데 manager인 경우: 403
 *     { error: "이 작업은 owner만 가능합니다." }
 *
 * 사용:
 *   const authError = requireRole("owner");
 *   if (authError) return authError;
 */
export function requireRole(minRole: AdminRole): NextResponse | null {
  const role = getAdminRole();

  if (!role) {
    return NextResponse.json(
      { error: "운영진 인증이 필요합니다." },
      { status: 401 }
    );
  }

  if (minRole === "owner" && role !== "owner") {
    return NextResponse.json(
      { error: "이 작업은 owner만 가능합니다." },
      { status: 403 }
    );
  }

  return null;
}

/**
 * API route 인증 가드. 운영진(owner 또는 manager)이 아니면 401
 * NextResponse를 반환하고, 운영진이면 null을 반환한다.
 *
 * requireRole("manager")의 별칭이다 — "manager 이상"이 owner도 포함하므로
 * 기존에 이 함수를 쓰던 14개 route는 전혀 수정할 필요 없이 그대로 동작한다
 * (응답 형식/상태 코드/에러 메시지도 기존과 완전히 동일).
 *
 * 사용:
 *   const authError = requireAdmin();
 *   if (authError) return authError;
 */
export function requireAdmin(): NextResponse | null {
  return requireRole("manager");
}
