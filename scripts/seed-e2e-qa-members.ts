/**
 * scripts/seed-e2e-qa-members.ts
 *
 * E2E QA 클럽(slug=e2e_qa)에 QA용 가상 회원 40명을 seed한다.
 * 현역 ATP 19명 + 현역 WTA 19명 + 레전드 2명(Federer, Nadal).
 *
 * 실행 방법 (PowerShell):
 *   npx tsx scripts/seed-e2e-qa-members.ts             # dry-run (기본, 아무것도 쓰지 않음)
 *   npx tsx scripts/seed-e2e-qa-members.ts --apply     # 실제 반영(멱등)
 *   npx tsx scripts/seed-e2e-qa-members.ts --cleanup   # seed한 40행만 삭제
 *
 * 환경변수(.env.local 자동 파싱 — 키를 코드에 저장하지 않는다):
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service_role key
 *
 * 안전 설계:
 *   - 대상 클럽은 club_id와 slug가 "둘 다" 일치할 때만 진행한다(양방향 확인).
 *   - 각 행의 id는 고정 namespace + 플레이어 키로 만든 결정적 UUIDv5다.
 *     따라서 재실행해도 같은 id가 나오고, upsert(ignoreDuplicates)로 멱등하다.
 *   - cleanup은 "결정적 UUID 40개" AND "E2E QA club_id"가 모두 일치하는 행만
 *     지운다 — 레오 master 행, 기존 회원, 다른 클럽 데이터는 대상이 될 수 없다.
 *   - permission_role='member', auth_user_id=null, is_kakao_linked=false 고정.
 *   - 전화번호/주소/나이 등 개인정보 컬럼은 전부 null(가짜 개인정보 생성 금지).
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ── .env.local 파싱 (reset-platform-admin-password.ts와 동일 관례) ─────────
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

// ── 대상 클럽 (양쪽 다 일치해야만 실행) ───────────────────────────────────
const E2E_CLUB_ID = "0c06c60d-4a37-433a-bbfe-e3f14831b34a";
const E2E_CLUB_SLUG = "e2e_qa";

/**
 * seed 행 id 생성을 위한 고정 namespace UUID. 비밀값이 아니며, 바뀌면 기존
 * seed 행과 다른 id가 생성되므로 절대 변경하지 않는다(변경 시 cleanup이
 * 과거 행을 찾지 못한다).
 */
const SEED_NAMESPACE = "f1a7c3d2-5b64-4e88-9a10-3c7d5e2b8f44";

