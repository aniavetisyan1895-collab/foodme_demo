# QA evidence index

Evidence for the runs described in `QA-REGRESSION-REPORT.md`. Every file below
is a copy of an original file written by the tools during those runs, except
the two files under "Generated at collection time".

- **identical copy**: byte-for-byte copy; source and copy have the same SHA-256.
- **masked copy**: copy in which only matched strings were replaced, nothing
  else:
  - machine-specific locations: the repository path → `<repo>`, the user
    profile path → `%USERPROFILE%`, the agent session's temporary folder →
    `<session-scratchpad>`, the computer name → `<host>`;
  - secrets and personal data: Spring's generated security password →
    `<masked>`, email addresses → `<masked-email>`, Armenian phone numbers
    (`+374…`) → `<masked-phone>`, JWTs → `<masked-jwt>`.

  Test results, exit codes, timestamps and messages are unchanged. Because of
  the replacements, the copy's SHA-256 differs from the source's.
- **excerpt**: the stated line range of a larger log, joined with LF line
  endings and masked the same way.

In `admin-e2e/playwright.admin-chrome.config.ts` the two import paths now read
`<repo>/apps/admin/…`. To run it, replace `<repo>` with the path of your
checkout.

## Backend JUnit (suite 1)

| Evidence file | Source | Kind | Substitutions | SHA-256 of evidence file |
|---|---|---|---|---|
| `QA-Evidence/backend/junit-xml/TEST-am.foodme.backend.ChefControllerTest.xml` | `apps/backend/build/test-results/test/TEST-am.foodme.backend.ChefControllerTest.xml` | masked copy | 3 | `95aaf763c8e64f154efc083590c107d841793bab7c0a891aea9cd4d9d188406a` |
| `QA-Evidence/backend/junit-xml/TEST-am.foodme.backend.CustomerAuthControllerTest.xml` | `apps/backend/build/test-results/test/TEST-am.foodme.backend.CustomerAuthControllerTest.xml` | masked copy | 1 | `036d88a04388ce5726c740a762fe539d938eb5367b834b71698d6fba63f6ac28` |
| `QA-Evidence/backend/junit-xml/TEST-am.foodme.backend.DishControllerTest.xml` | `apps/backend/build/test-results/test/TEST-am.foodme.backend.DishControllerTest.xml` | masked copy | 1 | `bd7922eb48e159945f9ec9f6b6cd7c55943c88349fdb0241438c1691406b7a9d` |
| `QA-Evidence/backend/junit-xml/TEST-am.foodme.backend.OrderControllerTest.xml` | `apps/backend/build/test-results/test/TEST-am.foodme.backend.OrderControllerTest.xml` | masked copy | 1 | `ab192865e97bdc7ddd71f882eadc71b491ce23be5062e02e204c7f5b312b1f3b` |
| `QA-Evidence/backend/html-report/classes/am.foodme.backend.ChefControllerTest.html` | `apps/backend/build/reports/tests/test/classes/am.foodme.backend.ChefControllerTest.html` | masked copy | 2 | `0980ed18efa83f3f1c67627e40ad7e7b6b22b264b8fa913f5e663c462f78a70d` |
| `QA-Evidence/backend/html-report/classes/am.foodme.backend.CustomerAuthControllerTest.html` | `apps/backend/build/reports/tests/test/classes/am.foodme.backend.CustomerAuthControllerTest.html` | identical copy | 0 | `2a0931a97e349d8c6ef7337b1b4604d09df79fc22fd7bef10c249e78ee3eb389` |
| `QA-Evidence/backend/html-report/classes/am.foodme.backend.DishControllerTest.html` | `apps/backend/build/reports/tests/test/classes/am.foodme.backend.DishControllerTest.html` | identical copy | 0 | `fae76fe2bfa839eaf864db242a6889e832cfebd82ae40113454b7b6bd5a9b471` |
| `QA-Evidence/backend/html-report/classes/am.foodme.backend.OrderControllerTest.html` | `apps/backend/build/reports/tests/test/classes/am.foodme.backend.OrderControllerTest.html` | identical copy | 0 | `290700ac52880df2f03f770268214a8b3be18498fd9709f657984a596ab9c3ed` |
| `QA-Evidence/backend/html-report/css/base-style.css` | `apps/backend/build/reports/tests/test/css/base-style.css` | identical copy | 0 | `a10a4ef75ca2601b44bfdaf3112a5854f6376f68d7cbaf6958286f04488d293b` |
| `QA-Evidence/backend/html-report/css/style.css` | `apps/backend/build/reports/tests/test/css/style.css` | identical copy | 0 | `61866908fd7eb09c79e96239f69db2e8cc5c6526cdb308eba0535ed2a0f6a263` |
| `QA-Evidence/backend/html-report/index.html` | `apps/backend/build/reports/tests/test/index.html` | identical copy | 0 | `e4bec3a6f2c4e2194f9e9c4ea52942fb2749b316cbef9e5eeca703b76b6b2d86` |
| `QA-Evidence/backend/html-report/js/report.js` | `apps/backend/build/reports/tests/test/js/report.js` | identical copy | 0 | `fc89c6d002d18f4662065c9887b2cda8f8486f2737d4ad0f2fdeac0ad58a44dc` |
| `QA-Evidence/backend/html-report/packages/am.foodme.backend.html` | `apps/backend/build/reports/tests/test/packages/am.foodme.backend.html` | identical copy | 0 | `6ea765302da446766e26c64b7a575399625801d0f3b93616c5536d849b77e510` |
| `QA-Evidence/backend/gradle-daemon-log-excerpts/01-backend-test-run_lines-151-215.log` | `~/.gradle/daemon/8.6/daemon-2644.out.log` | excerpt, lines 151-215 | 8 | `0fce3d9cac5d3a8c91f0933f981287ecccb1bb8fd0c75d2202a80d2f410a98eb` |
| `QA-Evidence/backend/gradle-daemon-log-excerpts/02-backend-bootRun-startup_lines-4607-4669.log` | `~/.gradle/daemon/8.6/daemon-2644.out.log` | excerpt, lines 4607-4669 | 6 | `76a62d2305f92a87e238b7fb5f04bec680165cc07b8b1abc4ea0c9277c0537b3` |

