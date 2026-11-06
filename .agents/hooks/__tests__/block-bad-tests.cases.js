// Self-check for ../block-bad-tests.js. Run: node .agents/hooks/__tests__/block-bad-tests.cases.js
// Builds hook payloads, calls evaluate() directly, and also runs the hook as a
// process (stdin JSON → exit code) for a few cases. Reads real repo files but
// never writes to them.
"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { evaluate, analyze } = require("../block-bad-tests.js");

const ROOT = path.resolve(__dirname, "../../..");
const HOOK = path.join(ROOT, ".agents/hooks/block-bad-tests.js");
const WEB_SPEC = path.join(ROOT, "apps/web/e2e/new-flow.spec.ts");
const JAVA_TEST = path.join(ROOT, "apps/backend/src/test/java/am/foodme/backend/service/NewServiceTest.java");
const EXISTING_SPEC = path.join(ROOT, "apps/web/e2e/storefront-flows.spec.ts");
const FLAKE_SPEC = path.join(ROOT, "apps/web/e2e/flake-dish-modal.spec.ts");

const write = (file_path, content) => ({ tool_name: "Write", tool_input: { file_path, content } });
const edit = (file_path, old_string, new_string, replace_all = false) => ({
  tool_name: "Edit",
  tool_input: { file_path, old_string, new_string, replace_all },
});

const goodSpec = `import { test, expect } from "@playwright/test";
test("cart keeps item", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore chefs" })).toBeVisible();
});
`;
const goodJava = `package am.foodme.backend.service;
class NewServiceTest {
    @Test
    void createOrder_nonCash_rejected() {
        assertThatThrownBy(() -> service.createOrder(dto, "c@example.com"))
                .isInstanceOf(BadRequestException.class);
    }
}
`;
const spec = (body) => `import { test, expect } from "@playwright/test";\n${body}\n`;
const java = (body) => `package am.foodme.backend.service;\nclass NewServiceTest {\n${body}\n}\n`;

const cases = [
  // ---- allowed
  ["allow: valid Playwright spec", write(WEB_SPEC, goodSpec), false],
  ["allow: valid JUnit test", write(JAVA_TEST, goodJava), false],
  ["allow: MockMvc andExpect", write(JAVA_TEST, java(`@Test void a() throws Exception { mockMvc.perform(get("/api/chef/1")).andExpect(status().isOk()); }`)), false],
  ["allow: Mockito verify", write(JAVA_TEST, java(`@Test void a() { service.run(); verify(repo, never()).save(any()); }`)), false],
  ["allow: expect.poll", write(WEB_SPEC, spec(`test("x", async ({ page }) => { await expect.poll(() => 1 + 1).toBe(2); });`)), false],
  ["allow: helper named expect*", write(WEB_SPEC, spec(`test("x", async ({ page }) => { await expectCartCount(page, 1); });`)), false],
  ["allow: skip words only in comment and string", write(WEB_SPEC, spec(`// don't use test.skip here\ntest("not test.skip, @Disabled", async ({ page }) => { await expect(page).toHaveURL(/explore/); });`)), false],
  ["allow: production file with skip text", write(path.join(ROOT, "apps/web/src/lib/x.ts"), `export const s = () => test.skip(); // not a test file`), false],
  ["allow: helper file without assertions", write(path.join(ROOT, "apps/web/e2e/helpers.ts"), `export async function go(page) { await page.goto("/"); }`), false],
  ["allow: describe/beforeEach without own assertion", write(WEB_SPEC, spec(`test.describe("g", () => { test.beforeEach(async ({ page }) => { await page.goto("/"); }); test("x", async ({ page }) => { await expect(page).toHaveTitle(/FoodMe/); }); });`)), false],
  ["allow: unrelated edit in existing spec", edit(EXISTING_SPEC, `"Header User"`, `"Header Person"`), false],
  ["allow: unrelated edit in planted-flake spec", edit(FLAKE_SPEC, `"dish modal opens and dish can be added to cart"`, `"dish modal opens and the dish can be added to cart"`), false],
  ["allow: Java assertion via AssertJ assertThat", write(JAVA_TEST, java(`@Test void a() { assertThat(service.total()).isEqualTo(1800.0); }`)), false],

  // ---- blocked: skip / disable / hide
  ["block: test.skip", write(WEB_SPEC, spec(`test.skip("x", async ({ page }) => { await expect(page).toHaveURL(/a/); });`)), true],
  ["block: conditional test.skip inside test", write(WEB_SPEC, spec(`test("x", async ({ page, browserName }) => { test.skip(browserName === "webkit"); await expect(page).toHaveURL(/a/); });`)), true],
  ["block: describe.skip", write(WEB_SPEC, spec(`describe.skip("g", () => { it("x", () => { expect(a).toBe(1); }); });`)), true],
  ["block: test.describe.skip", write(WEB_SPEC, spec(`test.describe.skip("g", () => { test("x", async ({ page }) => { await expect(page).toHaveURL(/a/); }); });`)), true],
  ["block: xit", write(WEB_SPEC, spec(`xit("x", () => { expect(a).toBe(1); });`)), true],
  ["block: xdescribe", write(WEB_SPEC, spec(`xdescribe("g", () => {});`)), true],
  ["block: test.fail", write(WEB_SPEC, spec(`test.fail("x", async ({ page }) => { await expect(page).toHaveURL(/a/); });`)), true],
  ["block: test.fixme", write(WEB_SPEC, spec(`test.fixme("x", async ({ page }) => { await expect(page).toHaveURL(/a/); });`)), true],
  ["block: Vitest test.fails", write(path.join(ROOT, "apps/web/src/lib/utils.test.ts"), `import { test, expect } from "vitest";\ntest.fails("x", () => { expect(1 + 1).toBe(3); });`), true],
  ["block: it.todo", write(path.join(ROOT, "apps/web/src/lib/utils.test.ts"), `it.todo("later");`), true],
  ["block: test.only", write(WEB_SPEC, spec(`test.only("x", async ({ page }) => { await expect(page).toHaveURL(/a/); });`)), true],
  ["block: @Disabled", write(JAVA_TEST, java(`@Disabled @Test void a() { assertThat(x).isEqualTo(1); }`)), true],
  ["block: @Disabled with FM-BUG reason", write(JAVA_TEST, java(`@Disabled("FM-BUG-03: threshold") @Test void a() { assertThat(x).isEqualTo(1); }`)), true],
  ["block: @DisabledOnOs", write(JAVA_TEST, java(`@DisabledOnOs(OS.WINDOWS) @Test void a() { assertThat(x).isEqualTo(1); }`)), true],
  ["block: @Ignore", write(JAVA_TEST, java(`@Ignore @Test void a() { assertThat(x).isEqualTo(1); }`)), true],
  ["block: assumeTrue", write(JAVA_TEST, java(`@Test void a() { assumeTrue(false); assertThat(x).isEqualTo(1); }`)), true],
  ["block: assertThrows(AssertionError.class)", write(JAVA_TEST, java(`@Test void a() { assertThrows(AssertionError.class, () -> assertThat(x).isEqualTo(1)); }`)), true],

  // ---- blocked: no meaningful assertion
  ["block: Playwright test without expect", write(WEB_SPEC, spec(`test("x", async ({ page }) => { await page.goto("/"); await page.getByRole("link", { name: "Order now" }).click(); });`)), true],
  ["block: JUnit test without assertion", write(JAVA_TEST, java(`@Test void a() { service.calculate(); }`)), true],
  ["block: trivial expect(true).toBe(true)", write(WEB_SPEC, spec(`test("x", async ({ page }) => { await page.goto("/"); expect(true).toBe(true); });`)), true],
  ["block: trivial assertTrue(true)", write(JAVA_TEST, java(`@Test void a() { service.run(); assertTrue(true); }`)), true],
  ["block: assertion removed from existing test", edit(EXISTING_SPEC, `await expect(page.getByText(/Your cart is empty/i)).toBeVisible();`, `await page.getByText(/Your cart is empty/i).isVisible();`), true],
  ["block: skip added to existing spec", edit(EXISTING_SPEC, `test("empty checkout shows browse message"`, `test.skip("empty checkout shows browse message"`), true],
  ["block: MultiEdit adding xit", { tool_name: "MultiEdit", tool_input: { file_path: WEB_SPEC, edits: [{ old_string: "", new_string: spec(`xit("x", () => { expect(a).toBe(1); });`) }] } }, true],
];

