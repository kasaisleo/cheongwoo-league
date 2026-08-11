/**
 * scripts/seed-e2e-event-attendance.ts
 *
 * Event E2E QA용 출석 원본 fixture 1세트를 e2e_qa 클럽에 준비한다.
 *   - 출석 세션 1개(고정 QA 날짜, status=open)
 *   - QA 회원 참석자 18명(status=attending)
 *   - 게스트 참석자 2명(fixture 전용 guests 행 + session_guests 연결)
 *   → Event 상세에서 "출석 명단 가져오기" 시 import 예상 인원 20명.
 *
 * 실행 방법 (PowerShell):
 *   npx tsx scripts/seed-e2e-event-attendance.ts                   # 생성 dry-run(기본)
 *   npx tsx scripts/seed-e2e-event-attendance.ts --apply           # 생성 반영
 *   npx tsx scripts/seed-e2e-event-attendance.ts --cleanup         # 삭제 dry-run
 *   npx tsx scripts/seed-e2e-event-attendance.ts --cleanup --apply # 삭제 반영
 *
 * 환경변수(.env.local 자동 파싱 — 키를 코드에 저장하거나 출력하지 않는다):
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   (seed-e2e-qa-members.ts와 동일한 계약)
 *
 * 파일 확장자에 대해: 요청서의 예시는 .mjs였으나 이 저장소의 기존 스크립트는
 * 전부 .ts + `npx tsx`이고, tsconfig의 include 패턴이 .ts만 잡아서 .ts로 둬야
 * `npx tsc --noEmit` 타입 검사 대상에 포함된다. "기존 스크립트 구조를 우선
 * 따르라"는 지시에 맞춰 .ts를 선택했다(보고서에 명시).
 *
 * 안전 설계:
 *   - 기본이 dry-run. 프로덕션 write는 --apply가 있을 때만 발생한다.
 *   - 세션/게스트 id는 고정 namespace 기반 결정적 UUIDv5 → 재실행 멱등,
 *     cleanup 대상이 정확히 특정된다(이름 like 검색에 의존하지 않는다).
 *   - club은 slug와 id가 양방향으로 일치할 때만 진행한다.
 *   - 기존 fixture가 기대 구성과 다르면 덮어쓰지 않고 drift로 실패한다(--force 없음).
 *   - cleanup은 FK가 막아주지 않는 참조(event_participants.source_attendance_
 *     session_id는 FK가 없다)까지 직접 확인하고, 참조가 있으면 중단한다.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

/* ── .env.local 파싱 (기존 스크립트와 동일 관례) ───────────────────────── */
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
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

/* ── 대상 (양방향 일치해야만 실행) ─────────────────────────────────────── */
const E2E_CLUB_ID = "0c06c60d-4a37-433a-bbfe-e3f14831b34a";
const E2E_CLUB_SLUG = "e2e_qa";

/** QA 회원 총원(레오 master 제외). 이 값과 다르면 즉시 실패한다. */
const EXPECTED_QA_MEMBERS = 40;
/** 출석 처리할 회원 수. */
const ATTENDING_MEMBERS = 18;
/** 게스트 참석자 수. */
const GUEST_COUNT = 2;

/** 사람이 프로덕션 UI에서 즉시 테스트 데이터임을 알 수 있는 고정 marker. */
const SESSION_TITLE = "[E2E QA] Event Game Attendance";
const GUEST_NAME_PREFIX = "[E2E QA] Guest";
/** 실행일에 따라 바뀌지 않는 고정 QA 날짜. */
const FIXTURE_DATE = "2026-01-01";
/** session_day_type enum 중 QA 성격에 맞는 값. */
const FIXTURE_SESSION_DAY = "custom";
/** 계약상 노출되는 상태(open|closed)만 사용. archived는 쓰지 않는다. */
const FIXTURE_SESSION_STATUS = "open";