## Web E2E (suite 3)

| Evidence file | Source | Kind | Substitutions | SHA-256 of evidence file |
|---|---|---|---|---|
| `QA-Evidence/web-e2e/test-results/.last-run.json` | `apps/web/test-results/.last-run.json` | identical copy | 0 | `f62cd2d745bf53d9360843bc0772048f0ecbc48ff29b72d2c16c2f802dc103b9` |
| `QA-Evidence/web-e2e/test-results/happy-path-admin-can-login-163fd-after-a-storefront-checkout-chromium/error-context.md` | `apps/web/test-results/happy-path-admin-can-login-163fd-after-a-storefront-checkout-chromium/error-context.md` | masked copy | 4 | `af2fab14905dced24b2fb0f67e63218388504ae39d7c7fe11badfdc95a9b481b` |
| `QA-Evidence/web-e2e/npm-debug_playwright-test_2026-11-06T15_24_23_458Z.log` | `%LOCALAPPDATA%\npm-cache\_logs\2026-11-06T15_24_23_458Z-debug-0.log` | masked copy | 6 | `d3b0d650390b7058b2c2bf96cd53f9fd540c882356868051db99d444e7a4d7b0` |
| `QA-Evidence/web-e2e/npm-debug_vite-dev-5180_2026-11-06T15_24_25_441Z.log` | `%LOCALAPPDATA%\npm-cache\_logs\2026-11-06T15_24_25_441Z-debug-0.log` | masked copy | 5 | `87a26f5c79e9e18e862b6cee46d50a8b5b580127757b7a0bd6d9f862ed491531` |

## Admin E2E (suite 5)

| Evidence file | Source | Kind | Substitutions | SHA-256 of evidence file |
|---|---|---|---|---|
| `QA-Evidence/admin-e2e/npm-debug_playwright-test_2026-11-06T15_26_40_784Z.log` | `%LOCALAPPDATA%\npm-cache\_logs\2026-11-06T15_26_40_784Z-debug-0.log` | masked copy | 8 | `357ba44dfb23028b746f053354524dfeb5fd178f3b4b707a5a1187f027c36c58` |
| `QA-Evidence/admin-e2e/npm-debug_vite-dev-5174_2026-11-06T15_26_42_561Z.log` | `%LOCALAPPDATA%\npm-cache\_logs\2026-11-06T15_26_42_561Z-debug-0.log` | masked copy | 5 | `56d125b8e1d48fc476d0a55bf0eed4f15ee76832656256d99a96097a28ca4bc1` |
| `QA-Evidence/admin-e2e/playwright.admin-chrome.config.ts` | `<session-scratchpad>/pw-admin-chrome/playwright.admin-chrome.config.ts` | masked copy | 4 | `590c11de5da25ade85b36d09d3ffad957974964b0e3d5563ce3bfa76bedab1e1` |

## Generated at collection time (not produced by the test runs)

| File | What it is | SHA-256 |
|---|---|---|
| `QA-Evidence/environment/environment-capture.txt` | Tool versions, git commit, PostgreSQL install, backend process details, read after the runs | `f7e252dd096117202f692876cd3b53b5684e6934cc9b3bbed6cd3cf308048229` |
| `QA-Evidence/builds/build-output-listing.txt` | Listing of `apps/web/dist` and `apps/admin/dist` (time, size, hash): indirect evidence that the builds completed | `3e6005d4d81fbb80dd8aa92f1303234911c72e59a3a398ae8d97314b6e15cf80` |

## Evidence that does not exist (not fabricated)

| Run | What is missing | Why |
|---|---|---|
| Web lint, web build | Console output | Printed to the terminal only; npm keeps its last 10 debug logs and those runs have rotated out. Only the build output in `apps/web/dist` remains (listed above) |
| Admin `npm ci`, lint, build | Console output and npm debug logs | Same reason |
| Backend JUnit run | Full console output | The Gradle daemon log excerpt (`01-…`) contains the test events and the build result; the console itself wasn't saved |
| Web E2E | `list` reporter console output, HTML report | The `--reporter=list` override replaces the HTML reporter and prints to the console only. Playwright's `.last-run.json` and the failure's `error-context.md` remain |
| Admin E2E | `list` reporter console output, `test-results/` | Console only; all tests passed, so Playwright left no artifacts. The npm debug log records the command and exit code 0 |
| Backend startup | Exact Gradle task name | The daemon log doesn't record the requested task. The process details (main class run from `build/classes`, parent = Gradle daemon) are in `environment-capture.txt` |