// ── UUIDv5 (RFC 4122, SHA-1 기반) ─────────────────────────────────────────
function uuidv5(name: string, namespace: string): string {
  const nsHex = namespace.replace(/-/g, "");
  const nsBytes = Buffer.from(nsHex, "hex");
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([nsBytes, Buffer.from(name, "utf8")]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** 플레이어 이름 → 안정적인 seed 키(공백/특수문자 정규화). */
function seedKey(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // 발음기호 제거 (Jiri Lehecka 등)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${E2E_CLUB_SLUG}:member:${slug}`;
}

// ── 선수 명단 ──────────────────────────────────────────────────────────────
type Tour = "ATP" | "WTA" | "LEGEND";
type Grade = "A" | "B" | "C" | "D";
type MemberType = "정회원" | "준회원" | "게스트";

interface SeedPlayer {
  name: string;
  nickname: string;
  tour: Tour;
  rank: number;
}

const ATP: Array<[string, string]> = [
  ["Jannik Sinner", "시너"],
  ["Carlos Alcaraz", "알카라스"],
  ["Alexander Zverev", "즈베레프"],
  ["Felix Auger-Aliassime", "오제알리아심"],
  ["Novak Djokovic", "조코비치"],
  ["Daniil Medvedev", "메드베데프"],
  ["Alex de Minaur", "디미노어"],
  ["Taylor Fritz", "프리츠"],
  ["Flavio Cobolli", "코볼리"],
  ["Ben Shelton", "셸턴"],
  ["Alexander Bublik", "부블릭"],
  ["Jiri Lehecka", "레헤츠카"],
  ["Lorenzo Musetti", "무세티"],
  ["Casper Ruud", "루드"],
  ["Rafael Jodar", "호다르"],
  ["Andrey Rublev", "루블레프"],
  ["Jakub Mensik", "멘시크"],
  ["Valentin Vacherot", "바쉐로"],
  ["Learner Tien", "티엔"],
];

const WTA: Array<[string, string]> = [
  ["Aryna Sabalenka", "사발렌카"],
  ["Elena Rybakina", "리바키나"],
  ["Jessica Pegula", "페굴라"],
  ["Coco Gauff", "고프"],
  ["Mirra Andreeva", "안드레예바"],
  ["Karolina Muchova", "무호바"],
  ["Linda Noskova", "노스코바"],
  ["Iga Swiatek", "시비옹테크"],
  ["Elina Svitolina", "스비톨리나"],
  ["Amanda Anisimova", "아니시모바"],
  ["Marta Kostyuk", "코스튜크"],
  ["Victoria Mboko", "음보코"],
  ["Naomi Osaka", "오사카"],
  ["Belinda Bencic", "벤치치"],
  ["Jasmine Paolini", "파올리니"],
  ["Iva Jovic", "요비치"],
  ["Diana Shnaider", "슈나이더"],
  ["Sorana Cirstea", "크르스테아"],
  ["Ekaterina Alexandrova", "알렉산드로바"],
];

const LEGENDS: Array<[string, string]> = [
  ["Roger Federer", "페더러"],
  ["Rafael Nadal", "나달"],
];

const PLAYERS: SeedPlayer[] = [
  ...ATP.map(([name, nickname], i): SeedPlayer => ({ name, nickname, tour: "ATP", rank: i + 1 })),
  ...WTA.map(([name, nickname], i): SeedPlayer => ({ name, nickname, tour: "WTA", rank: i + 1 })),
  ...LEGENDS.map(([name, nickname], i): SeedPlayer => ({ name, nickname, tour: "LEGEND", rank: i + 1 })),
];

// ── QA 시나리오용 속성 분산 (전부 임의값 — 실제 선수 정보와 무관) ─────────
/** 대진/조편성 테스트가 4개 등급을 모두 밟도록 A~D로 고르게 분산. */
function gradeFor(p: SeedPlayer): Grade {
  if (p.tour === "LEGEND") return "A";
  if (p.rank <= 5) return "A";
  if (p.rank <= 10) return "B";
  if (p.rank <= 15) return "C";
  return "D";
}

/** 정회원/준회원 혼합 — 회원구분별 필터/집계 테스트용. */
function memberTypeFor(p: SeedPlayer): MemberType {
  if (p.tour === "LEGEND") return "정회원";
  return p.rank % 4 === 0 ? "준회원" : "정회원";
}

/** mapo_score CHECK(1~10) 범위 안에서 상위권일수록 높게 분산. */
function mapoScoreFor(p: SeedPlayer): number {
  if (p.tour === "LEGEND") return 10;
  const score = 10 - Math.floor((p.rank - 1) / 2);
  return Math.min(10, Math.max(1, score));
}

interface SeedRow {
  id: string;
  club_id: string;
  name: string;
  nickname: string;
  grade: Grade;
  member_type: MemberType;
  mapo_score: number;
  permission_role: "member";
  is_active: true;
  is_dormant: false;
  is_kakao_linked: false;
  auth_user_id: null;
  phone: null;
  address_full: null;
  district: null;
  age: null;
  role: null;
}

function buildRows(): SeedRow[] {
  return PLAYERS.map((p) => ({
    id: uuidv5(seedKey(p.name), SEED_NAMESPACE),
    club_id: E2E_CLUB_ID,
    name: p.name,
    nickname: p.nickname,
    grade: gradeFor(p),
    member_type: memberTypeFor(p),
    mapo_score: mapoScoreFor(p),
    // 보안/정책 고정값
    permission_role: "member" as const,
    is_active: true as const,
    is_dormant: false as const,
    is_kakao_linked: false as const,
    auth_user_id: null,
    // 개인정보 컬럼은 전부 null
    phone: null,
    address_full: null,
    district: null,
    age: null,
    role: null,
  }));
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const cleanup = args.includes("--cleanup");

  if (apply && cleanup) {
    console.error("ERROR: --apply와 --cleanup은 동시에 쓸 수 없습니다.");
    process.exit(1);
  }
  const mode = cleanup ? "CLEANUP" : apply ? "APPLY" : "DRY-RUN";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  console.log(`\n=== E2E QA 회원 seed — mode: ${mode} ===\n`);

  // ── 가드: club_id와 slug가 양방향으로 일치해야만 진행 ───────────────────
  const { data: byId, error: byIdErr } = await supabase
    .from("clubs").select("id, slug, name").eq("id", E2E_CLUB_ID).maybeSingle();
  const { data: bySlug, error: bySlugErr } = await supabase
    .from("clubs").select("id, slug, name").eq("slug", E2E_CLUB_SLUG).maybeSingle();

  if (byIdErr || bySlugErr) {
    console.error("ERROR: 클럽 조회 실패:", byIdErr?.message ?? bySlugErr?.message);
    process.exit(1);
  }
  if (!byId || !bySlug || byId.slug !== E2E_CLUB_SLUG || bySlug.id !== E2E_CLUB_ID) {
    console.error("ERROR: 대상 클럽 가드 실패 — club_id와 slug가 일치하지 않습니다.");
    console.error(`  by id  : ${JSON.stringify(byId)}`);
    console.error(`  by slug: ${JSON.stringify(bySlug)}`);
    process.exit(1);
  }
  console.log(`대상 클럽 확인: ${byId.name} (id=${byId.id}, slug=${byId.slug})\n`);

  const rows = buildRows();
  const ids = rows.map((r) => r.id);

  // ── UUID 자체 중복 검사 ────────────────────────────────────────────────
  const uniqueIds = new Set(ids);
  const uniqueNames = new Set(rows.map((r) => r.name));
  console.log(`생성 대상: ${rows.length}명 / 고유 UUID ${uniqueIds.size}개 / 고유 이름 ${uniqueNames.size}개`);
  if (uniqueIds.size !== rows.length) {
    console.error("ERROR: 결정적 UUID 충돌이 발생했습니다. 중단합니다.");
    process.exit(1);
  }
  if (uniqueNames.size !== rows.length) {
    console.error("ERROR: 이름 중복이 있습니다. 명단을 확인하세요.");
    process.exit(1);
  }

  // ── 현재 클럽 상태 및 충돌 조사 ────────────────────────────────────────
  const { data: existingMembers, error: exErr } = await supabase
    .from("members")
    .select("id, name, nickname, permission_role, auth_user_id, is_active")
    .eq("club_id", E2E_CLUB_ID);
  if (exErr) {
    console.error("ERROR: 기존 회원 조회 실패:", exErr.message);
    process.exit(1);
  }
  const existing = existingMembers ?? [];
  const existingIds = new Set(existing.map((m) => m.id));
  const seedIdsAlreadyPresent = ids.filter((id) => existingIds.has(id));
  const nonSeedMembers = existing.filter((m) => !uniqueIds.has(m.id));

  console.log(`현재 클럽 회원: ${existing.length}명`);
  console.log(`  - seed 대상 UUID와 이미 일치하는 행: ${seedIdsAlreadyPresent.length}개`);
  console.log(`  - seed와 무관한 기존 행(보존 대상): ${nonSeedMembers.length}개`);
  for (const m of nonSeedMembers) {
    console.log(`      · ${m.name} (${m.nickname}) role=${m.permission_role} auth=${m.auth_user_id ? "linked" : "null"} id=${m.id}`);
  }

  // ── 전역 UUID 충돌 검사(다른 클럽 포함) ────────────────────────────────
  const { data: globalHits, error: gErr } = await supabase
    .from("members").select("id, club_id, name").in("id", ids);
  if (gErr) {
    console.error("ERROR: 전역 UUID 충돌 조회 실패:", gErr.message);
    process.exit(1);
  }
  const foreignHits = (globalHits ?? []).filter((m) => m.club_id !== E2E_CLUB_ID);
  console.log(`  - 다른 클럽에서 같은 UUID 사용 중: ${foreignHits.length}개 ${foreignHits.length ? JSON.stringify(foreignHits) : "(없음)"}`);
  if (foreignHits.length > 0) {
    console.error("ERROR: 타 클럽 행과 UUID가 충돌합니다. 중단합니다.");
    process.exit(1);
  }

  // ── 모드별 동작 ────────────────────────────────────────────────────────
  if (mode === "DRY-RUN") {
    console.log("\n--- 생성 예정 40행 (dry-run, 아무것도 쓰지 않음) ---");
    console.log(
      ["#", "tour", "name", "nickname", "grade", "member_type", "mapo", "uuid"].join(" | ")
    );
    rows.forEach((r, i) => {
      const p = PLAYERS[i];
      console.log(
        [
          String(i + 1).padStart(2, " "),
          p.tour,
          r.name,
          r.nickname,
          r.grade,
          r.member_type,
          String(r.mapo_score),
          r.id,
        ].join(" | ")
      );
    });

    const gradeDist: Record<string, number> = {};
    const typeDist: Record<string, number> = {};
    for (const r of rows) {
      gradeDist[r.grade] = (gradeDist[r.grade] ?? 0) + 1;
      typeDist[r.member_type] = (typeDist[r.member_type] ?? 0) + 1;
    }
    console.log(`\n등급 분포: ${JSON.stringify(gradeDist)}`);
    console.log(`회원구분 분포: ${JSON.stringify(typeDist)}`);
    console.log(`고정값: permission_role=member, auth_user_id=null, is_kakao_linked=false, phone/address/district/age=null`);
    console.log(`\n실제 반영하려면: npx tsx scripts/seed-e2e-qa-members.ts --apply`);
    return;
  }

  if (mode === "APPLY") {
    const { error } = await supabase
      .from("members")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("ERROR: seed 실패:", error.message);
      process.exit(1);
    }
    const { count } = await supabase
      .from("members").select("id", { count: "exact", head: true }).eq("club_id", E2E_CLUB_ID);
    const { count: seedCount } = await supabase
      .from("members").select("id", { count: "exact", head: true })
      .eq("club_id", E2E_CLUB_ID).in("id", ids);
    console.log(`\nAPPLY 완료 — seed 행 ${seedCount}/40개 존재, 클럽 전체 회원 ${count}명`);
    return;
  }

  // CLEANUP: 결정적 UUID 40개 AND E2E QA club_id 둘 다 일치하는 행만 삭제
  const { error: delErr } = await supabase
    .from("members").delete().in("id", ids).eq("club_id", E2E_CLUB_ID);
  if (delErr) {
    console.error("ERROR: cleanup 실패:", delErr.message);
    process.exit(1);
  }
  const { count: leftover } = await supabase
    .from("members").select("id", { count: "exact", head: true })
    .eq("club_id", E2E_CLUB_ID).in("id", ids);
  const { count: total } = await supabase
    .from("members").select("id", { count: "exact", head: true }).eq("club_id", E2E_CLUB_ID);
  console.log(`\nCLEANUP 완료 — 남은 seed 행 ${leftover}개(0이어야 정상), 클럽 전체 회원 ${total}명`);
}

main().catch((e) => {
  console.error("UNEXPECTED ERROR:", e);
  process.exit(1);
});
