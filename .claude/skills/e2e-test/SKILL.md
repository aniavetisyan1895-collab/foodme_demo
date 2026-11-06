---
name: e2e-test
description: Write and run Playwright end-to-end tests for the FoodMe storefront (apps/web/e2e) and back office (apps/admin/e2e). They drive Chromium against the Vite dev servers and a running backend on :8081 with its Postgres data. Use it when asked to add, extend, debug or run browser tests, UI flow tests or a UI regression test for FoodMe.
---

# E2E tests for FoodMe

Two Playwright suites exist:

| Suite | Specs | Config | Dev server Playwright starts | Backend |
|---|---|---|---|---|
| Storefront | `apps/web/e2e/*.spec.ts`, helpers in `apps/web/e2e/auth.ts` | `apps/web/playwright.config.ts`: Chromium only, `fullyParallel: true`, HTML reporter, `trace: "on-first-retry"`, retries only on CI | `npm run dev -- --port 5180` (reused if already running) | **not started**; must already run on `http://localhost:8081` |
| Back office | `apps/admin/e2e/admin-flows.spec.ts` | `apps/admin/playwright.config.ts`: Chromium only, `fullyParallel: false`, same reporter and trace | `npm run dev -- --port 5174 --strictPort` | same |

Read `CLAUDE.md`, `AGENTS.md`, `.claude/rules/testing.md`, and
`.claude/rules/web.md` or `.claude/rules/admin.md` first. They take precedence
over this skill.

## When to use

- A user-visible flow: explore → chef → cart → checkout → success page,
  account creation, order tracking, admin login, admin order handling.
- A UI regression test for a fixed bug (for example FOODQA-1, cart decrement).
- Checking that a backend change shows up correctly in the UI.

Don't use it for:

- logic you can test without a browser: the `unit-test` skill;
- API status codes, security rules or validation: the `integration-test`
  skill (faster, isolated database);
- intentional workshop behaviour (`SimulatedLatencyConfig`,
  `lib/flakyHeartbeat`, `GET /api/debug/boom`; see `AGENTS.md`).

## Hard rules

1. **Never change production code to make a test pass.** Production code is
   everything under `apps/web/src` and `apps/admin/src` (and the backend). If
   the app is wrong, report it.
2. **Add new spec files; don't edit existing ones without approval.** This
   skill may create new `*.spec.ts` files in `apps/web/e2e/` or
   `apps/admin/e2e/` and change the ones it created in this task. The
   existing specs contain planted flakes (FM-FLAKE-01, FM-FLAKE-05) and known
   issues, so changing them, or `apps/web/e2e/auth.ts`, needs approval. Import
   the helpers from `auth.ts`; don't copy them.
3. **Never fix a seeded `FM-BUG-NN` or "stabilise" an `FM-FLAKE-NN`** unless
   the task names it. If you know before writing that a flow lands on a seeded
   defect (see Step 1), ask first; if a test exposes one unexpectedly, stop
   and ask then. The options that keep the test running are a **loud
   failure** (assert the rule-based result) or Playwright's
   `test.fail()` annotation, which expects the test to fail and reports it if
   it passes. Never use `test.skip()`/`test.fixme()` on your own. If the user
   explicitly asks for a skip, the reason must name the `FM-BUG-NN`,
   `FM-FLAKE-NN` or FOODQA key. The project hook
   `.agents/hooks/block-bad-tests.js` blocks your edits that add
   `test.fail`, `test.skip`, `test.fixme`, `.only`, `xit`/`xdescribe` or a
   test without an assertion, so if the user approves `test.fail()` or a
   skip, they apply that change themselves.
4. **Don't change config or dependencies** (`playwright.config.ts`,
   `package.json`, `vite.config.*`, `tsconfig*`) and don't install anything
   without approval. That includes `npm ci` in `apps/admin` (no
   `node_modules` there by default) and `npx playwright install`.
5. **No fixed waits, no `.only`.** Never `page.waitForTimeout`, never commit
   `test.only`/`describe.only` (`.claude/rules/testing.md`).
