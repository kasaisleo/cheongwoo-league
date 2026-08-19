#!/usr/bin/env node
/**
 * Migration security gate (Phase 2A-8E-2F).
 *
 * 0074 이후 신규 migration에서 커밋 전에 잡아야 하는 실수를 정적으로 검사한다.
 *   - 신규 table의 RLS / 명시적 권한 차단 누락
 *   - anon / authenticated / PUBLIC 에 대한 write grant
 *   - 무제한 공개 policy
 *   - sequence·view·function 권한 계약 누락
 *   - SECURITY DEFINER 의 search_path 누락
 *   - default privileges 재확대, RLS 비활성화
 *   - 검사를 우회하는 동적 SQL
 *
 * 0001~0073 은 grandfathering 한다. 다만 0074+ 가 "기존 객체에" 위험한 권한을
 * 새로 부여하는 행위는 대상 번호와 무관하게 검사한다.
 *
 * Node 표준 라이브러리만 사용한다. DB 에 접속하지 않는다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const GRANDFATHERED_THROUGH = 73;

const DEFAULT_DIR = "supabase/migrations";
const CLIENT_ROLES = ["public", "anon", "authenticated"];

// ── 렉싱 ────────────────────────────────────────────────────
/**
 * 주석 / 문자열 / 식별자 인용 / dollar-quoted body 를 공백으로 지운 사본을 만든다.
 * 길이와 줄바꿈을 그대로 보존하므로 인덱스로 원본 줄 번호를 계산할 수 있다.
 * dollar body 와 문자열 리터럴은 별도로 수집해 동적 SQL 검사에 쓴다.
 */
export function lex(sql) {
  const out = Array.from(sql);
  const literals = [];   // { text, index } — 작은따옴표 문자열
  const dollars = [];    // { text, index } — $tag$ ... $tag$
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);

    if (two === "--") {
      let j = sql.indexOf("\n", i);
      if (j === -1) j = sql.length;
      blank(i, j);
      i = j;
      continue;
    }

    if (two === "/*") {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql.slice(j, j + 2) === "/*") { depth++; j += 2; continue; }
        if (sql.slice(j, j + 2) === "*/") { depth--; j += 2; continue; }
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }

    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      literals.push({ text: sql.slice(i + 1, Math.max(i + 1, j - 1)), index: i });
      blank(i, j);
      i = j;
      continue;
    }

    if (sql[i] === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') { j += 2; continue; }
        if (sql[j] === '"') { j++; break; }
        j++;
      }
      // 인용 식별자는 이름 자체이므로 내용을 남긴다(따옴표만 공백 처리).
      out[i] = " ";
      if (j - 1 < out.length && sql[j - 1] === '"') out[j - 1] = " ";
      i = j;
      continue;
    }

    const dq = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dq) {
      const tag = dq[0];
      const end = sql.indexOf(tag, i + tag.length);
      const j = end === -1 ? sql.length : end + tag.length;
      dollars.push({ text: sql.slice(i + tag.length, end === -1 ? sql.length : end), index: i });
      blank(i, j);
      i = j;
      continue;
    }

    i++;
  }

  return { code: out.join(""), literals, dollars };
}

const lineOf = (sql, index) => sql.slice(0, Math.max(0, index)).split("\n").length;

// 공백 차이를 흡수한 비교용 정규화.
const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

// ── 규칙 ────────────────────────────────────────────────────
const RULES = {
  "MIG-FILE-001": "Migration file naming or numbering is invalid.",
  "MIG-SCHEMA-001": "Security-relevant objects must be created in the public schema with an explicit qualifier.",
  "MIG-DYNAMIC-001": "Security-sensitive dynamic SQL cannot be verified automatically. Use literal top-level DDL or split the migration for review.",
  "MIG-RLS-001": "New public table must enable row level security.",
  "MIG-TABLE-ACL-001": "New public table must revoke privileges from PUBLIC, anon and authenticated.",
  "MIG-TABLE-WRITE-001": "Write privileges must not be granted to PUBLIC, anon or authenticated.",
  "MIG-PUBLIC-SELECT-001": "A public SELECT grant needs row level security and a matching SELECT policy in the same migration.",
  "MIG-POLICY-GLOBAL-001": "Unrestricted USING (true) policy is not allowed for client roles.",
  "MIG-POLICY-WRITE-001": "Write policies for client roles are not allowed.",
  "MIG-SEQUENCE-ACL-001": "New sequence must revoke privileges from PUBLIC, anon and authenticated.",
  "MIG-SEQUENCE-GRANT-001": "Sequence privileges must not be granted to PUBLIC, anon or authenticated.",
  "MIG-IDENTITY-001": "Implicit identity/serial sequence must be revoked explicitly in the same migration.",
  "MIG-VIEW-ACL-001": "New view must revoke privileges from PUBLIC, anon and authenticated.",
  "MIG-VIEW-STAR-001": "Views must list columns explicitly instead of using SELECT *.",
  "MIG-FUNCTION-ACL-001": "New function must revoke EXECUTE from PUBLIC, anon and authenticated.",
  "MIG-FUNCTION-PATH-001": "SECURITY DEFINER function must set an empty search_path.",
  "MIG-FUNCTION-PUBLIC-001": "EXECUTE must not be granted to PUBLIC, and client EXECUTE grants need review.",
  "MIG-DEFAULT-GRANT-001": "Default privileges must not be granted to PUBLIC, anon or authenticated.",
  "MIG-RLS-DISABLE-001": "Row level security must not be disabled.",
};

