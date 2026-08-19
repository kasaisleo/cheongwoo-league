/**
 * Migration security gate 테스트 (Phase 2A-8E-2F).
 * node:test + node:assert 만 사용한다. 저장소 migration 을 수정하지 않는다.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkSql, run, lex, GRANDFATHERED_THROUGH } from "./check-migration-security.mjs";

/** 문자열 하나를 검사해 rule ID 목록을 돌려준다. */
function rules(sql, file = "0074_test.sql") {
  const report = { items: [], add(f, l, r, d) { this.items.push({ file: f, line: l, rule: r, detail: d }); } };
  checkSql(file, sql, report);
  return { ids: report.items.map((i) => i.rule), items: report.items };
}
const has = (sql, id) => rules(sql).ids.includes(id);

/** 임시 디렉터리에 migration fixture 를 만들고 run() 을 돌린다. */
function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "miggate-"));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 안전한 service-only table 템플릿.
const SAFE_TABLE = `
create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  memo text
);
alter table public.widgets enable row level security;
revoke all privileges on table public.widgets from public, anon, authenticated;
`;

// ── 통과 케이스 ────────────────────────────────────────────

test("1. 0001~0073 은 grandfathering", () => {
  const bad = `create table public.oops (id int);`;
  const out = withDir({ "0073_legacy.sql": bad, "0001_init.sql": bad }, (d) => run(d));
  assert.equal(out.report.items.length, 0);
  assert.equal(out.checked, 0);
});

test("2. 신규 service-only table + RLS + revoke 는 통과", () => {
  assert.deepEqual(rules(SAFE_TABLE).ids, []);
});

test("3. 명시적 sequence + revoke 는 통과", () => {
  const sql = `
create sequence public.widget_counter;
revoke all privileges on sequence public.widget_counter from public, anon, authenticated;`;
  assert.deepEqual(rules(sql).ids, []);
});

test("4. SECURITY DEFINER + 빈 search_path + revoke 는 통과", () => {
  const sql = `
create or replace function public.do_thing(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$ begin perform 1; end $fn$;
revoke all privileges on function public.do_thing(uuid) from public, anon, authenticated;
grant execute on function public.do_thing(uuid) to service_role;`;
  assert.deepEqual(rules(sql).ids, []);
});

test("5. 이미 안전한 migration 전체는 통과", () => {
  const sql = SAFE_TABLE + `
grant select, insert, update, delete on table public.widgets to service_role;`;
  assert.deepEqual(rules(sql).ids, []);
});

test("6. 공백·대소문자·줄바꿈 변형을 허용", () => {
  const sql = `
CREATE   TABLE
   public.widgets (
  id uuid primary key
);
ALTER TABLE public.widgets
   ENABLE ROW LEVEL SECURITY;
REVOKE ALL
   ON TABLE public.widgets
   FROM authenticated, PUBLIC, anon;`;
  assert.deepEqual(rules(sql).ids, []);
});

test("7. 주석 속 위험 문자열은 무시", () => {
  const sql = SAFE_TABLE + `
-- grant all privileges on table public.widgets to anon;
/* create table public.sneaky (id int);
   alter table public.widgets disable row level security; */`;
  assert.deepEqual(rules(sql).ids, []);
});

test("8. 일반 문자열 리터럴은 DDL 로 오인하지 않음", () => {
  const sql = SAFE_TABLE + `
comment on table public.widgets is 'holds widgets; not a create table statement';`;
  assert.deepEqual(rules(sql).ids, []);
});

// ── 실패 케이스 ────────────────────────────────────────────

test("9. 신규 table RLS 누락", () => {
  const sql = `
create table public.widgets (id uuid primary key);
revoke all privileges on table public.widgets from public, anon, authenticated;`;
  assert.ok(has(sql, "MIG-RLS-001"));
});

test("10. 신규 table revoke 누락", () => {
  const sql = `
create table public.widgets (id uuid primary key);
alter table public.widgets enable row level security;`;
  assert.ok(has(sql, "MIG-TABLE-ACL-001"));
});

test("11. anon INSERT grant", () => {
  assert.ok(has(SAFE_TABLE + `grant insert on table public.widgets to anon;`, "MIG-TABLE-WRITE-001"));
});