6. **Never claim a test passed without running it.** Quote the command and the
   real result. If it couldn't run (backend not reachable, browsers or
   `node_modules` missing), say "not run" and why.
7. **Know where the data goes.** E2E tests write real customers and orders
   into whatever backend `VITE_API_BASE_URL` points at, and nothing cleans
   them up. Against the local backend that is expected. Against a deployed
   environment (Render), ask first. Never save edits to chefs or dishes from
   a test: that changes shared data every other test relies on.
8. Follow `CLAUDE.md` → Safety constraints for git and the patch file. This
   skill never stages, commits or pushes.

## Step 1: Orient

```bash
git branch --show-current     # stop and ask for a feature branch if on main
git status
grep -rn --exclude-dir=node_modules "FM-BUG-\|FM-FLAKE-" apps/web apps/admin
```

Seeded markers and known issues in this area (re-run the grep; don't trust
this list if the code changed):

| Marker | Where | What it means for E2E |
|---|---|---|
| FM-FLAKE-01 | `apps/web/e2e/flake-dish-modal.spec.ts` | `page.waitForTimeout(300)` instead of waiting for the modal. Don't copy it |
| FM-FLAKE-05 | `apps/web/e2e/flake-cart-persistence.spec.ts` | Comment says `FM-FLAKE-05 FIX`: the test waits for the cart row before reloading. Leave it |
| FM-BUG-08 | `apps/admin/src/pages/orders/OrderShow.jsx` | The order note is rendered with `dangerouslySetInnerHTML`. Ask before writing a test for it, and never put a script payload into the shared database |
| FM-BUG-02 | backend, `GET /api/chef/active` drops one chef on the last page | Chef grids show one chef fewer than `count`. `layout.spec.ts` only asserts `>= 4` cards |
| FM-BUG-03 | backend free-delivery threshold | A subtotal exactly at a chef's `freeDeliveryFrom` |
| FM-BUG-07 | `decrementCartItem` in `useCart.ts` | Fixed on `main` (`b2adfa2`, FOODQA-1). A regression test is welcome (see the example) |
| known issue | `apps/web/e2e/layout.spec.ts` | Hardcodes `http://localhost:8081` instead of reading `VITE_API_BASE_URL` (`.claude/rules/testing.md`) |

## Step 2: Know the environment

Verified from the configs, the specs and the app code:

- **What must already be running.** Playwright starts only the Vite dev
  server for the suite you run. The backend must already serve
  `http://localhost:8081` (`./gradlew bootRun` in `apps/backend`, which needs
  Postgres with the `DB_*` defaults from `application.properties`; see
  `CLAUDE.md` → Commands). There is no compose file in the repo. Check the
  backend before running and report "not run: backend not reachable" if it
  isn't:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8081/api/chef/active?page=0&size=1"
  ```

  This is Git Bash syntax. In Windows PowerShell 5.1, `curl` is an alias
  for `Invoke-WebRequest`, so call `curl.exe` with the same arguments.
- **Reused dev servers.** Both configs set `reuseExistingServer` outside CI.
  If a dev server is already listening on 5180 or 5174, Playwright uses it
  as is, including whatever `VITE_API_BASE_URL` it was started with. The web
  config starts Vite without `--strictPort`, so if 5180 is taken by
  something else, Vite moves to another port while Playwright still waits on
  5180. Check what is listening before trusting a result.

- **Base URLs.** Web specs use `baseURL` (`PLAYWRIGHT_BASE_URL`, default
  `http://localhost:5180`), so `page.goto("/explore")` is relative. Admin
  specs use `ADMIN_BASE_URL` (default `http://localhost:5174`) and the hash
  router: `page.goto("/#/orders")`. Specs that call the API directly read it
  as `const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";`.
  Do the same; never hardcode the API URL.
