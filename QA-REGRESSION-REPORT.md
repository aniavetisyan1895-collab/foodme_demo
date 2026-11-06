# FoodMe QA regression report

First recorded regression run of FoodMe's existing test suites, carried out by
Claude Code following `.claude/skills/regression-test/SKILL.md` and
`.claude/skills/e2e-test/SKILL.md`. Evidence: `QA-Evidence/INDEX.md`.

## Summary

| # | Suite | Result |
|---|---|---|
| 1 | Backend JUnit (MockMvc integration tests) | **15 passed, 0 failed, 0 skipped** |
| 2 | Web lint + build | **Passed** (lint: 0 errors, 7 warnings; build: OK) |
| 3 | Web E2E (Playwright) | **20 passed, 1 failed, 0 skipped**; the failure is an environment limitation, not an application defect |
| 4 | Admin lint + build | **Passed** (lint: no findings; build: OK) |
| 5 | Admin E2E (Playwright) | **7 passed, 0 failed, 0 skipped**, run on installed Google Chrome |

No regressions were found. No application code, tests, dependencies or build
configuration were changed for these runs.

## Evidence basis

Not every result below is backed by a saved file. Some numbers were only
printed to the terminal during the run and weren't written anywhere the
evidence could be copied from.

**Confirmed by saved files** (`QA-Evidence/`):

| Result | File |
|---|---|
| Backend: 15 tests, 0 failures, 0 errors, 0 skipped, per class | `backend/junit-xml/*.xml`, `backend/html-report/` |
| Backend: 15 `PASSED` lines, `BUILD SUCCESSFUL in 1m 30s`, run window 18:33:55–18:34:57 | `backend/gradle-daemon-log-excerpts/01-…` |
| Backend for E2E ran from `build/classes` via Gradle, on PostgreSQL 16.15, 3 migrations applied | `backend/gradle-daemon-log-excerpts/02-…`, `environment/environment-capture.txt` |
| Web E2E: the run failed (exit code 1), exactly one test failed | `web-e2e/npm-debug_playwright-test_…log`, `web-e2e/test-results/.last-run.json` |
| Web E2E: the failing test saw the `/backoffice/` 404 page | `web-e2e/test-results/happy-path-admin-can-login-…/error-context.md` |
| Admin E2E: the run succeeded (exit code 0) with the temporary Chrome config | `admin-e2e/npm-debug_playwright-test_…log`, `admin-e2e/playwright.admin-chrome.config.ts` |
| Web and admin builds produced output (18:20:33 and 18:38:27) | `builds/build-output-listing.txt` |
| Tool versions, commit, PostgreSQL install | `environment/environment-capture.txt` (captured after the runs) |

**Confirmed only by terminal output** (seen during the run, no saved file):

| Result | Source |
|---|---|
| Web E2E: 21 tests, 20 passed, 0 skipped; per-spec counts; 31.4 s | Playwright `list` reporter output |
| Admin E2E: 7 tests, 7 passed, 0 failed, 0 skipped; 36.4 s | Playwright `list` reporter output |
| Web lint: 0 errors, 7 warnings (files and rules listed below) | `oxlint` output |
| Web build: 2475 modules, 998 ms, chunk-size warning | `vite build` output |
| Admin `npm ci`: 379 packages, `eslint@9.39.5` deprecated, 14 vulnerabilities | `npm ci` output |
| Admin lint: no findings | `eslint` output |
| Admin build: 2737 modules, 6.63 s, chunk-size warning | `vite build` output |
| E2E preflight: backend `/api/chef/active` 200 and `/actuator/health` `UP`, ports 5180/5174 free, base-URL variables unset | `curl`, `netstat` and shell output before each E2E run |
| Admin `package.json` and `package-lock.json` unchanged by `npm ci` (SHA-256 before = after) | `sha256sum -c` output; the hash file stayed in the session's temporary folder |
| Workers: 8 for web E2E, 1 for admin E2E | Playwright `list` reporter output |

To make these file-backed next time, run Playwright with an additional file
reporter (for example `--reporter=list,junit` with `PLAYWRIGHT_JUNIT_OUTPUT_NAME`
set) and redirect the lint, build and `npm ci` output to log files.

## Code under test

- Branch `session3-qa-architecture`, commit
  `b2adfa22cb5b9c1610f9f2db3ba4a43a14b0629c` ("FOODQA-1: fix bug",
  2026-11-03 18:09:52 +0400), the same commit as `main`.
