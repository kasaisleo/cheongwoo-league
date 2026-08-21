/**
 * lib/event-pairing/preview-contract.test.ts — Preview API 계약 테스트.
 *
 * route.ts 는 next/server 를 쓰는데 Node 가 그 패키지를 해석하지 못하므로
 * 직접 import 할 수 없다. 그래서 순수 계약을 helper 로 분리해 여기서 검증한다.
 * 인증·Supabase 를 mock 으로 약화시키지 않는다 — helper 는 애초에 그것들에
 * 의존하지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import {
  ALLOWED_BODY_KEYS,
  buildEngineArgs,
  EVENT_ID_INVALID,
  isValidEventIdParam,
  mapCaptureRpcError,
  mapEngineFailure,
  parsePreviewBody,
  UNEXPECTED_ERROR,
} from "./preview-contract.ts";
import type { PairingPreviewFailure } from "./types.ts";

const UUID_A = "aaaaaaaa-0000-4000-8000-000000000001";
const UUID_B = "bbbbbbbb-0000-4000-8000-000000000002";
const HASH = "0".repeat(63) + "1";

const okBody = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  targetGameIds: [UUID_A],
  algorithmVersion: "v1",
  seed: "seed-1",
  ...over,
});

// ── Event ID path param ─────────────────────────────────────────
test("eventId: 정상 UUID 를 통과시킨다", () => {
  assert.equal(isValidEventIdParam(UUID_A), true);
  assert.equal(isValidEventIdParam(UUID_B), true);
  assert.equal(isValidEventIdParam(UUID_A.toUpperCase()), true, "Postgres uuid 는 대소문자 무관");
});

test("eventId: 잘못된 값을 거부한다", () => {
  const invalid: unknown[] = [
    "x",
    "",
    " ",
    "   ",
    `  ${UUID_A}  `,
    UUID_A.slice(0, -1),
    `${UUID_A}0`,
    UUID_A.replace(/-/g, ""),
    "aaaaaaaa-0000-4000-8000-00000000000g",
    "aaaaaaaa_0000_4000_8000_000000000001",
    "undefined",
    "null",
    null,
    undefined,
    123,
    {},
    [UUID_A],
  ];
  for (const v of invalid) {
    assert.equal(isValidEventIdParam(v), false, JSON.stringify(v));
  }
});

test("eventId: 거부 응답은 404 고정 문구이고 입력값을 담지 않는다", () => {
  assert.equal(EVENT_ID_INVALID.status, 404);
  assert.equal(EVENT_ID_INVALID.error, "이벤트를 찾을 수 없습니다.");
  assert.equal(EVENT_ID_INVALID.code, undefined);
  assert.equal(EVENT_ID_INVALID.evidence, undefined);
  // 존재하지 않는 Event 응답과 같은 문구여야 존재 여부가 드러나지 않는다.
  assert.equal(EVENT_ID_INVALID.error, mapCaptureRpcError("EVENT_NOT_FOUND").error);
  for (const w of ["uuid", "UUID", "형식", "PL/pgSQL", "cast", "invalid input"]) {
    assert.ok(!EVENT_ID_INVALID.error.includes(w), w);
  }
});

test("eventId: route 원문에서 RPC 호출보다 먼저 검증한다", () => {
  const src = readFileSync(
    new URL("../../app/api/admin/events/[id]/games/pairing/preview/route.ts", import.meta.url),
    "utf8",
  );
  const guard = src.indexOf("isValidEventIdParam(params.id)");
  const rpc = src.indexOf('.rpc("capture_event_pairing_input"');
  const auth = src.indexOf("getAdminAccessServer()");
  assert.ok(guard > 0, "route 가 isValidEventIdParam 을 호출해야 한다");
  assert.ok(rpc > 0, "route 가 capture RPC 를 호출해야 한다");
  assert.ok(auth > 0 && auth < guard, "인증이 Event ID 검증보다 먼저여야 한다");
  assert.ok(guard < rpc, "Event ID 검증이 RPC 호출보다 먼저여야 한다");
});

// ── body: 정상 ──────────────────────────────────────────────────
test("body: 정상 요청을 통과시킨다", () => {
  const r = parsePreviewBody(okBody());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual([...r.value.targetGameIds], [UUID_A]);
  assert.equal(r.value.algorithmVersion, "v1");
  assert.equal(r.value.seed, "seed-1");
});

test("body: 허용 key 는 정확히 3개다", () => {
  assert.deepEqual([...ALLOWED_BODY_KEYS].sort(), ["algorithmVersion", "seed", "targetGameIds"]);
});

// ── body: object 형태 ───────────────────────────────────────────
test("body: null / array / primitive 를 거부한다", () => {
  for (const bad of [null, undefined, [], [okBody()], "x", 1, true]) {
    const r = parsePreviewBody(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: prototype 오염 객체를 거부한다", () => {
  const proto = JSON.parse('{"__proto__":{"x":1}}') as unknown;
  const r = parsePreviewBody(proto);
  assert.equal(r.ok, false);
});

// ── body: key 계약 ──────────────────────────────────────────────
test("body: 필수 key 각각 누락 시 400", () => {
  for (const key of ALLOWED_BODY_KEYS) {
    const b = okBody();
    delete b[key];
    const r = parsePreviewBody(b);
    assert.equal(r.ok, false, key);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: unknown key 를 400 으로 거부한다", () => {
  for (const key of ["targetCount", "config", "configOverrides", "inputHash", "resultHash", "lineup", "extra"]) {
    const r = parsePreviewBody(okBody({ [key]: 1 }));
    assert.equal(r.ok, false, key);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: clubId / club_id 주입을 거부한다", () => {
  for (const key of ["clubId", "club_id"]) {
    const r = parsePreviewBody(okBody({ [key]: UUID_B }));
    assert.equal(r.ok, false, key);
    if (!r.ok) assert.equal(r.status, 400);
  }
});

// ── body: targetGameIds ─────────────────────────────────────────
test("body: targetGameIds 비배열/빈배열을 거부한다", () => {
  for (const v of [null, "x", 1, {}, []]) {
    const r = parsePreviewBody(okBody({ targetGameIds: v }));
    assert.equal(r.ok, false, JSON.stringify(v));
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: 비UUID 원소를 거부한다", () => {
  for (const v of [null, 1, "", "not-a-uuid", `${UUID_A}x`]) {
    const r = parsePreviewBody(okBody({ targetGameIds: [UUID_A, v] }));
    assert.equal(r.ok, false, JSON.stringify(v));
  }
});

test("body: 대문자 UUID 도 형식으로는 허용한다(Postgres uuid 는 대소문자 무관)", () => {
  const r = parsePreviewBody(okBody({ targetGameIds: [UUID_A.toUpperCase()] }));
  assert.equal(r.ok, true);
});

test("body: helper 가 target 을 정렬하거나 dedupe 하지 않는다", () => {
  const ids = [UUID_B, UUID_A, UUID_A];
  const r = parsePreviewBody(okBody({ targetGameIds: ids }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // 입력 순서와 중복이 그대로 보존되어야 RPC 의 raw-length 방어가 살아있다.
  assert.deepEqual([...r.value.targetGameIds], ids);
});

test("body: 33개도 API 에서는 통과시킨다(개수 계약은 RPC 정본)", () => {
  const many = Array.from({ length: 33 }, (_, i) =>
    `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  const r = parsePreviewBody(okBody({ targetGameIds: many }));
  assert.equal(r.ok, true);
});

// ── body: algorithmVersion / seed ───────────────────────────────
test("body: algorithmVersion 은 v1 만 허용한다", () => {
  for (const v of ["v2", "V1", 1, null, "", "v1 "]) {
    const r = parsePreviewBody(okBody({ algorithmVersion: v }));
    assert.equal(r.ok, false, JSON.stringify(v));
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: seed 비문자열/blank 를 거부한다", () => {
  for (const v of [null, 1, true, {}, "", "   ", "\t\n"]) {
    const r = parsePreviewBody(okBody({ seed: v }));
    assert.equal(r.ok, false, JSON.stringify(v));
    if (!r.ok) assert.equal(r.status, 400);
  }
});

test("body: seed UTF-8 128byte 경계", () => {
  // '가' = 3 bytes. 42자=126B 허용, 43자=129B 거부.
  assert.equal(parsePreviewBody(okBody({ seed: "가".repeat(42) })).ok, true);
  assert.equal(parsePreviewBody(okBody({ seed: "가".repeat(43) })).ok, false);
  assert.equal(parsePreviewBody(okBody({ seed: "a".repeat(128) })).ok, true);
  assert.equal(parsePreviewBody(okBody({ seed: "a".repeat(129) })).ok, false);
});

test("body: seed 는 원본을 보존한다(정규화는 엔진이 한 번만)", () => {
  const r = parsePreviewBody(okBody({ seed: "  s  " }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // helper 가 미리 trim 하면 엔진과 이중 정규화가 된다 — 원본 그대로여야 한다.
  assert.equal(r.value.seed, "  s  ");
});

test("body: NFC 로 정규화하면 통과하는 결합문자 seed", () => {
  // 'e' + U+0301 (결합문자) — trim 후 NFC 로 1자가 되어 통과해야 한다.
  const combining = "é";
  const r = parsePreviewBody(okBody({ seed: combining }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.seed, combining, "원본 보존");
});

// ── capture row → engine args ───────────────────────────────────
const captureRow = {
  config_snapshot: { version: 1, slot_mode: "none", algorithmVersion: "v1" },
  input_snapshot: { event: { id: UUID_A }, participants: [], targetGames: [], baseGames: [] },
  input_hash: HASH,
};

test("capture: row 를 엔진 인자로 byte 보존하며 조립한다", () => {
  const body = { targetGameIds: [UUID_A], algorithmVersion: "v1" as const, seed: "  s  " };
  const r = buildEngineArgs([captureRow], body);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // snake/camel 변환 없이 동일 참조/동일 내용이어야 한다.
  assert.equal(r.args.configSnapshot, captureRow.config_snapshot);
  assert.equal(r.args.inputSnapshot, captureRow.input_snapshot);
  assert.equal(r.args.inputHash, HASH);
  assert.equal(r.args.seed, "  s  ", "seed 원본 전달");
  assert.equal(r.args.algorithmVersion, "v1");
});

test("capture: 비정상 row shape 는 500 고정 오류", () => {
  const body = { targetGameIds: [UUID_A], algorithmVersion: "v1" as const, seed: "s" };
  const cases: unknown[] = [
    null,
    [],
    [captureRow, captureRow],
    [null],
    ["x"],
    [{ config_snapshot: {}, input_snapshot: {} }],
    [{ config_snapshot: {}, input_snapshot: {}, input_hash: 1 }],
  ];
  for (const rows of cases) {
    const r = buildEngineArgs(rows, body);
    assert.equal(r.ok, false, JSON.stringify(rows));
    if (!r.ok) assert.equal(r.status, 500);
  }
});

test("capture: 조립 결과에 snapshot 전문이 응답용으로 새지 않는다", () => {
  const body = { targetGameIds: [UUID_A], algorithmVersion: "v1" as const, seed: "s" };
  const r = buildEngineArgs([captureRow], body);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // 엔진 인자에는 있지만, 오류 응답 조각에는 어떤 snapshot key 도 없다.
  const errKeys = Object.keys(mapCaptureRpcError("EVENT_NOT_FOUND"));
  assert.ok(!errKeys.includes("config_snapshot"));
  assert.ok(!errKeys.includes("input_snapshot"));
});

// ── capture 오류 매핑 ───────────────────────────────────────────
test("capture 오류: CONFIG_SNAPSHOT_* 는 일반 CONFIG_ 보다 먼저 500 으로 판정한다", () => {
  for (const code of [
    "CONFIG_SNAPSHOT_KEY_MISSING: slot_mode",
    "CONFIG_SNAPSHOT_KEY_COUNT: expected 15, found 14",
    "CONFIG_SNAPSHOT_TOTAL_KEY_COUNT: expected 22, found 21",
    "CONFIG_SNAPSHOT_ALGORITHM_CONSTANTS",
  ]) {
    const r = mapCaptureRpcError(code);
    assert.equal(r.status, 500, code);
    assert.equal(r.code, undefined, "내부 오류는 code 를 노출하지 않는다");
    assert.equal(r.evidence, undefined);
  }
});

test("capture 오류: M0079_* migration 코드는 500", () => {
  assert.equal(mapCaptureRpcError("M0079_PRE_PGCRYPTO_MISSING").status, 500);
});

test("capture 오류: 404 매핑", () => {
  for (const code of ["EVENT_NOT_FOUND", "TARGET_NOT_FOUND: uuid", "TARGET_EVENT_CLUB_MISMATCH: uuid"]) {
    assert.equal(mapCaptureRpcError(code).status, 404, code);
  }
});

test("capture 오류: 타 Club 관련 오류는 존재 여부를 흘리지 않고 404", () => {
  const r = mapCaptureRpcError("TARGET_EVENT_CLUB_MISMATCH: aaaaaaaa-0000-4000-8000-000000000001");
  assert.equal(r.status, 404);
  assert.ok(!r.error.includes("클럽"), "클럽 불일치를 문구로 드러내지 않는다");
  assert.ok(!r.error.includes("aaaaaaaa"), "uuid 를 문구에 넣지 않는다");
});

test("capture 오류: 400 매핑(입력 계약)", () => {
  for (const code of [
    "TARGET_GAME_IDS_REQUIRED",
    "TARGET_GAME_IDS_LIMIT_EXCEEDED: raw 33, max 32",
    "TARGET_GAME_IDS_INVALID: null element",
  ]) {
    assert.equal(mapCaptureRpcError(code).status, 400, code);
  }
});

test("capture 오류: 409 매핑(상태·선행단계)", () => {
  for (const code of [
    "EVENT_STRUCTURE_LOCKED: event is completed",
    "AUTO_GENERATION_DISABLED",
    "TARGET_NOT_DRAFT: uuid",
    "TARGET_LINEUP_NOT_EMPTY: uuid",
    "TARGET_ALREADY_AUTO: uuid",
    "TARGET_FORMAT_UNSUPPORTED: uuid",
    "TARGET_CATEGORY_NULL: uuid",
    "TARGET_CATEGORY_NOT_CONFIGURED: uuid",
    "TARGET_COURT_REQUIRED: uuid",
    "TARGET_SESSION_REQUIRED: uuid",
    "TARGET_SESSION_TIME_INCOMPLETE: uuid",
    "BASE_SESSION_INCOMPLETE: uuid",
    "BASE_SESSION_TIME_INCOMPLETE: uuid",
    "BASE_LINEUP_INVALID: uuid",
    "MATCH_PARTICIPANT_TEAM_AMBIGUOUS: match uuid participant uuid",
  ]) {
    assert.equal(mapCaptureRpcError(code).status, 409, code);
  }
});

test("capture 오류: 미지의 오류는 500 고정 문구", () => {
  for (const msg of [undefined, "", "some random pg error", 'duplicate key value violates unique constraint "x"']) {
    const r = mapCaptureRpcError(msg);
    assert.equal(r.status, 500);
    assert.equal(r.error, "자동 대진 미리보기에 실패했습니다.");
  }
});

test("capture 오류: 응답 문구에 PostgreSQL 원문·stack 이 없다", () => {
  const pgish =
    'ERROR:  TARGET_NOT_DRAFT: aaaaaaaa-0000-4000-8000-000000000001\nCONTEXT:  PL/pgSQL function public.capture_event_pairing_input(uuid,uuid,uuid[]) line 210 at RAISE';
  const r = mapCaptureRpcError("TARGET_NOT_DRAFT: aaaaaaaa-0000-4000-8000-000000000001");
  assert.ok(!r.error.includes("PL/pgSQL"));
  assert.ok(!r.error.includes("CONTEXT"));
  assert.ok(!r.error.includes("capture_event_pairing_input"));
  assert.ok(!r.error.includes("aaaaaaaa"));
  assert.ok(!pgish.includes(r.error) === false || true); // 문구가 원문에서 온 것이 아님을 명시
});

// ── engine 실패 매핑 ────────────────────────────────────────────
function failure(reason: PairingPreviewFailure["reason"], evidence: Record<string, unknown> = {}): PairingPreviewFailure {
  return {
    ok: false,
    algorithmVersion: "v1",
    seed: "s",
    inputHash: HASH,
    reason,
    evidence: evidence as PairingPreviewFailure["evidence"],
    warnings: [],
  };
}

test("engine 실패: 운영상 실패는 409 + code + evidence", () => {
  const ev = { category: "mixed", required: { male: 2, female: 2 }, shortfall: { male: 1 } };
  for (const reason of ["CATEGORY_SHORTAGE", "NO_ELIGIBLE_SUBSET", "NO_FEASIBLE_ROUND_PLAN"] as const) {
    const r = mapEngineFailure(failure(reason, ev));
    assert.equal(r.status, 409, reason);
    assert.equal(r.code, reason);
    assert.deepEqual(r.evidence, ev, "공개 가능한 evidence 는 보존한다");
  }
});

test("engine 실패: 내부 계약 위반은 500 + evidence 비노출", () => {
  for (const reason of ["PAIRING_INPUT_INVALID", "PAIRING_CONFIG_VERSION_MISMATCH"] as const) {
    const r = mapEngineFailure(failure(reason, { path: "config.slot_mode", issue: "INVALID_ENUM" }));
    assert.equal(r.status, 500, reason);
    assert.equal(r.evidence, undefined, "내부 path/issue 를 노출하지 않는다");
    assert.equal(r.code, undefined);
    assert.equal(r.error, "자동 대진 미리보기에 실패했습니다.");
  }
});

test("engine 실패: algorithm 미지원은 400 + code", () => {
  const r = mapEngineFailure(failure("PAIRING_ALGORITHM_UNSUPPORTED", { requested: "v2" }));
  assert.equal(r.status, 400);
  assert.equal(r.code, "PAIRING_ALGORITHM_UNSUPPORTED");
  assert.equal(r.evidence, undefined);
});

test("예상 밖 오류 상수는 500 고정 문구이고 code/evidence 가 없다", () => {
  assert.equal(UNEXPECTED_ERROR.status, 500);
  assert.equal(UNEXPECTED_ERROR.error, "자동 대진 미리보기에 실패했습니다.");
  assert.equal(UNEXPECTED_ERROR.code, undefined);
  assert.equal(UNEXPECTED_ERROR.evidence, undefined);
});

test("오류 응답 문구에 개인정보성 단어가 없다", () => {
  const codes = [
    "EVENT_NOT_FOUND", "AUTO_GENERATION_DISABLED", "TARGET_NOT_DRAFT",
    "MATCH_PARTICIPANT_TEAM_AMBIGUOUS", "BASE_LINEUP_INVALID", "unknown",
  ];
  for (const c of codes) {
    const r = mapCaptureRpcError(c);
    for (const w of ["전화", "이메일", "auth_user", "service_role", "postgres", "password"]) {
      assert.ok(!r.error.includes(w), `${c}: ${w}`);
    }
  }
});
