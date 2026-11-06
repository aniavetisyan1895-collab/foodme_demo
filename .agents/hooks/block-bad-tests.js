#!/usr/bin/env node
// Claude Code PreToolUse hook: blocks Write/Edit/MultiEdit calls that add
// skipped, disabled, hidden-failure or assertion-free tests to FoodMe test files.
//
// Contract (https://code.claude.com/docs/en/hooks): JSON on stdin with
// tool_name and tool_input; exit 2 + stderr blocks the call; exit 0 allows it.
// Only test files are inspected. Everything else is allowed immediately.
//
// The check compares the file before and after the change and blocks only if
// the change *adds* a problem (a count goes up), so editing an unrelated part
// of an existing test file is never blocked by what was already there.
//
// Self-test: node .agents/hooks/__tests__/block-bad-tests.cases.js
//
// Known limitation (not covered, by design): the hook only sees the Write,
// Edit and MultiEdit tools. A test file written through the Bash or
// PowerShell tool (redirection, sed -i, Set-Content, cp/mv, git apply,
// node -e, a script, ...) is not inspected. Blocking that before it runs
// would require parsing arbitrary shell commands, which can't be done
// reliably, and a PostToolUse hook runs after the command and can't undo it.
// Helper files that tests import (e.g. apps/web/e2e/auth.ts) aren't test
// files by name and aren't inspected either.

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------- file types

function normalize(p) {
  return String(p || "").replace(/\\/g, "/");
}

function testKind(filePath) {
  const p = normalize(filePath);
  if (p.includes("/node_modules/")) return null;
  if (/\/src\/test\/java\/.+\.java$/.test(p)) return "java";
  if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(p)) return "js";
  return null;
}

// ------------------------------------------------------- source preprocessing

// Replace the contents of comments and string/char literals with spaces
// (keeping newlines and the quote characters), so patterns inside them don't
// count. Template literals keep their ${...} expressions as code.
function stripCode(src, kind) {
  const out = [];
  let i = 0;
  const n = src.length;
  const keep = (c) => out.push(c);
  const blank = (c) => out.push(c === "\n" ? "\n" : " ");

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") blank(src[i++]);
      continue;
    }
    if (c === "/" && d === "*") {
      blank(src[i++]);
      blank(src[i++]);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) blank(src[i++]);
      if (i < n) {
        blank(src[i++]);
        blank(src[i++]);
      }
      continue;
    }
    if (kind === "java" && c === '"' && src.startsWith('"""', i)) {
      keep('"');
      i += 3;
      out.push("  ");
      while (i < n && !src.startsWith('"""', i)) blank(src[i++]);
      if (i < n) {
        out.push("  ");
        keep('"');
        i += 3;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      keep(c);
      i++;
      while (i < n && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\") blank(src[i++]);
        if (i < n) blank(src[i++]);
      }
      if (i < n && src[i] === c) keep(src[i++]);
      continue;
    }
    if (kind === "js" && c === "`") {
      keep(c);
      i++;
      // scan template body
      let depth = 0;
      while (i < n) {
        if (src[i] === "\\") {
          blank(src[i++]);
          if (i < n) blank(src[i++]);
          continue;
        }
        if (src[i] === "`") {
          keep(src[i++]);
          break;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          // keep the expression as code until the matching }
          keep(src[i++]);
          keep(src[i++]);
          depth = 1;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth > 0) keep(src[i++]);
          }
          if (i < n) keep(src[i++]);
          continue;
        }
        blank(src[i++]);
      }
      continue;
    }
    keep(c);
    i++;
  }
  return out.join("");
}