- **Data is the dev database, not `data.sql`.** The backend runs with Flyway
  migrations (`apps/backend/src/main/resources/db/migration/`), so chefs,
  dishes and the admin account come from that seed, plus everything earlier
  test runs created. Don't hardcode chef or dish IDs or names. Discover them
  through the public API, as `happy-path.spec.ts` and `layout.spec.ts` do
  (`GET ${API}/api/chef/active?page=0&size=12`, then `GET ${API}/api/chef/{id}`
  for `dishes`).
- **Simulated latency.** Outside the `test` profile every `/api/**` and
  `/admin/**` call takes 200–1500 ms extra. Wait on conditions only.
- **Isolation.** Each Playwright test gets a fresh browser context, so the
  IndexedDB cart (`FoodMeCart`) and the stored login start empty. The web
  suite runs tests in parallel against one shared backend, so a test must
  never depend on data another test creates or on totals (`No orders yet` is
  only safe for a customer the test just registered).
- **Customer accounts.** Use the helpers in `apps/web/e2e/auth.ts`:
  - `createAccountAtCheckout(page, name?)`: registers a unique customer
    through the checkout's "Create account" tab and waits for
    "Signed in as <name>".
  - `registerCustomerViaApi(request, API)`: registers through
    `POST /api/auth/register` and returns `{ token, email }` for API setup.
- **Admin login.** The existing specs already contain the seeded admin
  credentials: `loginAsAdmin` in `apps/admin/e2e/admin-flows.spec.ts` logs
  in through the UI, and the last test in `apps/web/e2e/happy-path.spec.ts`
  calls `POST /admin/auth/login`. Reuse that handling instead of inventing
  your own:
  - For admin UI flows, prefer adding a test inside `admin-flows.spec.ts`'s
    `Admin resources` group, whose `beforeEach` already calls
    `loginAsAdmin`. That edits an existing spec, so ask first (Hard rules,
    item 2).
  - `loginAsAdmin` isn't exported. Exporting it, or moving it into a shared
    helper file in `apps/admin/e2e/`, also changes an existing file and
    needs approval. If the user prefers a new spec file instead, it follows
    the same credential handling as `loginAsAdmin`.
  - Read the credentials from those specs when you need them. Don't write
    the password into this skill, a report, a ticket, a code comment or a
    commit message, and mask it in any pasted log or trace.
- **Admin data.** Admin specs create their own order through the API first
  (`createOrderViaApi`) and then act on that order only. Do the same: never
  change the status of an order you didn't create, and never save chef or
  dish edit forms.
- **Type checking.** `apps/web/tsconfig.app.json` includes only `src`, so
  `npm run build` doesn't type-check `e2e/*.ts`; Playwright only transpiles
  them. A type error shows up only as a runtime failure.

## Step 3: Design the cases

List the cases before writing code. For each one, write down the expected
result **and its source**: a FOODQA ticket, a written requirement,
`CLAUDE.md`, the README, visible UI text, or the user. The current code is
not a source; if the only source is code, say so or ask.

- **Happy path**, asserting what the user sees: the URL
  (`/orders/success`, `/tracking/FM-…` as a pattern), headings and messages
  ("Order placed!", "Your order number is"), the cart row count.
- **Negative and empty states** that exist in the UI: empty checkout
  ("Your cart is empty"), unknown chef ("Chef not found"), failed order page
  ("Order failed"), admin bad password ("Invalid username or password.").
- **Variants**: delivery vs. takeaway (address fields appear and disappear),
  the payment radios.
- **Regression**: one test per fixed bug or ticket, named after it.

### Unresolved rules: stop and ask

No requirement exists for these. Describe what the app does, ask, and don't
assert a result until the user answers. List them under "Limitations and
assumptions" in the report.

- **Decrease at quantity 1.** The cart passes `min={0}` to the quantity
  control, so "Decrease quantity" stays enabled at 1, and `decrementCartItem`
  then deletes the row. FOODQA-1 only covers 2 → 1.