test("12. authenticated ALL grant", () => {
  assert.ok(has(SAFE_TABLE + `grant all on table public.widgets to authenticated;`, "MIG-TABLE-WRITE-001"));
});

test("13. PUBLIC write grant", () => {
  assert.ok(has(SAFE_TABLE + `grant update on table public.widgets to public;`, "MIG-TABLE-WRITE-001"));
});

test("14. global SELECT policy using(true)", () => {
  const sql = SAFE_TABLE + `
create policy widgets_all on public.widgets for select to anon using (true);`;
  assert.ok(has(sql, "MIG-POLICY-GLOBAL-001"));
});

test("15. write policy with check(true)", () => {
  const sql = SAFE_TABLE + `
create policy widgets_ins on public.widgets for insert to anon with check (true);`;
  const ids = rules(sql).ids;
  assert.ok(ids.includes("MIG-POLICY-WRITE-001"));
});

test("16. sequence revoke 누락", () => {
  assert.ok(has(`create sequence public.widget_counter;`, "MIG-SEQUENCE-ACL-001"));
});

test("17. sequence grant 금지", () => {
  const sql = `
create sequence public.widget_counter;
revoke all privileges on sequence public.widget_counter from public, anon, authenticated;
grant usage on sequence public.widget_counter to anon;`;
  assert.ok(has(sql, "MIG-SEQUENCE-GRANT-001"));
});

test("18. identity 보호 누락", () => {
  const sql = `
create table public.widgets (
  id bigint generated always as identity primary key,
  memo text
);
alter table public.widgets enable row level security;
revoke all privileges on table public.widgets from public, anon, authenticated;`;
  assert.ok(has(sql, "MIG-IDENTITY-001"));
});

test("18b. identity sequence 를 명시 revoke 하면 통과", () => {
  const sql = `
create table public.widgets (
  id bigint generated always as identity primary key,
  memo text
);
alter table public.widgets enable row level security;
revoke all privileges on table public.widgets from public, anon, authenticated;
revoke all privileges on sequence public.widgets_id_seq from public, anon, authenticated;`;
  assert.ok(!rules(sql).ids.includes("MIG-IDENTITY-001"));
});

test("19. View revoke 누락", () => {
  assert.ok(has(`create view public.widget_list as select id from public.widgets;`, "MIG-VIEW-ACL-001"));
});

test("20. View SELECT *", () => {
  const sql = `
create view public.widget_list as select * from public.widgets;
revoke all privileges on table public.widget_list from public, anon, authenticated;`;
  assert.ok(has(sql, "MIG-VIEW-STAR-001"));
});

test("21. function revoke 누락", () => {
  const sql = `
create function public.do_thing(p_id uuid) returns void language sql as $fn$ select 1 $fn$;`;
  assert.ok(has(sql, "MIG-FUNCTION-ACL-001"));
});

test("22. SECURITY DEFINER search_path 누락", () => {
  const sql = `
create function public.do_thing(p_id uuid)
returns void language plpgsql security definer
as $fn$ begin perform 1; end $fn$;
revoke all privileges on function public.do_thing(uuid) from public, anon, authenticated;`;
  assert.ok(has(sql, "MIG-FUNCTION-PATH-001"));
});

test("23. PUBLIC EXECUTE grant", () => {
  const sql = `
create function public.do_thing(p_id uuid) returns void language sql as $fn$ select 1 $fn$;
revoke all privileges on function public.do_thing(uuid) from public, anon, authenticated;
grant execute on function public.do_thing(uuid) to public;`;
  assert.ok(has(sql, "MIG-FUNCTION-PUBLIC-001"));
});

test("24. anon EXECUTE 는 fail-closed", () => {
  const sql = `
create function public.do_thing(p_id uuid) returns void language sql as $fn$ select 1 $fn$;
revoke all privileges on function public.do_thing(uuid) from public, anon, authenticated;
grant execute on function public.do_thing(uuid) to anon;`;
  assert.ok(has(sql, "MIG-FUNCTION-PUBLIC-001"));
});

test("25. 위험한 default privilege grant", () => {
  const sql = `
alter default privileges for role postgres in schema public
  grant select on tables to anon;`;
  assert.ok(has(sql, "MIG-DEFAULT-GRANT-001"));
});

