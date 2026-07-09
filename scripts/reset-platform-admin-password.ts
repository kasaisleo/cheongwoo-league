/**
 * scripts/reset-platform-admin-password.ts
 *
 * kasaisleo 계정의 password_hash를 새 비밀번호로 업데이트한다.
 * role='owner', status='active' 도 보장한다.
 *
 * 실행 방법 (PowerShell):
 *   $env:PLATFORM_ADMIN_RESET_PASSWORD="새비밀번호"
 *   npx tsx scripts/reset-platform-admin-password.ts
 *
 * 환경변수:
 *   PLATFORM_ADMIN_RESET_PASSWORD  — 필수. 새 비밀번호 (평문).
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase 프로젝트 URL.
 *   SUPABASE_SERVICE_ROLE_KEY      — service_role key.
 *
 * .env.local 을 자동으로 읽는다 (dotenv 없이 직접 파싱).
 */

import crypto from "crypto";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ── .env.local 파싱 ────────────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

// ── crypto helper (server-only import 없이 인라인) ─────────────────────────
const scrypt = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;

async function createPasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scrypt(password, salt, expected.length)) as Buffer;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const newPassword = process.env.PLATFORM_ADMIN_RESET_PASSWORD;
  if (!newPassword) {
    console.error("❌ PLATFORM_ADMIN_RESET_PASSWORD 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const TARGET_USERNAME = "kasaisleo";

  // 1. 현재 계정 확인
  const { data: admin, error: selectError } = await supabase
    .from("platform_admins")
    .select("id, username, role, status")
    .eq("username", TARGET_USERNAME)
    .maybeSingle();

  if (selectError) {
    console.error("❌ DB 조회 오류:", selectError.message);
    process.exit(1);
  }
  if (!admin) {
    console.error(`❌ username='${TARGET_USERNAME}' 계정을 찾을 수 없습니다.`);
    process.exit(1);
  }

  console.log(`✅ 계정 확인: id=${admin.id}, role=${admin.role}, status=${admin.status}`);

  // 2. 새 비밀번호 해시 생성 및 자체 검증
  console.log("🔐 비밀번호 해시 생성 중…");
  const newHash = await createPasswordHash(newPassword);

  const verified = await verifyPasswordHash(newPassword, newHash);
  if (!verified) {
    console.error("❌ 해시 자체 검증 실패 — DB 업데이트 중단.");
    process.exit(1);
  }
  console.log("✅ 해시 자체 검증 통과.");

  // 3. DB 업데이트
  const { error: updateError } = await supabase
    .from("platform_admins")
    .update({
      password_hash: newHash,
      role: "owner",
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("username", TARGET_USERNAME);

  if (updateError) {
    console.error("❌ DB 업데이트 오류:", updateError.message);
    process.exit(1);
  }

  console.log(`✅ kasaisleo password_hash 업데이트 완료 (role=owner, status=active).`);
}

main().catch((err) => {
  console.error("❌ 예상치 못한 오류:", err);
  process.exit(1);
});