class Report {
  constructor() { this.items = []; }
  add(file, line, rule, detail) {
    this.items.push({ file, line, rule, detail: detail || RULES[rule] });
  }
}

/** grantee 목록 문자열에서 client role 세 종류를 뽑는다. */
function granteeSet(raw) {
  const set = new Set();
  for (const part of raw.split(",")) {
    const t = part.trim().replace(/^"|"$/g, "").toLowerCase();
    if (CLIENT_ROLES.includes(t)) set.add(t);
  }
  return set;
}

const hasAllClientRoles = (set) => CLIENT_ROLES.every((r) => set.has(r));

/** REVOKE 문 파싱 — { kind, target, roles, index } */
function parseRevokes(code) {
  const out = [];
  const re = /\brevoke\s+([\s\S]*?)\bon\s+(table|sequence|function|all\s+tables\s+in\s+schema|all\s+sequences\s+in\s+schema|all\s+functions\s+in\s+schema)?\s*([\s\S]*?)\bfrom\s+([^;]*);/gi;
  let m;
  while ((m = re.exec(code))) {
    out.push({
      privs: norm(m[1]),
      kind: (m[2] || "table").toLowerCase().replace(/\s+/g, " "),
      target: norm(m[3]),
      roles: granteeSet(m[4]),
      index: m.index,
    });
  }
  return out;
}

/** GRANT 문 파싱 */
function parseGrants(code) {
  const out = [];
  const re = /\bgrant\s+([\s\S]*?)\bon\s+(table|sequence|function|schema|all\s+tables\s+in\s+schema|all\s+sequences\s+in\s+schema|all\s+functions\s+in\s+schema)?\s*([\s\S]*?)\bto\s+([^;]*);/gi;
  let m;
  while ((m = re.exec(code))) {
    out.push({
      privs: norm(m[1]),
      kind: (m[2] || "table").toLowerCase().replace(/\s+/g, " "),
      target: norm(m[3]),
      roles: granteeSet(m[4]),
      index: m.index,
    });
  }
  return out;
}