// Index of the brace matching the "{" at `open`, or -1.
function matchBrace(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ------------------------------------------------------------------- rules

const JS_SKIP_OR_HIDE = [
  // test.skip / it.skip / describe.skip / test.describe.skip, also .fixme,
  // .fail, .fails (Vitest), .todo, .skipIf/.runIf (Vitest), .only, with
  // optional modifiers like .serial/.parallel/.concurrent in between.
  {
    re: /\b(?:test|it|describe|suite)(?:\.(?:describe|serial|parallel|concurrent|sequential))*\.(skip|skipIf|runIf|fixme|fail|fails|todo|only)\b/g,
    label: (m) => `${m[0]}`,
  },
  { re: /\b(xit|xtest|xdescribe|fit|fdescribe)\s*\(/g, label: (m) => `${m[1]}(` },
];

const JAVA_SKIP_OR_HIDE = [
  { re: /@(Disabled\w*)\b/g, label: (m) => `@${m[1]}` },
  { re: /@Ignore\b/g, label: () => "@Ignore" },
  {
    re: /\b(?:Assumptions\s*\.\s*)?(assume(?:True|False|That)|assumingThat)\s*\(/g,
    label: (m) => `${m[1]}(`,
  },
  {
    // asserting that an assertion fails = a disguised expected failure
    re: /assert(?:Throws|ThatThrownBy|ThatExceptionOfType)\s*\(\s*(?:org\.opentest4j\.|java\.lang\.)?(AssertionError|AssertionFailedError)\.class/g,
    label: (m) => `expected-failure via ${m[1]}`,
  },
];

function countPatterns(code, rules) {
  const found = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(code)) !== null) found.push(rule.label(m));
  }
  return found;
}

// Assertions that check nothing: a literal compared with a literal.
const JS_TRIVIAL = /\bexpect\s*\(\s*(?:true|false|null|undefined|-?\d+(?:\.\d+)?|""|''|``)\s*\)/g;
const JAVA_TRIVIAL =
  /\bassert(?:True|False)\s*\(\s*(?:true|false)\s*\)|\bassertThat\s*\(\s*(?:true|false|null|-?\d+)\s*\)/g;

function hasRealAssertion(body, kind) {
  const cleaned = body.replace(kind === "js" ? JS_TRIVIAL : JAVA_TRIVIAL, " ");
  if (kind === "js") {
    // expect(...), expect.poll/soft(...), assert(...)/assert.x(...), and
    // helpers whose name starts with expect/assert (e.g. expectCartCount()).
    return /\bexpect(?:\s*\.\s*(?:poll|soft))?\s*\(|\bassert\w*\s*[.(]|\b(?:expect|assert)[A-Z]\w*\s*\(/.test(cleaned);
  }
  // JUnit/AssertJ/Hamcrest/Mockito/MockMvc
  return /\bassert\w*\s*\(|\bverify\w*\s*\(|\.andExpect\s*\(|\bexpect[A-Z]\w*\s*\(/.test(cleaned);
}

// Names of test bodies without a real assertion. `code` is the stripped
// source; `src` is the original (same length, same positions), used only to
// read test titles.
function testsWithoutAssertion(code, kind, src) {
  const missing = [];
  if (kind === "java") {
    const re = /@(?:Test|ParameterizedTest|RepeatedTest)\b/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      const after = code.slice(m.index);
      const sig = /\b(?:void|[\w<>\[\]]+)\s+(\w+)\s*\([^)]*\)[^{;]*\{/.exec(after);
      if (!sig) continue;
      const open = m.index + sig.index + sig[0].length - 1;
      const close = matchBrace(code, open);
      if (close < 0) continue;
      if (!hasRealAssertion(code.slice(open + 1, close), kind)) missing.push(sig[1]);
      re.lastIndex = close;
    }
    return missing;
  }
  // JS/TS: test("name", ...) / it("name", ...); not test.describe/step/beforeEach etc.
  const re = /(^|[^.\w$])(test|it)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const start = m.index + m[0].length;
    // find the first "{" of the callback body after "=>" or "function(...)"
    const arrow = /(=>\s*\{|function\b[^{]*\{)/.exec(code.slice(start));
    if (!arrow) continue;
    const open = start + arrow.index + arrow[0].length - 1;
    const close = matchBrace(code, open);
    if (close < 0) continue;
    const title = /^\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/.exec(src.slice(start));
    const name = title ? `"${title[2]}"` : "(unnamed test)";
    if (!hasRealAssertion(code.slice(open + 1, close), kind)) missing.push(name);
    re.lastIndex = close;
  }
  return missing;
}

function analyze(src, kind) {
  const code = stripCode(src || "", kind);
  return {
    hidden: countPatterns(code, kind === "java" ? JAVA_SKIP_OR_HIDE : JS_SKIP_OR_HIDE),
    noAssert: testsWithoutAssertion(code, kind, src || ""),
  };
}

// ------------------------------------------------- before/after of the change

function applyEdit(content, oldStr, newStr, replaceAll) {
  if (typeof oldStr !== "string" || typeof newStr !== "string") return null;
  if (oldStr === "") return newStr + content; // creating via Edit with empty old_string
  if (!content.includes(oldStr)) return null;
  return replaceAll ? content.split(oldStr).join(newStr) : content.replace(oldStr, () => newStr);
}

function contentsFor(toolName, input, readFile) {
  const filePath = input.file_path;
  let before = "";
  try {
    before = readFile(filePath);
  } catch {
    before = "";
  }
  if (toolName === "Write") return { before, after: String(input.content ?? "") };
  if (toolName === "Edit") {
    const after = applyEdit(before, input.old_string, input.new_string, input.replace_all);
    // If the edit can't be applied the tool will fail anyway; judge the new text alone.
    return after === null ? { before: "", after: String(input.new_string ?? "") } : { before, after };
  }
  if (toolName === "MultiEdit" && Array.isArray(input.edits)) {
    let after = before;
    for (const e of input.edits) {
      const next = applyEdit(after, e.old_string, e.new_string, e.replace_all);
      if (next === null) return { before: "", after: input.edits.map((x) => x.new_string || "").join("\n") };
      after = next;
    }
    return { before, after };
  }
  return null;
}

function added(beforeList, afterList) {
  const counts = new Map();
  for (const x of beforeList) counts.set(x, (counts.get(x) || 0) + 1);
  const result = [];
  for (const x of afterList) {
    const c = counts.get(x) || 0;
    if (c > 0) counts.set(x, c - 1);
    else result.push(x);
  }
  return result;
}

// Returns null if allowed, or a reason string if the change must be blocked.
function evaluate(payload, readFile = (p) => fs.readFileSync(p, "utf8")) {
  const toolName = payload && payload.tool_name;
  const input = (payload && payload.tool_input) || {};
  if (!["Write", "Edit", "MultiEdit"].includes(toolName)) return null;
  const kind = testKind(input.file_path);
  if (!kind) return null;

  const c = contentsFor(toolName, input, readFile);
  if (!c) return null;

  const before = analyze(c.before, kind);
  const after = analyze(c.after, kind);
  const newHidden = added(before.hidden, after.hidden);
  const newNoAssert = after.noAssert.length > before.noAssert.length
    ? added(before.noAssert, after.noAssert)
    : [];

  if (newHidden.length === 0 && newNoAssert.length === 0) return null;

  const lines = [`Blocked by .agents/hooks/block-bad-tests.js: ${normalize(path.basename(input.file_path))}`];
  if (newHidden.length) {
    lines.push(
      `- Adds a skipped, disabled, focused or expected-failure test: ${[...new Set(newHidden)].join(", ")}.`,
      "  FoodMe tests must run and fail loudly (.claude/rules/testing.md, AGENTS.md). Remove it and report the failing case instead.",
    );
  }
  if (newNoAssert.length) {
    lines.push(
      `- Adds a test without a meaningful assertion: ${newNoAssert.join(", ")}.`,
      "  Assert the business outcome (expect(...), assertThat(...), andExpect(...), verify(...)); literal-vs-literal checks don't count.",
    );
  }
  lines.push("If the user explicitly approved this exact exception, ask them to make the change themselves.");
  return lines.join("\n");
}

module.exports = { evaluate, analyze, testKind, stripCode };

// ------------------------------------------------------------------- main

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      process.exit(0); // not a hook payload we understand; don't interfere
    }
    const kind = testKind(payload && payload.tool_input && payload.tool_input.file_path);
    try {
      const reason = evaluate(payload);
      if (reason) {
        process.stderr.write(reason + "\n");
        process.exit(2);
      }
      process.exit(0);
    } catch (err) {
      if (kind) {
        // Fail closed for test files: an unexpected error must not let a change through unchecked.
        process.stderr.write(`block-bad-tests hook could not check this test file: ${err && err.message}\n`);
        process.exit(2);
      }
      process.exit(0);
    }
  });
}