- Uncommitted at the time: the agent setup (`CLAUDE.md`, `AGENTS.md`,
  `.agents/`, `.claude/`, a `.gitignore` addition) and the untracked
  `01-introduce-fm-bug-07.patch`, which wasn't applied. None of these change
  application code or tests.

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Home 10.0.26200 |
| JDK | Eclipse Temurin 17.0.21+9 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot`, installed with winget) |
| Gradle | 8.6 (wrapper) |
| Node / npm | v24.16.0 / 11.13.0 |
| PostgreSQL | 16.15 (service `postgresql-x64-16`; the backend logged `Database: jdbc:postgresql://localhost:5432/foodme (PostgreSQL 16.15)` and `Successfully applied 3 migrations`) |
| Backend for E2E | Started by the user outside this session at 19:15:49 through Gradle: main class `am.foodme.backend.FoodmeBackendApplication` run from `apps/backend/build/classes/java/main`, parent process the Gradle daemon. Not the Docker image. The exact Gradle task name isn't logged; the process is consistent with `./gradlew bootRun` |
| Web Playwright | `@playwright/test` 1.62.1 with its bundled Chromium 1234 |
| Admin Playwright | `@playwright/test` 1.63.0; its Chromium 1243 isn't installed, so the suite ran on installed Google Chrome 156.0.8078.74 (`channel: "chrome"`) |

Details: `QA-Evidence/environment/environment-capture.txt`.

## Runs

All times are local (+04:00) on 2026-11-06.

### 1. Backend JUnit

- **Command** (PowerShell, `apps/backend`, `JAVA_HOME` = the JDK above):
  `.\gradlew.bat test --rerun-tasks --console=plain`
- **When:** 18:33:55 to 18:34:57. Exit code 0, `BUILD SUCCESSFUL in 1m 30s`.
- **Result:**

  | Class | Tests | Failures | Errors | Skipped |
  |---|---|---|---|---|
  | `ChefControllerTest` | 2 | 0 | 0 | 0 |
  | `CustomerAuthControllerTest` | 5 | 0 | 0 | 0 |
  | `DishControllerTest` | 2 | 0 | 0 | 0 |
  | `OrderControllerTest` | 6 | 0 | 0 | 0 |
  | **Total** | **15** | **0** | **0** | **0** |

- The planted flaky tests FM-FLAKE-02, -03 and -04 passed on this run. One run
  doesn't show they're stable.
- Log noise, not failures: `HHH000478: Unsuccessful: drop schema foodme` (twice,
  at H2 shutdown after the tests) and a JVM class-sharing warning.
- **Evidence:** `QA-Evidence/backend/` (JUnit XML, HTML report, Gradle daemon
  log excerpt).

### 2. Web lint + build

- **Commands** (Git Bash, `apps/web`, existing `node_modules`):
  `npm run lint`, then `npm run build`. Run before the backend tests; the build
  wrote `apps/web/dist` at 18:20:33.
- **Lint** (`oxlint`): exit 0, 0 errors, 7 warnings in application code:
  `react(only-export-components)` in `src/components/ui/button.tsx` and
  `src/providers/auth-provider.tsx`; `react(set-state-in-effect)` in
  `src/pages/Chef/index.tsx`, `src/pages/Explore/index.tsx` and
  `src/components/sections/dish-modal.tsx`; `react(incompatible-library)` and
  `react-hooks(exhaustive-deps)` in `src/components/sections/order-delivery-form.tsx`.
- **Build** (`tsc -b && vite build`, Vite 8.2.2): exit 0, 2475 modules, built in
  998 ms. One warning: the JS chunk (747.68 kB) is larger than 500 kB.
- **Evidence:** only the build output listing
  (`QA-Evidence/builds/build-output-listing.txt`); the console output wasn't
  saved.

### 3. Web E2E

- **Command** (Git Bash, `apps/web`): `npx playwright test --reporter=list`
- **Preflight:** backend `/api/chef/active` 200, `/actuator/health`
  `{"status":"UP"}`, port 5180 free, `VITE_API_BASE_URL`,
  `PLAYWRIGHT_BASE_URL` and `ADMIN_BASE_URL` unset.
- **When:** started 19:24:23, 31.4 s, 8 workers. Exit code 1.
- **Result:** 21 tests: **20 passed, 1 failed, 0 skipped.**

  | Spec | Tests | Passed | Failed |
  |---|---|---|---|
  | `e2e/happy-path.spec.ts` | 4 | 3 | 1 |
  | `e2e/storefront-flows.spec.ts` | 11 | 11 | 0 |
  | `e2e/layout.spec.ts` | 4 | 4 | 0 |
  | `e2e/flake-dish-modal.spec.ts` (FM-FLAKE-01) | 1 | 1 | 0 |
  | `e2e/flake-cart-persistence.spec.ts` (FM-FLAKE-05) | 1 | 1 | 0 |