- **Non-cash payment options.** The checkout offers "Bank card" and "Idram"
  radios, but the order request always sends `paymentType: "CASH"`
  (`src/pages/Checkout/index.tsx`, `src/components/sections/order-delivery-form.tsx`);
  `storefront-flows.spec.ts` asserts "idram checkout still places a cash
  order". `CLAUDE.md` says
  "cash-only checkout". What the user should see when choosing card or
  Idram isn't stated anywhere.
- **Line prices with additions × quantity.** The web cart multiplies
  additions by quantity; the backend adds them once per line.
- **Admin `/backoffice` on the local backend.** The last test in
  `happy-path.spec.ts` opens `${API}/backoffice/#/login`. The backend serves
  the built admin app there only when it was built into the image (see
  `apps/backend/Dockerfile`). Against a backend started with
  `./gradlew bootRun`, `GET /backoffice/` returns 404 and that test fails.
  Classify it as an environment limitation, not an application defect.
  Whether the test should instead target the admin dev server is still
  open; ask before changing it.

## Step 4: Write the tests

**Placement and names.** A new file in `apps/web/e2e/` or `apps/admin/e2e/`
ending in `.spec.ts`, named after the flow (`cart-regression.spec.ts`).
Group with `test.describe("…")`; name tests after the behaviour or the ticket
(`"FOODQA-1: decreasing a cart item from 2 to 1 keeps it in the cart"`).
Don't use a `flake-` prefix; that marks planted flakes.

**Locators** (`.claude/rules/testing.md`), in this order:

1. `getByRole(role, { name })` and `getByLabel(label)`. The app exposes
   stable names the specs already use: buttons "Add to cart", "Place order",
   "Increase quantity", "Decrease quantity", "Remove item",
   "Delivery To your door", "Takeaway Pick up"; links "Go to checkout",
   "Track order", "Order now"; forms "Checkout" and "Create account";
   labels "Full name", "Phone", "Email", "City", "Street", "Building",
   "Apartment"; admin "Username", "Password", "Sign in", menu items
   "Orders", "Chefs", "Dishes".
2. `getByText(text)` with `{ exact: true }` or a precise regex.
3. Some elements have no role or label: the chef card (`a.cc_card`), the dish
   button (`button.dc_card`), the cart panel (`aside.uc-panel`), a cart row
   (`.cic_root`) and the quantity text (`.fm-qty-grp p`). Reuse exactly these
   existing locators; don't invent new CSS selectors. Mention the missing
   accessible name in the report as a testability gap.

Before you rely on a name, open the component and confirm it (the names
above are from the existing specs and `apps/web/src/components/sections`).
Run the test before trusting a new name.

**Waiting.** Use web-first assertions (`await expect(locator).toBeVisible()`,
`toHaveCount`, `toHaveText`, `toHaveURL`) and `expect.poll` for computed
values. Never `waitForTimeout`. Scope locators to a container (the cart
panel, the "Checkout" form) so they stay strict-mode safe.

**Unique data.** Emails come from the helpers or use
`` `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com` ``, the
pattern in `auth.ts`.

**Example** (shape only; it uses only locators and endpoints that exist
today):

```ts
import { test, expect } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

type Dish = { nameEn: string; status: string; minimumOrderCount: number; additions?: unknown[] };

// Source: FOODQA-1. Precondition minimumOrderCount = 1; quantity 2, minus once
// → quantity 1 and the item stays in the cart.
test("FOODQA-1: decreasing a cart item from 2 to 1 keeps it in the cart", async ({
  page,
  request,
}) => {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  let chefId: number | undefined;
  let dishName: string | undefined;
  for (const chef of chefs.exploreChefResponseDtoList) {
    const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
    const dish = (detail.dishes || [])
      .slice(0, 12)
      .find(
        (d: Dish) => d.status === "ACTIVE" && d.minimumOrderCount === 1 && !d.additions?.length,
      );
    if (dish) {
      chefId = chef.id;
      dishName = dish.nameEn;
      break;
    }
  }
  expect(chefId, "no ACTIVE dish with minimumOrderCount 1 and no additions").toBeTruthy();

  await page.goto(`/chef/${chefId}`);
  await page.locator("button.dc_card").filter({ hasText: dishName! }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();

  const cart = page.locator("aside.uc-panel");
  await expect(cart.locator(".cic_root")).toHaveCount(1);

  await cart.getByRole("button", { name: "Increase quantity" }).click();
  await expect(cart.locator(".fm-qty-grp p")).toHaveText("2");

  await cart.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(cart.locator(".cic_root")).toHaveCount(1);
  await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");
});
```

