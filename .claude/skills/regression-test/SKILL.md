---
name: regression-test
description: Run FoodMe's existing test suites as a regression check, choose which suites a change needs, compare the results with the known flakes and seeded defects, and report new failures. Covers the backend JUnit suite, web and admin lint/build, and the web and admin Playwright E2E suites. Use it when asked to run regression, run all tests, check that a change broke nothing, or verify a branch before review.
---

# Regression runs for FoodMe

This skill **runs and reports** the tests that already exist. It doesn't
write tests: for that, use `unit-test`, `integration-test` or `e2e-test`,
which also explain each suite's environment in detail.

Read `CLAUDE.md`, `AGENTS.md` and `.claude/rules/testing.md` first. They take
precedence over this skill.

## The suites

Counted at the time of writing; recount with the commands in Step 3, because
new tests change these numbers.

| # | Suite | Where | Command (run from that directory) | Needs | Tests |
|---|---|---|---|---|---|
| 1 | Backend (JUnit: MockMvc integration tests, plus any unit tests added later) | `apps/backend` | `./gradlew test --rerun-tasks` | JDK 17 on `JAVA_HOME`. H2 in memory; no database or server | 15 in 4 classes |
| 2 | Web lint + build | `apps/web` | `npm run lint`, then `npm run build` | `node_modules` (present today) | – |
| 3 | Web E2E | `apps/web` | `npx playwright test --reporter=list` | Backend on :8081 with Postgres, Playwright Chromium | 21 in 5 specs |
| 4 | Admin lint + build | `apps/admin` | `npm run lint`, then `npm run build` | `node_modules` (**missing today**: `npm ci` needs approval) | – |
| 5 | Admin E2E | `apps/admin` | `npx playwright test --reporter=list` | Same as 3, plus admin `node_modules` | 7 in 1 spec |

On Windows PowerShell use `.\gradlew.bat` instead of `./gradlew`.
`apps/web` also has `npm run test:e2e:all` (web suite, then admin suite), but
running 3 and 5 separately keeps the results attributable. There are no
frontend unit tests: if a `"test:unit"` script exists in a `package.json`, run
it as part of 2 or 4 and report it; if not, report "no frontend unit tests".

## Hard rules

1. **Report, don't repair.** A regression run changes nothing: no production
   code, no tests, no seed data, no configuration, no dependencies. If a test
   fails, classify and report it. Fixing it is a separate task with its own
   approval.
2. **Never fix a seeded `FM-BUG-NN` or "stabilise" an `FM-FLAKE-NN`**, never
   skip, disable or `.only` a test, never add retries or timeouts to get to
   green (`AGENTS.md`, `.claude/rules/testing.md`).
3. **Don't install or start things without approval.** That includes
   `npm ci` in `apps/admin`, `npx playwright install`, and starting the
   backend (`./gradlew bootRun`, which needs Postgres). Playwright starts the
   Vite dev servers itself; that's expected.
4. **Know where E2E data goes.** Suites 3 and 5 create customers and orders in
   whatever backend `VITE_API_BASE_URL` points at, and nothing deletes them.
   The local backend is fine. Before running against a deployed environment
   (Render), ask. Check `VITE_API_BASE_URL`, `PLAYWRIGHT_BASE_URL` and
   `ADMIN_BASE_URL` before the E2E suites; if any is set, report its value.
5. **Don't change branches or the working tree to get a baseline.** No
   `git checkout`, `git switch`, `git stash` or `git worktree` (`CLAUDE.md` →
   Safety constraints protects the untracked patch). If a comparison with
   `main` is needed, ask the user how they want it done.
6. **Never claim a suite passed without running it.** Quote each command with
   its exit code and pass/fail/skip counts. A suite that couldn't run is
   "not run: <reason>", never "passed". A Gradle `test` task marked
   `UP-TO-DATE` didn't run any tests.
7. This skill never stages, commits or pushes. Mask emails, phones, tokens
   and passwords in anything you paste.

## Step 1: Orient and record the starting state

