# FoodMe: Claude Code project guide

FoodMe is a small food-ordering app used as a QA training system: chef list →
chef menu → cart → cash-only checkout, plus a back-office admin. It deploys to
Render's free tier (`render.yaml`, `render-monitoring.yaml`). The root
`README.md` is a non-technical, student-facing deploy guide, so don't turn it into
developer docs.

How to work in this repo (scope, seeded defects, git, Jira, reporting):
@AGENTS.md

## Architecture

There's no root workspace. Each app builds on its own.

| Path | Stack | Notes |
|---|---|---|
| `apps/backend` | Spring Boot 3.3, Java 17 toolchain, Gradle 8.6 wrapper, JPA, Flyway, Postgres, Spring Security + JWT | Serves `/api/**` (storefront) and `/admin/**` (back office API) on port 8081 |
| `apps/web` | React 19, TypeScript, Vite 8, Tailwind 4, TanStack Query, react-hook-form + zod, Dexie (IndexedDB cart) | Customer storefront |
| `apps/admin` | React 18, react-admin 5, MUI 6, axios, plain JS/JSX | Back office. Hash router; production base path `/backoffice/` |
| `infra/monitoring` | Prometheus + Loki + Grafana + Grafana MCP in one container | See `infra/monitoring/README.md` |

- **One origin in production.** `apps/backend/Dockerfile` (build context = repo
  root) builds web and admin and serves them from the backend: storefront at
  `/`, admin at `/backoffice`.
- **Dev API base.** Both SPAs call `http://localhost:8081` in dev mode unless
  `VITE_API_BASE_URL` is set (`apps/web/src/api/client.ts`,
  `apps/admin/src/api/base-api.js`).
- **API contract.** Request and response field names are shared by all three
  apps. Odd-looking names like `exploreChefResponseDtoList`, `dishDtoList`,
  `createOrderDishes` and `[{lang, value}]` arrays are intentional.

App-specific conventions are in `.claude/rules/` and load automatically for
matching paths.

## Commands

Prerequisites: JDK 17 (`JAVA_HOME` set) for anything under `apps/backend`, and
Node + npm for web and admin. Run commands from the app directory.

Backend (`apps/backend`). On Windows PowerShell use `.\gradlew.bat`:

```bash
./gradlew test                                   # all backend tests (H2, no DB needed)
./gradlew test --tests OrderControllerTest       # one class
./gradlew test --tests 'OrderControllerTest.createOrder_withoutToken_unauthorized'  # one method
./gradlew build                                  # compile + tests
./gradlew bootRun                                # API on :8081; needs Postgres (DB_* defaults in application.properties)
```

Test report: `apps/backend/build/reports/tests/test/index.html`. Swagger UI at
`/swagger-ui.html` while the backend is running.

Web (`apps/web`) and admin (`apps/admin`):

```bash
npm ci
npm run dev            # Vite dev server
npm run lint           # web: oxlint, admin: eslint
npm run build          # web: tsc -b && vite build, admin: vite build
npm run test:e2e       # Playwright; starts its own dev server (web :5180, admin :5174)
npx playwright test e2e/happy-path.spec.ts   # one spec
npx playwright test -g "takeaway checkout"   # tests by title
npx playwright show-report                   # open the last HTML report
```

`apps/web` also has `npm run test:e2e:all` (web suite, then admin suite).
E2E target overrides: `PLAYWRIGHT_BASE_URL` (web), `ADMIN_BASE_URL` (admin),
`VITE_API_BASE_URL` (API used by the specs).

## Testing strategy

What exists today:

| Suite | Type | Framework | Location | Needs |
|---|---|---|---|---|
| Backend | Integration (full context, HTTP via MockMvc, in-memory DB) | JUnit 5, Spring Boot Test, MockMvc, H2 (`test` profile, `src/test/resources/data.sql`) | `apps/backend/src/test/java/am/foodme/backend/` | JDK 17 |
| Web E2E | End-to-end UI + some API calls | Playwright (Chromium) | `apps/web/e2e/` | Backend on :8081 |
| Admin E2E | End-to-end UI | Playwright (Chromium) | `apps/admin/e2e/` | Backend on :8081, `npm ci` in `apps/admin` |

Not present yet: frontend unit tests, backend unit tests, coverage, CI.
The planned layers (Vitest for web, Mockito service tests, API negative tests,
tagged Playwright regression) come in later phases. Don't reference them as
existing until they're added. Test-writing rules are in `.claude/rules/testing.md`.

## Safety constraints (non-negotiable)

- **Never touch `01-introduce-fm-bug-07.patch`.** Don't stage, edit, apply,
  move or delete it. It must stay untracked and unchanged. It is *not*
  gitignored, so ordinary Git commands can sweep it up:
  - **Would stage it:** `git add -A`, `git add --all`, `git add .`,
    `git add :/`, or `git add` on any directory that contains it (the repo
    root).
  - **Would hide it** (move it into a stash, gone from the working tree):
    `git stash -u`, `git stash --include-untracked`, `git stash -a`,
    `git stash --all`.
  - **Would delete it:** `git clean -f` and its variants (`-fd`, `-fdx`).
  - Never run any of these. Stage only paths the user explicitly approved,
    one by one (e.g. `git add CLAUDE.md`). `git commit -a` stages only
    already-tracked files, so it can't pick up the untracked patch, but it's
    still forbidden because it sweeps up unrelated tracked changes.
  - Before every commit, confirm with `git status` that the patch is still
    `??` (untracked) and that `sha256sum 01-introduce-fm-bug-07.patch` is
    unchanged.
- **Never push to `main`** and never force-push. Work on a feature branch,
  push only that branch, and commit or push only when the user asks.
- **No destructive commands** (`rm -rf`, `git reset --hard`,
  `git checkout -- .`) unless the user explicitly asks for that exact action.
  The patch-related commands above (`git clean`, `git stash -u/-a`,
  `git add -A/.`) stay forbidden either way.
- **No Jira writes without explicit confirmation** of the exact content, every
  time. Reads are fine.
- **Monitoring is read-only.** Never push to Loki or change Grafana.
- **No secrets in the repo or in reports.** Mask emails, phones, tokens and
  passwords in any log excerpt or ticket. Machine-local settings go in
  `.claude/settings.local.json` (gitignored).
- **Report honestly.** Never claim a test passed without running it. Show the
  command and its result.

## More detail

- `AGENTS.md`: working agreement for any agent (imported above)
- `.claude/rules/`: `backend.md`, `web.md`, `admin.md`, `testing.md`
- `.claude/skills/`: `unit-test`, `integration-test`, `e2e-test` (writing tests),
  `regression-test` (running the existing suites), `jira` (FOODQA via the
  Atlassian MCP)
- `.claude/settings.json`: registers the `block-bad-tests` hook
  (`.agents/hooks/block-bad-tests.js`), which blocks Write/Edit changes that
  add skipped, disabled, focused, expected-failure or assertion-free tests.
  Shell-tool writes aren't checked
- `.agents/README.md`: tool-neutral assets (scripts, hooks, catalogs) and their planned layout
- `QA-REGRESSION-REPORT.md` and `QA-Evidence/` (index: `QA-Evidence/INDEX.md`):
  results and saved evidence of the completed regression run
- `infra/monitoring/README.md`: monitoring stack and Grafana MCP