let failed = 0;
for (const [name, payload, shouldBlock] of cases) {
  const reason = evaluate(payload);
  const ok = Boolean(reason) === shouldBlock;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok ? `\n      got: ${reason || "allowed"}` : ""}`);
}

// Process-level check: stdin JSON → exit code (0 allow, 2 block).
const proc = [
  ["process: allow valid spec → exit 0", write(WEB_SPEC, goodSpec), 0],
  ["process: block test.skip → exit 2", write(WEB_SPEC, spec(`test.skip("x", async () => {});`)), 2],
  ["process: non-test file → exit 0", write(path.join(ROOT, "README.md"), "test.skip"), 0],
  ["process: garbage stdin → exit 0", null, 0],
];
for (const [name, payload, code] of proc) {
  const r = spawnSync(process.execPath, [HOOK], { input: payload ? JSON.stringify(payload) : "not json", encoding: "utf8" });
  const ok = r.status === code;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (exit ${r.status})${code === 2 && ok ? `\n      stderr: ${r.stderr.split("\n")[0]}` : ""}`);
}

// Baseline: existing test files must not already contain flagged problems the
// hook would misreport. Read-only.
const existing = [
  ...fs.readdirSync(path.join(ROOT, "apps/web/e2e")).filter((f) => f.endsWith(".spec.ts")).map((f) => path.join(ROOT, "apps/web/e2e", f)),
  ...fs.readdirSync(path.join(ROOT, "apps/admin/e2e")).filter((f) => f.endsWith(".spec.ts")).map((f) => path.join(ROOT, "apps/admin/e2e", f)),
  ...fs.readdirSync(path.join(ROOT, "apps/backend/src/test/java/am/foodme/backend")).filter((f) => f.endsWith(".java")).map((f) => path.join(ROOT, "apps/backend/src/test/java/am/foodme/backend", f)),
];
for (const f of existing) {
  const r = analyze(fs.readFileSync(f, "utf8"), f.endsWith(".java") ? "java" : "js");
  const note = r.hidden.length || r.noAssert.length ? `hidden=${JSON.stringify(r.hidden)} noAssert=${JSON.stringify(r.noAssert)}` : "clean";
  console.log(`INFO  existing ${path.relative(ROOT, f).replace(/\\/g, "/")}: ${note}`);
}

console.log(failed ? `\n${failed} check(s) failed` : `\nall ${cases.length + proc.length} checks passed`);
process.exit(failed ? 1 : 0);