```bash
git branch --show-current
git status --short
git log --oneline -1
git diff --name-only main...HEAD      # committed changes on this branch
grep -rn --exclude-dir=node_modules "FM-BUG-\|FM-FLAKE-" apps
```

Record the branch, the commit, the uncommitted and untracked files, and the
current marker list. Compare `git status --short` again at the end: a
regression run must leave it unchanged (build outputs, `build/`,
`playwright-report/` and `test-results/` are gitignored).

## Step 2: Choose the scope

Use what the user asked for. If they asked for "full regression", run all
five suites. Otherwise derive the scope from the changed files (the `git diff`
above plus uncommitted changes from `git status`):

| Changed paths | Run |
|---|---|
| `apps/backend/**` | 1. If controllers, DTOs, `security/` or services changed, also 3 and 5, because both frontends call the API |
| `apps/web/**` | 2 and 3 |
| `apps/admin/**` | 4 and 5 |
| Only `.claude/**`, `.agents/**`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `infra/**`, `render*.yaml`, `.gitignore` | No test suite covers these. Say so; offer suite 1 as a smoke check |

State the chosen scope and why before running anything.

## Step 3: Preflight

Check each prerequisite and decide per suite whether it can run. Report a
missing prerequisite as "not run" for the suites that need it; don't stop the
others.

```bash
java -version                                   # suite 1: must report 17
ls apps/web/node_modules >/dev/null 2>&1 && echo "web deps ok"
ls apps/admin/node_modules >/dev/null 2>&1 && echo "admin deps ok" || echo "admin deps missing"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8081/api/chef/active?page=0&size=1"   # suites 3, 5: expect 200
```