/**
 * fixture 행 id 생성용 고정 namespace. 비밀값이 아니며, 바뀌면 기존 fixture와
 * 다른 id가 생성되어 cleanup이 과거 행을 찾지 못하므로 절대 변경하지 않는다.
 */
const FIXTURE_NAMESPACE = "9c3e51ab-27d4-4f6e-8a02-6b5d41e7c9f0";

/* ── UUIDv5 (RFC 4122, SHA-1 기반) ─────────────────────────────────────── */
function uuidv5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([nsBytes, Buffer.from(name, "utf8")]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

const SESSION_ID = uuidv5(`${E2E_CLUB_SLUG}:attendance-session:event-game`, FIXTURE_NAMESPACE);
const GUEST_IDS = Array.from({ length: GUEST_COUNT }, (_, i) =>
  uuidv5(`${E2E_CLUB_SLUG}:guest:${i + 1}`, FIXTURE_NAMESPACE)
);
const GUEST_NAMES = Array.from({ length: GUEST_COUNT }, (_, i) => `${GUEST_NAME_PREFIX} ${i + 1}`);

/* ── CLI ───────────────────────────────────────────────────────────────── */
const KNOWN_FLAGS = new Set(["--apply", "--cleanup"]);

function parseArgs(argv: string[]): { apply: boolean; cleanup: boolean } {
  const unknown = argv.filter((a) => !KNOWN_FLAGS.has(a));
  if (unknown.length > 0) {
    console.error(`ERROR: 알 수 없는 인자: ${unknown.join(", ")}`);
    console.error("사용법: [--cleanup] [--apply]");
    process.exit(1);
  }
  if (argv.filter((a) => a === "--apply").length > 1 || argv.filter((a) => a === "--cleanup").length > 1) {
    console.error("ERROR: 같은 인자를 중복 지정할 수 없습니다.");
    process.exit(1);
  }
  return { apply: argv.includes("--apply"), cleanup: argv.includes("--cleanup") };
}

function fail(msg: string, detail?: unknown): never {
  console.error(`\nFAILED: ${msg}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

/* ── main ──────────────────────────────────────────────────────────────── */
async function main() {
  const { apply, cleanup } = parseArgs(process.argv.slice(2));
  const mode = cleanup ? (apply ? "CLEANUP-APPLY" : "CLEANUP-DRYRUN") : apply ? "APPLY" : "DRYRUN";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  const supabase = createClient(url, key);

  // 프로젝트 식별은 host만 출력한다(키·시크릿은 절대 출력하지 않는다).
  const projectHost = new URL(url).host;

  console.log(`\n=== E2E QA 출석 fixture — mode: ${mode} ===`);
  console.log(`대상 프로젝트: ${projectHost}`);

  /* 1) 클럽 가드 — slug ↔ id 양방향 일치 */
  const [{ data: byId }, { data: bySlug }] = await Promise.all([
    supabase.from("clubs").select("id, slug, name").eq("id", E2E_CLUB_ID).maybeSingle(),
    supabase.from("clubs").select("id, slug, name").eq("slug", E2E_CLUB_SLUG).maybeSingle(),
  ]);
  if (!byId || !bySlug || byId.slug !== E2E_CLUB_SLUG || bySlug.id !== E2E_CLUB_ID) {
    fail("클럽 가드 실패 — club_id와 slug가 일치하지 않습니다.", { byId, bySlug });
  }
  console.log(`대상 클럽: ${byId.name} (slug=${byId.slug}, id=${byId.id})\n`);

  /* 2) 회원 검증 — 레오 master는 fixture 대상에서 제외 */
  const { data: allMembers, error: memErr } = await supabase
    .from("members")
    .select("id, name, nickname, permission_role, auth_user_id, is_active, club_id")
    .eq("club_id", E2E_CLUB_ID);
  if (memErr) fail(`회원 조회 실패: ${memErr.message}`);

  const members = allMembers ?? [];
  const masters = members.filter((m) => m.permission_role === "master");
  // QA 선수 = master가 아니고 카카오 계정에 연결되지 않은 행(= 회원 seed가 만든 40명).
  const qaMembers = members.filter((m) => m.permission_role === "member" && m.auth_user_id === null);
  const foreign = members.filter((m) => m.club_id !== E2E_CLUB_ID);

  console.log(`현재 회원: 총 ${members.length}명 (master ${masters.length}명 / QA 선수 ${qaMembers.length}명)`);
  if (masters.length !== 1) fail(`레오 master 1명을 기대했으나 ${masters.length}명입니다.`);
  if (qaMembers.length !== EXPECTED_QA_MEMBERS) {
    fail(`QA 선수 ${EXPECTED_QA_MEMBERS}명을 기대했으나 ${qaMembers.length}명입니다. 회원 seed 상태를 먼저 확인하세요.`);
  }
  if (foreign.length !== 0) fail(`타 클럽 회원이 조회되었습니다: ${foreign.length}명`);
  if (qaMembers.some((m) => !m.is_active)) fail("비활성 QA 선수가 있어 중단합니다.");
  console.log(`  master(제외 대상): ${masters[0].name} / QA 선수 전원 활성 확인`);

  // 대상 18명 — DB 반환 순서에 의존하지 않도록 결정적 id로 명시 정렬 후 앞 18명.
  // (id는 회원 seed의 UUIDv5라 실행 시점과 무관하게 항상 같은 18명이 선택된다.)
  const sortedQa = [...qaMembers].sort((a, b) => a.id.localeCompare(b.id));
  const targetMembers = sortedQa.slice(0, ATTENDING_MEMBERS);
  const targetMemberIds = new Set(targetMembers.map((m) => m.id));
  console.log(`  출석 대상 ${targetMembers.length}명 선택(id 오름차순 상위 ${ATTENDING_MEMBERS}명)\n`);

  /* 3) 현재 fixture 상태 조회 */
  const [{ data: sessionById }, { data: sessionsByTitle }, { data: fixtureGuests }] = await Promise.all([
    supabase.from("attendance_sessions").select("*").eq("id", SESSION_ID).maybeSingle(),
    supabase.from("attendance_sessions").select("id, title, club_id").eq("title", SESSION_TITLE),
    supabase.from("guests").select("id, name, club_id, is_active").in("id", GUEST_IDS),
  ]);

  // 같은 marker의 세션이 여러 개거나, 우리 id가 아닌 세션이 marker를 쓰고 있으면 drift.
  const strayTitled = (sessionsByTitle ?? []).filter((s) => s.id !== SESSION_ID);
  if (strayTitled.length > 0) {
    fail("fixture drift — 같은 제목의 다른 세션이 존재합니다(자동 삭제/덮어쓰기 하지 않습니다).", strayTitled);
  }

  const { data: existingAttendance } = await supabase
    .from("attendance")
    .select("id, member_id, status")
    .eq("session_id", SESSION_ID);
  const { data: existingSessionGuests } = await supabase
    .from("session_guests")
    .select("id, guest_id")
    .eq("session_id", SESSION_ID);

  const att = existingAttendance ?? [];
  const sg = existingSessionGuests ?? [];
  const guests = fixtureGuests ?? [];

  /* ── CLEANUP 경로 ──────────────────────────────────────────────────── */
  if (cleanup) {
    console.log("--- cleanup 대상 ---");
    console.log(`출석 세션: ${sessionById ? SESSION_ID : "(없음)"}`);
    console.log(`출석 응답 행: ${att.length}개`);
    console.log(`세션-게스트 연결: ${sg.length}개`);
    console.log(`fixture 게스트 행: ${guests.length}개`);

    // 참조 확인 — 이 중 event_participants.source_attendance_session_id에는 FK가
    // 없어서 DB가 막아주지 않는다. 반드시 여기서 직접 확인해야 한다.
    const [{ data: refParts }, { data: refMatches }, { data: refGuestParts }] = await Promise.all([
      supabase
        .from("event_participants")
        .select("id, event_id")
        .eq("source_attendance_session_id", SESSION_ID),
      supabase.from("matches").select("id").eq("session_id", SESSION_ID),
      supabase.from("event_participants").select("id, event_id, guest_id").in("guest_id", GUEST_IDS),
    ]);

    const blockers: string[] = [];
    if ((refParts ?? []).length > 0) {
      blockers.push(
        `event_participants ${refParts!.length}건이 이 출석 세션을 원본으로 참조합니다(source_attendance_session_id). ` +
          `FK가 없어 DB는 막지 않지만, 지우면 Event 참가자의 출처 추적이 끊깁니다.`
      );
    }
    if ((refMatches ?? []).length > 0) {
      blockers.push(`matches ${refMatches!.length}건이 이 세션을 참조합니다(FK가 삭제를 막습니다).`);
    }
    if ((refGuestParts ?? []).length > 0) {
      blockers.push(
        `event_participants ${refGuestParts!.length}건이 fixture 게스트를 참조합니다(FK가 게스트 삭제를 막습니다).`
      );
    }
    // fixture가 소유하지 않은 행이 세션에 붙어 있으면 삭제 범위를 넓히지 않고 중단.
    const unexpectedAtt = att.filter((a) => !targetMemberIds.has(a.member_id));
    if (unexpectedAtt.length > 0) {
      blockers.push(`예상하지 않은 출석 응답 ${unexpectedAtt.length}건이 이 세션에 있습니다.`);
    }
    const unexpectedSg = sg.filter((g) => !GUEST_IDS.includes(g.guest_id));
    if (unexpectedSg.length > 0) {
      blockers.push(`예상하지 않은 게스트 연결 ${unexpectedSg.length}건이 이 세션에 있습니다.`);
    }

    console.log(`\nEvent 관련 참조: event_participants(세션 출처) ${(refParts ?? []).length}건, ` +
      `event_participants(게스트) ${(refGuestParts ?? []).length}건, matches ${(refMatches ?? []).length}건`);
    console.log("회원 삭제 예상치: 0 (회원 행은 절대 건드리지 않음)");
    console.log("다른 클럽 삭제 예상치: 0 (모든 삭제에 club_id/세션 id 조건 고정)");

    if (blockers.length > 0) {
      console.log("\ncleanup 상태: BLOCKED");
      for (const b of blockers) console.log(`  - ${b}`);
      fail("참조가 남아 있어 cleanup을 중단합니다. Event 데이터를 먼저 정리한 뒤 다시 시도하세요.");
    }

    if (!sessionById && att.length === 0 && sg.length === 0 && guests.length === 0) {
      console.log("\ncleanup 상태: 이미 정리됨(no-op)");
      return;
    }
    console.log("\ncleanup 상태: 가능");

    if (!apply) {
      console.log("\n실제 삭제하려면: --cleanup --apply");
      return;
    }

    // 삭제 순서: attendance(FK NO ACTION이라 먼저) → session_guests → session → guests
    const d1 = await supabase.from("attendance").delete().eq("session_id", SESSION_ID);
    if (d1.error) fail(`출석 응답 삭제 실패: ${d1.error.message}`);
    const d2 = await supabase.from("session_guests").delete().eq("session_id", SESSION_ID);
    if (d2.error) fail(`세션-게스트 삭제 실패: ${d2.error.message}`);
    const d3 = await supabase.from("attendance_sessions").delete().eq("id", SESSION_ID).eq("club_id", E2E_CLUB_ID);
    if (d3.error) fail(`출석 세션 삭제 실패: ${d3.error.message}`);
    const d4 = await supabase.from("guests").delete().in("id", GUEST_IDS).eq("club_id", E2E_CLUB_ID);
    if (d4.error) fail(`게스트 삭제 실패: ${d4.error.message}`);

    const { count: leftSessions } = await supabase
      .from("attendance_sessions").select("id", { count: "exact", head: true }).eq("id", SESSION_ID);
    const { count: leftMembers } = await supabase
      .from("members").select("id", { count: "exact", head: true }).eq("club_id", E2E_CLUB_ID);
    console.log(`\nCLEANUP 완료 — 남은 fixture 세션 ${leftSessions}개(0이어야 정상), 클럽 회원 ${leftMembers}명(41이어야 정상)`);
    return;
  }

  /* ── 생성(dry-run / apply) 경로 ────────────────────────────────────── */
  console.log("--- 생성 계획 ---");
  console.log(`출석 세션: "${SESSION_TITLE}"`);
  console.log(`  id=${SESSION_ID}`);
  console.log(`  date=${FIXTURE_DATE} day=${FIXTURE_SESSION_DAY} status=${FIXTURE_SESSION_STATUS}`);
  console.log(`출석 회원 ${targetMembers.length}명:`);
  for (const m of targetMembers) console.log(`  · ${m.name} (${m.nickname}) ${m.id}`);
  console.log(`게스트 ${GUEST_COUNT}명:`);
  GUEST_NAMES.forEach((n, i) => console.log(`  · ${n} ${GUEST_IDS[i]}`));
  console.log(`import 예상 인원: ${targetMembers.length + GUEST_COUNT}명 (회원 ${targetMembers.length} + 게스트 ${GUEST_COUNT})`);

  /* drift 검사 — 기존 fixture가 기대와 다르면 덮어쓰지 않고 실패 */
  const drift: string[] = [];
  if (sessionById) {
    if (sessionById.club_id !== E2E_CLUB_ID) drift.push("기존 세션의 club_id가 다릅니다.");
    if (sessionById.title !== SESSION_TITLE) drift.push(`기존 세션 제목이 다릅니다: "${sessionById.title}"`);
    if (sessionById.session_date !== FIXTURE_DATE) drift.push(`기존 세션 날짜가 다릅니다: ${sessionById.session_date}`);
    if (sessionById.status === "archived") drift.push("기존 세션이 archived 상태입니다.");

    // 누락(missing)은 drift가 아니다 — 다단계 write가 중간에 실패하면 "기대한
    // 행의 부분 집합"만 남는 정상적인 partial state이고, 재실행으로 수렴해야
    // 한다. drift로 판정할 것은 "예상 밖의 행"(extra)과 "기대 행의 값이 다른
    // 경우"(status != attending)뿐이다.
    const extra = att.filter((a) => !targetMemberIds.has(a.member_id));
    const notAttending = att.filter((a) => targetMemberIds.has(a.member_id) && a.status !== "attending");
    if (extra.length > 0) {
      drift.push(`이 세션에 예상 외 출석 응답 ${extra.length}건이 있습니다.`);
    }
    if (notAttending.length > 0) drift.push(`attending이 아닌 응답 ${notAttending.length}건이 있습니다.`);

    // 세션-게스트도 동일 — 누락은 partial, 예상 외 연결만 drift.
    const sgExtra = sg.filter((g) => !GUEST_IDS.includes(g.guest_id));
    if (sgExtra.length > 0) {
      drift.push(`이 세션에 예상 외 게스트 연결 ${sgExtra.length}건이 있습니다.`);
    }
  }
  for (const g of guests) {
    const expectedName = GUEST_NAMES[GUEST_IDS.indexOf(g.id)];
    if (g.club_id !== E2E_CLUB_ID) drift.push(`기존 게스트 ${g.id}의 club_id가 다릅니다.`);
    if (g.name !== expectedName) drift.push(`기존 게스트 이름이 다릅니다: "${g.name}" (기대 "${expectedName}")`);
  }

  const willCreateSession = !sessionById;
  const existingAttForTargets = att.filter((a) => targetMemberIds.has(a.member_id)).length;
  const willCreateAtt = ATTENDING_MEMBERS - existingAttForTargets;
  const willCreateGuests = GUEST_COUNT - guests.length;
  const willCreateSg = GUEST_COUNT - sg.filter((g) => GUEST_IDS.includes(g.guest_id)).length;

  console.log("\n--- 현재 상태 대비 ---");
  console.log(`출석 세션: ${willCreateSession ? "생성 예정" : "이미 존재(재사용)"}`);
  console.log(`출석 응답: 생성 ${willCreateAtt}건 / 기존 재사용 ${existingAttForTargets}건`);
  console.log(`게스트 행: 생성 ${willCreateGuests}건 / 기존 재사용 ${guests.length}건`);
  console.log(`세션-게스트 연결: 생성 ${willCreateSg}건 / 기존 재사용 ${GUEST_COUNT - willCreateSg}건`);
  console.log("회원 행 변경 예상: 0 (INSERT/UPDATE/DELETE 모두 없음)");
  console.log("다른 클럽 변경 예상: 0");

  if (drift.length > 0) {
    console.log("\nfixture drift 감지 — 자동으로 덮어쓰거나 삭제하지 않습니다:");
    for (const d of drift) console.log(`  - ${d}`);
    fail("기존 fixture가 기대 구성과 달라 중단합니다. 수동 확인 후 --cleanup --apply로 정리하거나 데이터를 바로잡으세요.");
  }

  if (willCreateSession || willCreateAtt > 0 || willCreateGuests > 0 || willCreateSg > 0) {
    console.log("\n결과: 생성 필요");
  } else {
    console.log("\n결과: 이미 완성된 fixture (재실행 시 no-op)");
  }

  if (!apply) {
    console.log("\n실제 생성하려면: --apply");
    return;
  }

  /* apply — 모두 결정적 id + 멱등 upsert */
  const upSession = await supabase.from("attendance_sessions").upsert(
    {
      id: SESSION_ID,
      club_id: E2E_CLUB_ID,
      title: SESSION_TITLE,
      session_date: FIXTURE_DATE,
      session_day: FIXTURE_SESSION_DAY,
      status: FIXTURE_SESSION_STATUS,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (upSession.error) fail(`출석 세션 생성 실패: ${upSession.error.message}`);

  const upGuests = await supabase.from("guests").upsert(
    GUEST_IDS.map((id, i) => ({
      id,
      club_id: E2E_CLUB_ID,
      name: GUEST_NAMES[i],
      visit_date: FIXTURE_DATE,
      is_active: true,
    })),
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (upGuests.error) fail(`게스트 생성 실패: ${upGuests.error.message}`);

  // attendance는 (member_id, session_id) UNIQUE로 멱등.
  const upAtt = await supabase.from("attendance").upsert(
    targetMembers.map((m) => ({
      member_id: m.id,
      session_id: SESSION_ID,
      event_date: FIXTURE_DATE,
      status: "attending",
    })),
    { onConflict: "member_id,session_id", ignoreDuplicates: true }
  );
  if (upAtt.error) fail(`출석 응답 생성 실패: ${upAtt.error.message}`);

  // session_guests는 (session_id, guest_id) UNIQUE로 멱등.
  const upSg = await supabase.from("session_guests").upsert(
    GUEST_IDS.map((gid) => ({ session_id: SESSION_ID, guest_id: gid })),
    { onConflict: "session_id,guest_id", ignoreDuplicates: true }
  );
  if (upSg.error) fail(`세션-게스트 연결 실패: ${upSg.error.message}`);

  const [{ count: nAtt }, { count: nSg }, { count: nMembers }] = await Promise.all([
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("session_id", SESSION_ID),
    supabase.from("session_guests").select("id", { count: "exact", head: true }).eq("session_id", SESSION_ID),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("club_id", E2E_CLUB_ID),
  ]);
  console.log(`\nAPPLY 완료 — 출석 응답 ${nAtt}건, 게스트 연결 ${nSg}건, 클럽 회원 ${nMembers}명(41 유지되어야 정상)`);
  console.log(`import 예상 인원: ${(nAtt ?? 0) + (nSg ?? 0)}명`);
}

main().catch((e) => {
  console.error("UNEXPECTED ERROR:", e);
  process.exit(1);
});