test("26. RLS disable", () => {
  assert.ok(has(`alter table public.widgets disable row level security;`, "MIG-RLS-DISABLE-001"));
});

test("27. schema 미지정 객체", () => {
  assert.ok(has(`create table widgets (id int);`, "MIG-SCHEMA-001"));
  assert.ok(has(`create sequence widget_counter;`, "MIG-SCHEMA-001"));
});

test("28. 다른 schema 대상 보안 DDL", () => {
  assert.ok(has(`create table storage.widgets (id int);`, "MIG-SCHEMA-001"));
});

test("29. 동적 EXECUTE DDL", () => {
  const sql = `
do $$
begin
  execute 'grant all privileges on table public.widgets to anon';
end
$$;`;
  assert.ok(has(sql, "MIG-DYNAMIC-001"));
});

test("30. DO dollar body 안의 동적 권한 변경", () => {
  const sql = `
do $$
begin
  create table public.sneaky (id int);
end
$$;`;
  assert.ok(has(sql, "MIG-DYNAMIC-001"));
});

test("31. 중복 migration 번호", () => {
  const out = withDir({
    "0074_alpha.sql": SAFE_TABLE,
    "0074_beta.sql": SAFE_TABLE,
  }, (d) => run(d));
  assert.ok(out.report.items.some((i) => i.rule === "MIG-FILE-001" && /Duplicate/.test(i.detail)));
});

test("32. 잘못된 filename", () => {
  const out = withDir({ "74-Bad Name.sql": SAFE_TABLE }, (d) => run(d));
  assert.ok(out.report.items.some((i) => i.rule === "MIG-FILE-001"));
});

test("32b. 빈 migration", () => {
  const out = withDir({ "0074_empty.sql": "\n\n" }, (d) => run(d));
  assert.ok(out.report.items.some((i) => i.rule === "MIG-FILE-001" && /empty/i.test(i.detail)));
});

test("33. file / line / rule ID 가 정확", () => {
  const sql = `-- header\n-- header\ncreate table public.widgets (\n  id uuid primary key\n);\n`;
  const { items } = rules(sql, "0074_x.sql");
  const rls = items.find((i) => i.rule === "MIG-RLS-001");
  assert.ok(rls, "MIG-RLS-001 이 보고되어야 한다");
  assert.equal(rls.file, "0074_x.sql");
  assert.equal(rls.line, 3);
});

test("34. 여러 위반을 한 번에 모두 보고", () => {
  const sql = `
create table public.widgets (id uuid primary key);
grant all on table public.widgets to anon;
alter table public.other disable row level security;`;
  const ids = new Set(rules(sql).ids);
  assert.ok(ids.has("MIG-RLS-001"));
  assert.ok(ids.has("MIG-TABLE-ACL-001"));
  assert.ok(ids.has("MIG-TABLE-WRITE-001"));
  assert.ok(ids.has("MIG-RLS-DISABLE-001"));
  assert.ok(ids.size >= 4, `기대 4종 이상, 실제 ${[...ids].join(",")}`);
});

// ── 렉서 · 계약 ────────────────────────────────────────────

test("렉서는 줄 번호와 길이를 보존한다", () => {
  const sql = `line1\n-- comment\n'literal'\n$tag$body$tag$\nend`;
  const { code } = lex(sql);
  assert.equal(code.length, sql.length);
  assert.equal(code.split("\n").length, sql.split("\n").length);
  assert.ok(!/comment/.test(code));
  assert.ok(!/literal/.test(code));
  assert.ok(!/body/.test(code));
});

test("grandfathering 상수는 73", () => {
  assert.equal(GRANDFATHERED_THROUGH, 73);
});

test("공개 SELECT 는 RLS + policy 가 함께 있어야 통과", () => {
  const bad = SAFE_TABLE + `grant select on table public.widgets to anon;`;
  assert.ok(has(bad, "MIG-PUBLIC-SELECT-001"));
  const good = SAFE_TABLE + `
create policy widgets_read on public.widgets for select to anon using (owner_id = auth.uid());
grant select on table public.widgets to anon;`;
  assert.ok(!rules(good).ids.includes("MIG-PUBLIC-SELECT-001"));
});