## Step 5: Run and classify

Check first: the backend answers on :8081 (Step 2), and for admin,
`apps/admin/node_modules` exists (otherwise "not run: needs `npm ci`, ask
first").

From `apps/web` (or `apps/admin` for the admin suite), narrowest first:

```bash
npx playwright test e2e/cart-regression.spec.ts            # one file
npx playwright test -g "FOODQA-1"                          # by title
npx playwright test e2e/cart-regression.spec.ts --repeat-each=5 --retries=0   # flakiness check
npm run test:e2e                                           # whole suite for this app
npx playwright show-report                                 # last HTML report
```

`npm run test:e2e:all` in `apps/web` runs the web suite and then the admin
suite (needs admin `node_modules`). Overrides: `PLAYWRIGHT_BASE_URL`,
`ADMIN_BASE_URL`, `VITE_API_BASE_URL`. Traces are recorded only on a retry
(`on-first-retry`), and retries are 0 locally, so to get a trace for a local
failure add `--trace on` to the command.

Classify every failure before you change anything:

| Class | Signs | Action |
|---|---|---|
| **Application defect** | The expectation follows a stated rule or the visible UI text, the app disagrees, reproducibly. | Keep the test. Report it with the screenshot/trace path. If the area has an `FM-BUG-NN` marker, ask how to handle it (Hard rules, item 3). Otherwise offer a FOODQA Bug draft (duplicates first, nothing created without approval). |
| **Test defect** | Wrong locator or name, strict-mode violation (several matches), wrong route, a dependency on data from another test. | Fix the test and say what was wrong. |
| **Environment** | Backend not reachable, port 5180/5174 in use, browsers or `node_modules` missing, `webServer` timeout. | Don't touch code. Report the exact error and what the user needs to start or install. |
| **Flaky** | Fails only sometimes, or only with other tests in parallel, or a known `FM-FLAKE-NN`. | Confirm with `--repeat-each=5 --retries=0`. A new flaky test is a test defect: replace the timing assumption with a condition. A planted flake is reported, not fixed. |

Never "resolve" a failure by editing app code, adding a fixed wait, loosening
an assertion, or skipping the test.

## Step 6: Report

Mask emails, phones, tokens and passwords in anything you paste (traces and
screenshots can contain them too; refer to them by path).

```markdown
## E2E tests: <flow>

**Scope:** <app: web | admin>, <flow>. Layer: E2E (Chromium, dev server, backend on <API base>).
**Branch:** <branch>

### Tests added
| File | Test | Covers (happy / negative / variant / regression) | Source of the expectation |
|---|---|---|---|

### Commands run
| Command | Result |
|---|---|
| `npx playwright test <file>` | exit <code>, <n> passed, <n> failed |
| `npx playwright test <file> --repeat-each=5 --retries=0` | <n>/<n> passed |
(or "not run: <reason>")

### Failures and classification
- <test>: <application defect | test defect | environment | flaky>. <evidence: assertion, expected vs actual, report/trace path>

### Suspected defects
- <FM-BUG-NN or new>: <rule, expected, actual>. Proposed handling: <ask user>.

### Limitations and assumptions
- Unresolved rules asked: <rule>: <answer or "awaiting answer">
- Testability gaps: <elements without an accessible name>
- Data written: <customers/orders created, against which backend>

### Not changed
- No app code, existing specs, auth.ts, config or seeded defects touched. Nothing staged or committed.
- `git status`: <output>
- Patch SHA-256: <value> (unchanged)
```
