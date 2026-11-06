---
paths:
  - "apps/backend/src/test/**"
  - "apps/web/e2e/**"
  - "apps/admin/e2e/**"
  - "apps/*/playwright.config.ts"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
---

# Test-writing rules

The current inventory and run commands are in `CLAUDE.md` → Testing strategy.

## Every test must

- **Be independent.** No reliance on test order, other tests' data, or
  `@TestMethodOrder`. Create the data you need, with unique values
  (e.g. `Date.now()` / `UUID` in emails).
- **Assert the outcome, not just "it didn't crash".** Check the business result
  (totals, status, list contents), not only `200 OK`, array types or counts that
  come from the DB total.
- **Be deterministic.** No absolute IDs or sequence numbers (e.g. `FM-100001`),
  no assumptions about tie-breaking sort order, no wall-clock date comparisons.
- **Cover negatives and boundaries** where they apply: invalid input, missing
  auth, the wrong role, the value exactly at a threshold, an empty or last page.

## Playwright (`apps/web/e2e`, `apps/admin/e2e`)

- **Locators, in order of preference:**
  1. Accessible-name locators: `getByRole(role, { name })` and `getByLabel(label)`.
     These match what assistive technology sees.
  2. Visible-text locators: `getByText(text)` for content with no suitable
     role or label. Pass `{ exact: true }` or a precise regex, because by
     default it matches substrings case-insensitively. For example,
     `getByText("ACCEPTED")` also matches a "Mark as ACCEPTED" button.

  The existing specs often use CSS classes (`a.cc_card`, `.cic_root`, …).
  Don't add new ones.
- **No fixed waits:** never `page.waitForTimeout`. Wait with web-first
  assertions (`await expect(...).toBeVisible()`, `toHaveCount`, `expect.poll`).
  The backend adds 200–1500 ms of simulated latency outside the `test` profile,
  so waits must be condition-based.
- Reuse helpers in `apps/web/e2e/auth.ts` (`createAccountAtCheckout`,
  `registerCustomerViaApi`) instead of copying flows.
- Read the API base from `process.env.VITE_API_BASE_URL` with the
  `http://localhost:8081` fallback. Don't hardcode it (`layout.spec.ts` does
  today, which is a known issue).
- E2E tests create real customers and orders in the backend database and
  don't clean them up. Never assume an empty database.

## Backend (`apps/backend/src/test`)

- Follow the existing `@SpringBootTest` + MockMvc + `@ActiveProfiles("test")`
  style for HTTP-level tests. The seed data is `src/test/resources/data.sql`.

## Never

- Commit `test.only`, `describe.only`, `it.only`, or `Thread.sleep`.
- Skip or disable a test without a reason that names an `FM-BUG-NN`,
  `FM-FLAKE-NN` or FOODQA key.
- Weaken or delete an assertion to make a test pass. Report the failure instead.
- "Fix" a seeded defect or planted flake while writing tests (see `AGENTS.md`).
- Claim a test passes without running it. JDK 17 is required for backend
  tests, and a running backend on :8081 for E2E.
