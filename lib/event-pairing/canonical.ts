/**
 * lib/event-pairing/canonical.ts — canonical 직렬화 / 해시 / seed 정규화.
 *
 * 의존: types.ts 뿐이다.
 *
 * 자체 serializer 를 쓰는 이유: resultHash 는 DB 가 만들지 않으므로 PostgreSQL
 * jsonb 직렬화(키를 "길이 우선 후 바이트순" 으로 정규화한다)를 흉내낼 필요가
 * 없다. 여기서는 사전순 키 정렬을 쓰고, 그 규칙을 이 파일 하나에 가둔다.
 */
import type { PairingEvidence, PairingJsonValue } from "./types.ts";
import { createHash } from "node:crypto";

/** canonical 직렬화가 거부한 값 — 내부 invariant 위반이다. */
export class CanonicalSerializeError extends Error {
  readonly path: string;
  readonly issue: string;
  constructor(path: string, issue: string) {
    super(`CANONICAL_SERIALIZE_FAILED: ${issue} at ${path}`);
    this.name = "CanonicalSerializeError";
    this.path = path;
    this.issue = issue;
  }
}

const OBJECT_PROTO = Object.prototype;

/** prototype 오염 방지 — 이 key 들은 자체 property 여도 직렬화에서 거부한다. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === OBJECT_PROTO || proto === null;
}

/**
 * canonical JSON 문자열. 같은 논리 객체는 항상 byte-identical 하다.
 *   · object key 사전순 정렬, array 순서 보존
 *   · null 명시, undefined 거부
 *   · 정수만 허용(float / NaN / Infinity / -0 거부)
 *   · plain object 만 허용(Date/Map/Set/class/function/symbol/bigint 거부)
 *   · 입력을 mutate 하지 않는다
 */
export function canonicalStringify(value: PairingJsonValue): string {
  return write(value, "$");
}

function write(v: unknown, path: string): string {
  if (v === null) return "null";

  const t = typeof v;
  if (t === "boolean") return v === true ? "true" : "false";
  if (t === "string") return JSON.stringify(v);

  if (t === "number") {
    const n = v as number;
    if (Number.isNaN(n)) throw new CanonicalSerializeError(path, "NAN");
    if (!Number.isFinite(n)) throw new CanonicalSerializeError(path, "INFINITY");
    if (!Number.isInteger(n)) throw new CanonicalSerializeError(path, "NON_INTEGER");
    if (Object.is(n, -0)) throw new CanonicalSerializeError(path, "NEGATIVE_ZERO");
    if (!Number.isSafeInteger(n)) throw new CanonicalSerializeError(path, "UNSAFE_INTEGER");
    return String(n);
  }

  if (t === "undefined") throw new CanonicalSerializeError(path, "UNDEFINED");
  if (t === "bigint") throw new CanonicalSerializeError(path, "BIGINT");
  if (t === "symbol") throw new CanonicalSerializeError(path, "SYMBOL");
  if (t === "function") throw new CanonicalSerializeError(path, "FUNCTION");

  if (Array.isArray(v)) {
    const parts: string[] = [];
    for (let i = 0; i < v.length; i++) parts.push(write(v[i], `${path}[${i}]`));
    return `[${parts.join(",")}]`;
  }

  if (!isPlainObject(v)) throw new CanonicalSerializeError(path, "NON_PLAIN_OBJECT");

  const keys = Object.keys(v).sort();
  const parts: string[] = [];
  for (const k of keys) {
    if (FORBIDDEN_KEYS.has(k)) throw new CanonicalSerializeError(`${path}.${k}`, "FORBIDDEN_KEY");
    const child = (v as Record<string, unknown>)[k];
    if (child === undefined) throw new CanonicalSerializeError(`${path}.${k}`, "UNDEFINED");
    parts.push(`${JSON.stringify(k)}:${write(child, `${path}.${k}`)}`);
  }
  return `{${parts.join(",")}}`;
}

/** UTF-8 바이트 기준 SHA-256 소문자 hex. */
export function sha256Hex(utf8: string): string {
  return createHash("sha256").update(utf8, "utf8").digest("hex");
}

/** canonical JSON 을 UTF-8 로 해시한다. */
export function canonicalHash(value: PairingJsonValue): string {
  return sha256Hex(canonicalStringify(value));
}

// ── seed ────────────────────────────────────────────────────────
export interface SeedNormalizeResult {
  readonly ok: boolean;
  readonly seed: string;
  readonly byteLength: number;
  readonly issue: "NOT_STRING" | "BLANK" | "TOO_LONG" | null;
}

/**
 * seed 정본: trim → NFC → UTF-8 1..128 bytes.
 * 내부 계산·응답·향후 run 저장 전부 이 normalizedSeed 만 쓴다.
 * (0077 CHECK 는 btrim(seed) <> '' 만 요구하고 길이 상한이 없다 — 상한은 엔진 계약이다.)
 */
export function normalizeSeed(raw: unknown, maxBytes: number): SeedNormalizeResult {
  if (typeof raw !== "string") return { ok: false, seed: "", byteLength: 0, issue: "NOT_STRING" };
  const seed = raw.trim().normalize("NFC");
  if (seed.length === 0) return { ok: false, seed: "", byteLength: 0, issue: "BLANK" };
  const byteLength = Buffer.byteLength(seed, "utf8");
  if (byteLength > maxBytes) return { ok: false, seed, byteLength, issue: "TOO_LONG" };
  return { ok: true, seed, byteLength, issue: null };
}

/**
 * seed tie-break 해시. 단순 문자열 이어붙이기는 구분자 충돌이 나므로
 * canonical JSON envelope 를 해시한다.
 */
export function seedTieHash(seed: string, candidateKey: string): string {
  return canonicalHash({ candidateKey, seed });
}

// ── 비교 ────────────────────────────────────────────────────────
/** 사전순 vector 비교. 숫자는 숫자끼리, 문자열은 문자열끼리 비교한다. */
export function compareVectors(
  a: readonly (number | string)[],
  b: readonly (number | string)[],
): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1;
    const sx = String(x);
    const sy = String(y);
    return sx < sy ? -1 : 1;
  }
  return 0;
}

/** 문자열 배열 사전순 비교(참가자 ID 목록 등). */
export function compareStringArrays(a: readonly string[], b: readonly string[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * lineup canonical key. team swap 과 팀내 순서를 정규화해
 * 같은 lineup 이 항상 같은 key 를 갖게 한다.
 */
export function canonicalLineupKey(teamA: readonly string[], teamB: readonly string[]): string {
  const a = [...teamA].sort().join("+");
  const b = [...teamB].sort().join("+");
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 두 참가자 ID 를 순서 무관 pair key 로. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

// ── evidence 헬퍼 ───────────────────────────────────────────────
/** evidence 를 canonical 직렬화 가능한지 즉시 검증한다(오류를 늦게 만나지 않도록). */
export function assertEvidence(evidence: PairingEvidence): PairingEvidence {
  canonicalStringify(evidence);
  return evidence;
}