const nameMatches = (target, name) => {
  const t = target.replace(/"/g, "").trim();
  return t === `public.${name}` || t === name || t.startsWith(`public.${name}(`) || t.startsWith(`${name}(`);
};

const WRITE_PRIVS = ["insert", "update", "delete", "truncate", "references", "trigger"];
const isAllPrivs = (p) => /^all\b/.test(p);

// ── 파일 단위 검사 ──────────────────────────────────────────
export function checkSql(file, sql, report) {
  const { code, literals, dollars } = lex(sql);
  const at = (idx) => lineOf(sql, idx);

  // [1] 동적 SQL — dollar body 와 문자열 리터럴 안의 보안 관련 DDL.
  const DYN = /\b(create\s+(or\s+replace\s+)?(table|view|materialized\s+view|sequence)|create\s+policy|grant\s|revoke\s|alter\s+default\s+privileges|disable\s+row\s+level\s+security)/i;
  const execLiterals = literals.filter((l) => /executes*$/i.test(sql.slice(Math.max(0, l.index - 40), l.index + 1)));
  for (const chunk of [...dollars, ...execLiterals]) {
    if (DYN.test(chunk.text)) {
      report.add(file, at(chunk.index), "MIG-DYNAMIC-001");
      break; // 파일당 1건이면 충분하다 — 어차피 수동 검토 대상이다.
    }
  }

  // [2] RLS 비활성화
  for (const m of code.matchAll(/\balter\s+table\s+[\s\S]*?\bdisable\s+row\s+level\s+security/gi)) {
    report.add(file, at(m.index), "MIG-RLS-DISABLE-001");
  }

  // [3] default privileges 재확대
  for (const m of code.matchAll(/\balter\s+default\s+privileges\b([\s\S]*?);/gi)) {
    const body = norm(m[1]);
    const g = /\bgrant\b([\s\S]*?)\bto\b([\s\S]*)$/.exec(body);
    if (g && [...granteeSet(g[2])].length > 0) {
      report.add(file, at(m.index), "MIG-DEFAULT-GRANT-001");
    }
  }

  const grants = parseGrants(code);
  const revokes = parseRevokes(code);

  // [4] client role 대상 write / ALL grant (신규·기존 객체 모두)
  for (const g of grants) {
    if (g.roles.size === 0) continue;
    if (g.kind === "function" || g.kind === "all functions in schema" || g.kind === "schema") continue;
    const isSeq = g.kind.includes("sequence");
    if (isSeq) {
      report.add(file, at(g.index), "MIG-SEQUENCE-GRANT-001",
        `Sequence privileges granted to ${[...g.roles].join(", ")}.`);
      continue;
    }
    if (isAllPrivs(g.privs) || WRITE_PRIVS.some((p) => new RegExp(`\\b${p}\\b`).test(g.privs))) {
      report.add(file, at(g.index), "MIG-TABLE-WRITE-001",
        `Write privileges granted to ${[...g.roles].join(", ")}.`);
    }
  }

  // [5] policy 검사
  const policies = [];
  for (const m of code.matchAll(
    /\bcreate\s+policy\s+([\w".]+)\s+on\s+([\w".]+)([\s\S]*?)(?=;)/gi)) {
    const body = norm(m[3]);
    const toRoles = /\bto\s+([\w",\s]+?)(?:\busing\b|\bwith\s+check\b|$)/.exec(body);
    const roles = toRoles ? granteeSet(toRoles[1]) : new Set(["public"]); // TO 생략 시 PUBLIC
    const forCmd = (/\bfor\s+(all|select|insert|update|delete)\b/.exec(body) || [, "all"])[1];
    const usingTrue = /\busing\s*\(\s*true\s*\)/.test(body);
    const checkTrue = /\bwith\s+check\s*\(\s*true\s*\)/.test(body);
    policies.push({ name: m[1], table: norm(m[2]), roles, forCmd, usingTrue, checkTrue, index: m.index });
  }

  for (const p of policies) {
    const clientFacing = p.roles.size > 0;
    if (!clientFacing) continue;
    if (p.usingTrue) report.add(file, at(p.index), "MIG-POLICY-GLOBAL-001");
    if (p.checkTrue || ["all", "insert", "update", "delete"].includes(p.forCmd)) {
      report.add(file, at(p.index), "MIG-POLICY-WRITE-001",
        `Policy "${p.name}" exposes ${p.forCmd.toUpperCase()} to ${[...p.roles].join(", ")}.`);
    }
  }

  // [6] 신규 객체별 계약
  const rlsEnabled = new Set();
  for (const m of code.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?([\w".]+)\s+enable\s+row\s+level\s+security/gi)) {
    rlsEnabled.add(norm(m[1]).replace(/"/g, ""));
  }

  const revokedFully = (kind, name) =>
    revokes.some((r) => {
      const kindOk = kind === "table"
        ? (r.kind === "table" || r.kind === "all tables in schema")
        : kind === "sequence"
          ? (r.kind === "sequence" || r.kind === "all sequences in schema")
          : (r.kind === "function" || r.kind === "all functions in schema");
      if (!kindOk) return false;
      if (!isAllPrivs(r.privs)) return false;
      if (!r.kind.startsWith("all ") && !nameMatches(r.target, name)) return false;
      return hasAllClientRoles(r.roles);
    });

  // 6-1 TABLE
  for (const m of code.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w".]+)\s*\(/gi)) {
    const raw = norm(m[1]).replace(/"/g, "");
    const line = at(m.index);
    // 컬럼 목록은 괄호 균형으로 잘라낸다 — 한 줄 정의와 중첩 괄호를 모두 처리한다.
    const open = m.index + m[0].length - 1;
    let depth = 0, close = open;
    for (let k = open; k < code.length; k++) {
      if (code[k] === "(") depth++;
      else if (code[k] === ")") { depth--; if (depth === 0) { close = k; break; } }
    }
    const columns = code.slice(open + 1, close);
    if (!raw.startsWith("public.")) {
      report.add(file, line, "MIG-SCHEMA-001", `Table "${raw}" is not created in the public schema.`);
      continue;
    }
    const name = raw.slice("public.".length);
    if (!rlsEnabled.has(raw) && !rlsEnabled.has(name)) {
      report.add(file, line, "MIG-RLS-001", `New public table "${name}" must enable row level security.`);
    }
    if (!revokedFully("table", name)) {
      report.add(file, line, "MIG-TABLE-ACL-001", `New public table "${name}" must revoke privileges from PUBLIC, anon and authenticated.`);
    }
    // identity / serial
    const cols = columns;
    if (/\b(big|small)?serial\b/i.test(cols) || /\bgenerated\s+(always|by\s+default)\s+as\s+identity\b/i.test(cols)) {
      const guessed = new RegExp(`\\b${name}_\\w+_seq\\b`, "i");
      const guarded = revokes.some((r) => r.kind.includes("sequence") && isAllPrivs(r.privs)
        && hasAllClientRoles(r.roles) && (guessed.test(r.target) || r.kind.startsWith("all ")))
        || /pg_get_serial_sequence\s*\(/i.test(code);
      if (!guarded) {
        report.add(file, line, "MIG-IDENTITY-001",
          `Table "${name}" creates an implicit sequence; revoke it explicitly (e.g. ${name}_<column>_seq).`);
      }
    }
  }

  // 6-2 SEQUENCE
  for (const m of code.matchAll(/\bcreate\s+sequence\s+(?:if\s+not\s+exists\s+)?([\w".]+)/gi)) {
    const raw = norm(m[1]).replace(/"/g, "");
    const line = at(m.index);
    if (!raw.startsWith("public.")) {
      report.add(file, line, "MIG-SCHEMA-001", `Sequence "${raw}" is not created in the public schema.`);
      continue;
    }
    const name = raw.slice("public.".length);
    if (!revokedFully("sequence", name)) {
      report.add(file, line, "MIG-SEQUENCE-ACL-001", `New sequence "${name}" must revoke privileges from PUBLIC, anon and authenticated.`);
    }
  }

  // 6-3 VIEW
  for (const m of code.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(materialized\s+)?view\s+([\w".]+)\s+as\b([\s\S]*?);/gi)) {
    const raw = norm(m[2]).replace(/"/g, "");
    const line = at(m.index);
    if (!raw.startsWith("public.")) {
      report.add(file, line, "MIG-SCHEMA-001", `View "${raw}" is not created in the public schema.`);
      continue;
    }
    const name = raw.slice("public.".length);
    if (!revokedFully("table", name)) {
      report.add(file, line, "MIG-VIEW-ACL-001", `New view "${name}" must revoke privileges from PUBLIC, anon and authenticated.`);
    }
    if (/\bselect\s+(?:[\w"]+\s*\.\s*)?\*/i.test(m[3])) {
      report.add(file, line, "MIG-VIEW-STAR-001", `View "${name}" selects * instead of explicit columns.`);
    }
  }

  // 6-4 FUNCTION
  for (const m of code.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+([\w".]+)\s*\(([\s\S]*?)\)([\s\S]*?)(?=\bcreate\s|\bgrant\s|\brevoke\s|\balter\s|\bcomment\s|\bdo\s|$)/gi)) {
    const raw = norm(m[1]).replace(/"/g, "");
    const line = at(m.index);
    if (!raw.startsWith("public.")) {
      report.add(file, line, "MIG-SCHEMA-001", `Function "${raw}" is not created in the public schema.`);
      continue;
    }
    const name = raw.slice("public.".length);
    const tail = m[3];
    const rawTail = sql.slice(m.index, m.index + m[0].length);
    if (!revokedFully("function", name)) {
      report.add(file, line, "MIG-FUNCTION-ACL-001", `Function "${name}" must revoke EXECUTE from PUBLIC, anon and authenticated.`);
    }
    if (/\bsecurity\s+definer\b/i.test(tail)) {
      // 렉서가 문자열 리터럴을 지우므로 빈 search_path 는 원본에서 확인한다.
      const emptyPath = /\bset\s+search_path\s*(?:=|to)\s*(?:''|"")/i.test(rawTail);
      if (!emptyPath) {
        report.add(file, line, "MIG-FUNCTION-PATH-001", `SECURITY DEFINER function "${name}" must set search_path = ''.`);
      }
    }
  }

  // 6-5 function EXECUTE grant
  for (const g of grants) {
    if (g.kind !== "function" && g.kind !== "all functions in schema") continue;
    if (g.roles.has("public")) {
      report.add(file, at(g.index), "MIG-FUNCTION-PUBLIC-001", "EXECUTE granted to PUBLIC.");
    } else if (g.roles.size > 0) {
      // 공개 RPC 는 실제로 필요하지만 본문이 read-only 인지 정적으로 확신할 수 없다.
      // 초기 Gate 는 fail-closed — 명시 검토 대상으로 남긴다.
      report.add(file, at(g.index), "MIG-FUNCTION-PUBLIC-001",
        `EXECUTE granted to ${[...g.roles].join(", ")}; public RPCs need explicit review.`);
    }
  }

  // [7] 공개 SELECT grant 계약
  for (const g of grants) {
    if (g.roles.size === 0) continue;
    if (g.kind !== "table" && g.kind !== "all tables in schema") continue;
    if (!/\bselect\b/.test(g.privs) && !isAllPrivs(g.privs)) continue;
    const target = g.target.replace(/"/g, "").replace(/^public\./, "");
    const rlsOk = rlsEnabled.has(`public.${target}`) || rlsEnabled.has(target);
    const pol = policies.find((p) => nameMatches(p.table, target) && ["select", "all"].includes(p.forCmd));
    if (!rlsOk || !pol) {
      report.add(file, at(g.index), "MIG-PUBLIC-SELECT-001",
        `SELECT granted on "${target}" without ${!rlsOk ? "row level security" : "a matching SELECT policy"}.`);
    } else if (![...g.roles].some((r) => pol.roles.has(r) || pol.roles.has("public"))) {
      report.add(file, at(g.index), "MIG-PUBLIC-SELECT-001",
        `Grant roles and policy roles do not correspond on "${target}".`);
    }
  }

  // [8] 다른 schema 대상 보안 DDL
  for (const m of code.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view|sequence|function)\s+([\w".]+)/gi)) {
    const raw = norm(m[1]).replace(/"/g, "");
    if (raw.includes(".") && !raw.startsWith("public.")) {
      report.add(file, at(m.index), "MIG-SCHEMA-001",
        `Object "${raw}" targets a schema outside public and needs separate review.`);
    }
  }
}

// ── 파일 수집 · 실행 ────────────────────────────────────────
export function collect(dir) {
  const names = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".sql")).sort();
  return names.map((f) => ({ name: f, path: join(dir, f) }));
}

export function run(dir) {
  const report = new Report();
  const files = collect(dir);
  const seen = new Map();
  let checked = 0;
  let lastNum = -1;

  for (const { name, path } of files) {
    const m = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/.exec(name);
    const num = m ? parseInt(m[1], 10) : NaN;
    const post = Number.isFinite(num) && num > GRANDFATHERED_THROUGH;

    if (!m) {
      // 형식이 어긋난 파일은 번호를 알 수 없으므로 항상 보고한다.
      report.add(name, 1, "MIG-FILE-001", `File name must match NNNN_lower_snake_case.sql.`);
      continue;
    }
    // 번호 중복은 0074+ 에서만 보고한다. 기존 구간에는 이미 중복이 있고
    // (0030 이 두 번 쓰였다) 그것은 grandfathering 대상이다. 다만 새 파일이
    // 기존 번호와 겹치는 경우는 잡아야 하므로 seen 은 전 구간을 추적한다.
    if (seen.has(num)) {
      if (post) {
        report.add(name, 1, "MIG-FILE-001", `Duplicate migration number ${m[1]} (also ${seen.get(num)}).`);
      }
    } else {
      seen.set(num, name);
    }
    if (post) {
      if (num <= lastNum) {
        report.add(name, 1, "MIG-FILE-001", `Migration number ${m[1]} goes backwards.`);
      }
      const sql = readFileSync(path, "utf8").replace(/^﻿/, "");
      if (sql.trim().length === 0) {
        report.add(name, 1, "MIG-FILE-001", "Migration file is empty.");
      } else {
        checkSql(name, sql, report);
      }
      checked++;
    }
    lastNum = Math.max(lastNum, num);
  }

  return { report, checked, total: files.length };
}

function main() {
  const dir = process.argv[2] || DEFAULT_DIR;
  let stat;
  try { stat = statSync(dir); } catch { stat = null; }
  if (!stat || !stat.isDirectory()) {
    console.error(`Migration directory not found: ${dir}`);
    process.exit(1);
  }

  const { report, checked, total } = run(dir);

  if (report.items.length === 0) {
    console.log(`PASS: ${checked} post-baseline migration${checked === 1 ? "" : "s"} checked.`);
    console.log(`Grandfathered through ${String(GRANDFATHERED_THROUGH).padStart(4, "0")}. (${total} file(s) total)`);
    process.exit(0);
  }

  for (const it of report.items) {
    console.error(`${it.file}:${it.line} [${it.rule}]`);
    console.error(`  ${it.detail}`);
  }
  console.error(`\nFAIL: ${report.items.length} violation(s) in ${checked} post-baseline migration(s).`);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