- **Failure:** `e2e/happy-path.spec.ts:117`, "admin can login and list orders
  after a storefront checkout".
  - Error at line 170: `expect(locator).toBeVisible()` failed; locator
    `getByLabel(/username/i).or(locator('input[name="username"]'))`, element
    not found within 15000 ms.
  - Cause: the test's last step opens `${API}/backoffice/#/login`. The backend
    returned `404 {"status":404,"error":"Not Found","message":"Not found","path":"/backoffice/"}`;
    the failure snapshot shows exactly that page. The admin app is served under
    `/backoffice` only by the Docker image (`apps/backend/Dockerfile` copies it
    to `static/backoffice/`). The backend here ran from `build/classes`, which
    has no `static/` folder.
  - Everything before that step passed: customer registration and order
    creation through the API, admin login through the API, and finding the new
    order in `/admin/order`.
  - **Classification: environment limitation** caused by running the backend
    with Gradle (`bootRun`) instead of the Docker image. Not an application
    defect and not a regression. It wasn't rerun, because the 404 is
    deterministic.
- **Evidence:** `QA-Evidence/web-e2e/` (`.last-run.json` with
  `"status": "failed"`, the failure's `error-context.md`). Exit code 1 is
  recorded in the Playwright run's npm debug log
  (`npm-debug_playwright-test_…log`); the dev server's log (`npm-debug_vite-dev-5180_…log`)
  records no exit code.

### 4. Admin lint + build

- **Install** (approved): `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` in
  `apps/admin`. Exit 0, 379 packages added. `package.json` and
  `package-lock.json` verified unchanged by SHA-256. npm reported `eslint@9.39.5`
  as deprecated and 14 vulnerabilities (2 moderate, 11 high, 1 critical); no
  `npm audit fix` was run.
- **Commands:** `npm run lint`, then `npm run build`.
- **Lint** (`eslint .`): exit 0, no errors or warnings.
- **Build** (`vite build`, Vite 6.4.3): exit 0, 2737 modules, built in 6.63 s,
  wrote `apps/admin/dist` at 18:38:27. One warning: the JS chunk (1,035.20 kB)
  is larger than 500 kB.
- **Evidence:** only the build output listing
  (`QA-Evidence/builds/build-output-listing.txt`); the console output and npm
  logs weren't kept.

### 5. Admin E2E

- **Command** (Git Bash, `apps/admin`):
  `npx playwright test --config "<session-scratchpad>/pw-admin-chrome/playwright.admin-chrome.config.ts" --reporter=list`
  (`<session-scratchpad>` is the agent session's temporary folder outside the
  repository; the full local path is omitted)
- **Temporary config** outside the repository (copy in
  `QA-Evidence/admin-e2e/playwright.admin-chrome.config.ts`): imports
  `apps/admin/playwright.config.ts` unchanged and only replaces the project with
  `devices["Desktop Chrome"]` plus `channel: "chrome"`, sets the absolute
  `testDir` and the dev server's working directory.
- **Preflight:** backend 200 / `UP`, port 5174 free, base-URL variables unset.
- **When:** started 19:26:40, 36.4 s, 1 worker. Exit code 0.
- **Result:** `e2e/admin-flows.spec.ts`, 7 tests: **7 passed, 0 failed,
  0 skipped** (Admin auth: rejects bad password, logs in with seeded credentials;
  Admin resources: orders list, order show + mark ACCEPTED, chefs list, dishes
  list, sidebar navigation).
- **Caveat:** the suite is meant for Chromium 1243. Passing on Chrome 156 doesn't
  prove it passes on that build.
- **Evidence:** `QA-Evidence/admin-e2e/` (the temporary config). Exit code 0 is
  recorded in the Playwright run's npm debug log (`npm-debug_playwright-test_…log`);
  the dev server's log (`npm-debug_vite-dev-5174_…log`) records no exit code.
  All tests passed, so Playwright left no `test-results/`.

## Side effects

- Both E2E suites created test customers and orders in the local PostgreSQL
  database `foodme`; one admin test changed its own order to ACCEPTED. Nothing
  cleans this data up.
- New gitignored folders: `apps/backend/build/`, `apps/web/dist/`,
  `apps/web/test-results/`, `apps/admin/node_modules/`, `apps/admin/dist/`.

## Limitations

- Each suite ran once. The planted flakes (FM-FLAKE-01 to -05) all passed this
  time; that doesn't make them stable.
- There is no earlier baseline to compare with, so "no regressions" means no
  failures other than the explained environment limitation.
- The `/backoffice` test can only pass against a backend built from the Docker
  image. Whether it should instead use the admin dev server is an open question
  for the team; the test wasn't changed.
- Console output of the lint, build and `npm ci` runs wasn't saved to files and
  isn't part of the evidence (see `QA-Evidence/INDEX.md`, "Evidence that does
  not exist").