In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`; use
`curl.exe` with the same arguments, or run the check in Git Bash.

Before the E2E suites, also check that nothing unexpected is listening on 5180
or 5174. Playwright reuses an existing dev server there as is (see the
`e2e-test` skill, Step 2).

To recount tests (read-only):

```bash
grep -cE '^\s*@Test\s*$' apps/backend/src/test/java/am/foodme/backend/*.java
grep -cE '^\s*test\(' apps/web/e2e/*.spec.ts apps/admin/e2e/*.spec.ts
```

## Step 4: Run, cheapest first

Run the suites in scope in this order: 1, 2, 4, 3, 5. The fast,
self-contained ones come first, so a broken build is found before the slow
browser suites start.

- **Backend.** `./gradlew test --rerun-tasks` from `apps/backend`.
  `--rerun-tasks` forces the tests to run even if Gradle thinks nothing
  changed. Per-class results are in `build/test-results/test/*.xml` and the
  HTML report in `build/reports/tests/test/index.html`. Read the totals from
  the XML (`tests=`, `failures=`, `errors=`, `skipped=` attributes).
- **Lint and build.** `npm run lint` and `npm run build` in each app. The web
  build runs `tsc -b`, which type-checks `src` (including any `*.test.ts`)
  but not `e2e/`.
- **E2E.** `npx playwright test --reporter=list` from the app directory. The
  `list` reporter prints one line per test and a summary. It replaces the
  config's HTML reporter for that run; if the user wants the HTML report, run
  without `--reporter` and point them to `npx playwright show-report`, which
  opens a local server and waits, so don't start it yourself. Local runs have
  0 retries and record no trace; for a trace of a failure, rerun that test
  with `--trace on`.

Don't stop at the first failing suite unless the failure makes later suites
meaningless (for example the backend isn't reachable for E2E).

## Step 5: Confirm and classify failures

For each failing test, rerun **only that test** before classifying it:

```bash
# backend, from apps/backend
./gradlew test --rerun-tasks --tests 'am.foodme.backend.<Class>.<method>'
# E2E, from apps/web or apps/admin
npx playwright test <spec file> -g "<test title>" --repeat-each=5 --retries=0 --reporter=list
```

Then classify, using the same classes as the test-writing skills:

| Class | Signs | Report as |
|---|---|---|
| **Known flake** | The test carries an `FM-FLAKE-NN` marker and fails only sometimes. | Known, with the marker. Not a regression. |
| **Known seeded defect** | The failure sits in code with an `FM-BUG-NN` marker. | Known, with the marker. Not a regression unless the task changed that code. |
| **Regression** | Fails reproducibly, no marker, and the changed files plausibly touch it. | New failure. Evidence: assertion, expected vs actual, report path. |
| **Pre-existing failure** | Fails reproducibly with no marker, but nothing in scope touches it. | Pre-existing, not caused by this change, unless you can show otherwise. Without a baseline from `main` you can't prove which; say so. |
| **Environment** | JDK, Postgres, backend, ports, browsers, `node_modules`. | Not run / environment, with the exact error. |
| **New flaky** | Fails only on some reruns, no marker. | Flaky; name the suspected timing or shared-state cause. |

Known flakes and issues in the existing suites (re-check the grep from Step 1):

| Marker / issue | Test | Why it can fail |
|---|---|---|
| FM-FLAKE-02 | `OrderControllerTest.createOrder_firstOrderGetsNumber100001`, `getOrderByNumber_firstOrderIsFm100001` | Assume the first order in the shared H2 database is `FM-100001` |
| FM-FLAKE-03 | `DishControllerTest.getActiveDishesForChef_firstResultIsLavashWrap` | Asserts the first row of an unsorted query |
| FM-FLAKE-04 | `OrderControllerTest.createOrder_createdAtFallsOnToday` | Compares `createdAt` with today's date |
| FM-FLAKE-01 | `apps/web/e2e/flake-dish-modal.spec.ts` | Fixed `waitForTimeout(300)` against 200–1500 ms simulated latency |
| FM-FLAKE-05 | `apps/web/e2e/flake-cart-persistence.spec.ts` | Comment says `FM-FLAKE-05 FIX`; report its actual behaviour |
| known issue | `apps/web/e2e/layout.spec.ts` | Hardcodes `http://localhost:8081`, so it ignores `VITE_API_BASE_URL` |
| environment limitation | `apps/web/e2e/happy-path.spec.ts`, "admin can login and list orders after a storefront checkout" | Its last step opens `${API}/backoffice/#/login`. The admin app is served there only when it was built into the backend image (`apps/backend/Dockerfile` copies it to `static/backoffice/`). Against a backend started with `./gradlew bootRun`, `GET /backoffice/` returns 404 and the test fails. Classify that as environment, not as a regression; check with `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8081/backoffice/` |

Compare results with the most recent regression report if one exists
(`QA-REGRESSION-REPORT.md` at the repository root). A test that passed there
and fails now is a regression candidate. If no earlier report exists, the
first full run on a branch is the baseline; say so in the report. Don't
record run results in this skill.

## Step 6: Report

```markdown
## Regression run: <branch> @ <commit>

**Scope:** <full | suites n, m> because <reason / changed paths>.
**Environment:** JDK <version | missing>, backend <URL, reachable | not reachable>, admin deps <ok | missing>.

### Results
| Suite | Command | Exit | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|---|---|
| 1 Backend | `./gradlew test --rerun-tasks` | | | | | |
| 2 Web lint/build | `npm run lint`, `npm run build` | | – | – | – | |
| 3 Web E2E | `npx playwright test --reporter=list` | | | | | |
| 4 Admin lint/build | `npm run lint`, `npm run build` | | – | – | – | |
| 5 Admin E2E | `npx playwright test --reporter=list` | | | | | |
(a suite that didn't run: "not run: <reason>")

### Failures
| Test | Class (regression / pre-existing / known flake / known defect / environment / new flaky) | Reruns | Evidence |
|---|---|---|---|

### Regressions
- <test>: <what changed that likely caused it>. Suggested next step: <fix in a separate task | FOODQA draft, after duplicate search and approval>.

### Limitations
- <no baseline from main; suites not run and why; data written to <backend>>

### Not changed
- No code, tests, configuration or dependencies changed; nothing installed without approval; nothing staged or committed.
- `git status --short` before / after: <same | differences>
- Patch SHA-256: <value> (unchanged)
```

Offer follow-ups, don't do them: a FOODQA ticket for a regression (search for
duplicates first, create only after the user approves the exact draft), or a
separate fix task.
