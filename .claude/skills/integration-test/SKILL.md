---
name: integration-test
description: Write and run backend integration tests for FoodMe. They boot the full Spring context with the test profile (H2, seed data from data.sql) and call the API over MockMvc, so they cover HTTP status codes, JSON shape, security rules, validation, error responses and persistence across requests. Use it when asked to add or extend API, endpoint, security, auth or controller tests for apps/backend, or a regression test for a backend bug that shows up over HTTP.
---

# Integration tests for FoodMe

FoodMe's integration tests live in `apps/backend/src/test/java/am/foodme/backend/`
(`ChefControllerTest`, `CustomerAuthControllerTest`, `DishControllerTest`,
`OrderControllerTest`). Each one boots the whole application with
`@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")` and
sends real HTTP requests through MockMvc: security filters, JWT parsing,
controllers, services, JPA and the H2 database all run.

Read `CLAUDE.md`, `AGENTS.md`, `.claude/rules/testing.md` and
`.claude/rules/backend.md` first. They take precedence over this skill.

## When to use

Use it for behaviour that only shows up with the Spring context running:

- status codes and JSON response shape (`$.exploreChefResponseDtoList`,
  `$.dishDtoList`, `$.list` / `$.count`, `$.message`);
- security: which endpoints need a token and which role (`SecurityConfig`);
- request validation (`@Valid` on `register`, `login` and `createOrder`) and
  the error body from `GlobalExceptionHandler`;
- flows across requests: register → token → create order → read it back;
- a regression test for a backend defect that is visible over HTTP.

Don't use it for:

- branching or arithmetic inside one class: use the `unit-test` skill (faster,
  no shared database);
- browser behaviour: Playwright E2E (`apps/web/e2e`, `apps/admin/e2e`);
- intentional workshop behaviour (`SimulatedLatencyConfig`,
  `FlakyHeartbeatJob`, `GET /api/debug/boom`, `HttpLoggingFilter`; see
  `AGENTS.md`). The test profile turns latency, the heartbeat job and HTTP
  logging off anyway.

## Hard rules

1. **Never change production code to make a test pass.** Production code is
   everything under `apps/backend/src/main`. If the code is wrong, report it.
   Any change there needs the user's explicit approval for that exact change.
2. **Add new test classes; don't edit existing ones without approval.**
   This skill may create new classes under
   `apps/backend/src/test/java/am/foodme/backend/` and change the ones it
   created in this task. The four existing classes contain planted flakes
   (FM-FLAKE-02/03/04), so adding to, reordering or "cleaning up" them needs
   approval. Don't edit `src/test/resources/data.sql` or
   `application-test.properties` either; they are shared test configuration
   (see item 4).
3. **Never fix a seeded `FM-BUG-NN` or "stabilise" an `FM-FLAKE-NN`** unless
   the task names it. If you know before writing that a case lands on a
   seeded defect (see Step 1), ask the user first; if a test exposes one
   unexpectedly, stop and ask then. In JUnit 5 the only option that keeps the
   test running is a **loud failure**: it asserts the rule-based result and
   fails until the defect is fixed. JUnit 5 has no expected-failure mode.
   `@Disabled` skips the test, so don't propose it, and don't fake an expected
   failure (asserting the defective result, or wrapping the assertion in
   `assertThrows(AssertionError.class)`). If the user explicitly asks for a
   skip, the reason must name the `FM-BUG-NN`, `FM-FLAKE-NN` or FOODQA key.
   The project hook `.agents/hooks/block-bad-tests.js` blocks your edits that
   add `@Disabled`, `@Ignore`, `assume*`, that `assertThrows` trick or a test
   without an assertion, so an approved skip is applied by the user.
4. **Don't change dependencies, build config or test configuration**
   (`build.gradle`, `application-test.properties`, `data.sql`) without
   approval. `spring-boot-starter-test` and `spring-security-test` are already
   declared; nothing else is needed.
5. **Never weaken or delete an assertion**, never use `Thread.sleep`, and
   never skip or disable a test on your own (`.claude/rules/testing.md`).
6. **Never claim a test passed without running it.** Quote the command and the
   real result. If it couldn't run (no JDK 17), say "not run" and why.
7. Follow `CLAUDE.md` → Safety constraints for git and the patch file. This
   skill never stages, commits or pushes.

## Step 1: Orient

```bash
git branch --show-current     # stop and ask for a feature branch if on main
git status
grep -rn --exclude-dir=node_modules "FM-BUG-\|FM-FLAKE-" apps/backend
```

Seeded markers a backend integration test can reach (re-run the grep; don't
trust this list if the code changed):

| Marker | Where | Reached over HTTP by |
|---|---|---|
| FM-BUG-01 | `OrderService.createOrder`, line total cast to `int` | Only a dish with a fractional price triggers it. Prices come from the database, not the request, and all seed prices are whole AMD, so reaching it means changing a dish price with `PUT /admin/dish/{id}` (mutates seed data; ask first) |
| FM-BUG-02 | `ChefService.getActiveChefsPage`, last page trimmed | `GET /api/chef/active` on the last page: `$.count` and the list size disagree |
| FM-BUG-03 | `OrderService.calculateDeliveryPrice`, threshold comparison | `POST /api/order/delivery-price` (public) or a `DELIVERY` order with subtotal exactly at `freeDeliveryFrom` |
| FM-BUG-04 | `CreateOrderDishDto.quantity`, no constraint | `POST /api/order` with quantity `0` or negative |
| FM-BUG-05 | `OrderService.createOrder`, dish lookup | an order for chef 1 containing a dish of chef 2 |
| FM-BUG-06 | `createdAt` in `createOrder` / `OrderDto.mapEntityToDto` | anything that asserts `createdAt` |

Planted flakes in the existing classes: FM-FLAKE-02 (`OrderControllerTest`
assumes the first order is `FM-100001`), FM-FLAKE-03 (`DishControllerTest`
assumes Lavash Wrap comes first, but `DishService` pages
`findByChefIdAndStatus` without a sort), FM-FLAKE-04 (`OrderControllerTest`
compares `createdAt` with today's date). A new test that creates orders can change
which test gets `FM-100001` and so change how FM-FLAKE-02 behaves. Report
that; don't reorder or fix the existing tests.

## Step 2: Know the test environment

Verified from `src/main/resources/application-test.properties`,
`src/test/resources/data.sql` and the security code:

- **One database for the whole run.** H2 in-memory
  (`jdbc:h2:mem:foodme;DB_CLOSE_DELAY=-1;MODE=PostgreSQL`), Hibernate
  `create-drop`, Flyway disabled, `data.sql` loaded once at startup. Every
  class with the same annotations reuses one cached Spring context, so rows
  created by one test are visible to all later tests, in any class. Never
  assume an empty table or a fixed row count, and never rely on test order.
- **Keep the context identical.** Use exactly `@SpringBootTest`,
  `@AutoConfigureMockMvc`, `@ActiveProfiles("test")`. Adding `@MockBean`,
  `@TestPropertySource` or other context-changing annotations builds a second
  context against the same named in-memory database; ask before doing that.
- **Seed data (`data.sql`):**

  | Table | Rows |
  |---|---|
  | chef | 1 `marta-k` ACTIVE, delivery 700, free from 8000; 2 `ararat-grill` ACTIVE, delivery 900, free from 10000; 3 `closed-kitchen` INACTIVE |
  | dish | 1 Lavash Wrap 1800 (chef 1, ACTIVE); 2 Khashlama 4200 (chef 1, ACTIVE); 3 Pork Khorovats 4800 (chef 2, ACTIVE); 4 Inactive Dish 2500 (chef 1, INACTIVE). All `minimum_order_count` 1, no additions |
  | admin | 1 `admin`, role `ADMIN` (password stored only as a hash) |
  | customer, order | none. `order_number_seq` starts at 1 |

  Seed IDs (chef 1, dish 1) are fixed fixture inputs and fine to use, as the
  existing tests do. IDs and order numbers created during the run are not:
  read them from the response.
- **Don't mutate seed rows other tests read.** `PUT /admin/chef/{id}` and
  `PUT /admin/dish/{id}` change shared seed data. For example, deactivating
  chef 1 or 2 changes the `$.count` that `ChefControllerTest` asserts, and
  deactivating dish 1 or 2 changes what `DishControllerTest` asserts. Ask
  before writing such a test. Changing the status of an order the test
  created itself is safe.
- **Security (`SecurityConfig`, `JwtAuthenticationFilter`):**
  - `/api/auth/**` public; `/api/customer/**` and `POST /api/order` need role
    `CUSTOMER`; the rest of `/api/**` is public, including
    `GET /api/order/number/{number}` and `POST /api/order/delivery-price`.
  - `/admin/auth/login` and `GET /admin/dish/**` public; everything else
    under `/admin/**` needs an authenticated user of any role.
  - On a protected endpoint, no token or a token that fails verification →
    `401` (the filter clears the context and `HttpStatusEntryPoint` answers
    401). On a public endpoint a bad token is ignored and the request goes
    through anonymously, so "bad token → 401" tests only make sense on
    protected endpoints.
  - The token is `Authorization: Bearer <jwt>`; the `role` claim becomes
    `ROLE_<role>`. Tokens have no expiry (`JwtService` sets none).
- **Getting tokens.**
  - Customer: register through `POST /api/auth/register` with a unique email
    and read `$.token`, as `CustomerAuthControllerTest` and
    `OrderControllerTest` do. Don't mint customer tokens with `JwtService`:
    `/api/customer/**` and `POST /api/order` look the customer up by the
    token's subject (the email), so a token for an unregistered email passes
    security and then fails with `404 "Customer not found"`.
  - Admin: the seeded admin credentials already exist in the E2E specs
    (`loginAsAdmin` in `apps/admin/e2e/admin-flows.spec.ts`, the admin login
    in `apps/web/e2e/happy-path.spec.ts`), and `data.sql` stores the same
    password hash as the Flyway seed. Don't copy the password into a new
    test class, this skill, a report or a ticket. For a token, autowire
    `JwtService` and call `jwtService.generateToken("admin", "ADMIN")`. It
    signs with the test profile's secret, which is what the filter verifies,
    so no password is needed. Only a test of `POST /admin/auth/login`
    itself needs the real credentials; ask first, and follow the E2E specs'
    handling (`e2e-test` skill, Step 2, "Admin login").
  - `spring-security-test` is on the classpath, but a real token also
    exercises `JwtAuthenticationFilter`, so prefer it.
- **Error body (`GlobalExceptionHandler` → `ErrorResponseDto`):** `status`,
  `error`, `message`, `path`, `timestamp`, and `trace` for 500s.
  `BadRequestException` → 400, `NotFoundException` → 404, failed `@Valid` →
  400 with the **first** field error's message, an unknown `/api/**` or
  `/admin/**` path → 404 `"Not found"` (`SpaWebConfig` never serves the SPA
  shell there), anything else → 500. The handler doesn't extend
  `ResponseEntityExceptionHandler`, and its `@ExceptionHandler(Exception.class)`
  catch-all is expected to turn malformed JSON, a missing required parameter
  (`GET /api/chef` without `username`), a wrong type (`GET /api/chef/abc`) or
  an unsupported HTTP method into `500` with a stack trace, not Spring's
  usual `400`/`405`. That is code
  behaviour with no stated requirement: run it, report the actual status,
  and don't assert `400` or `500` until the user decides (see "Unresolved
  rules").
- **Validation constraints exist only on** `CustomerRegisterRequestDto`
  (`fullName` 2–120, `email`, `phoneNumber` 8–32, `password` 8–72, all
  `@NotBlank`), `CustomerLoginRequestDto` (`email`, `password`) and
  `CreateOrderDishAdditionDto` (`additionId` `@NotNull`). `OrderDto` and
  `CreateOrderDishDto` declare none, and their list fields carry no `@Valid`,
  so the `CreateOrderDishAdditionDto` constraint isn't checked when an order
  is posted. In practice, request validation over HTTP covers register and
  login only.

## Step 3: Design the cases

List the cases before writing code. For each one, write down the expected
result **and its source**: a FOODQA ticket, a written requirement, `CLAUDE.md`,
`.claude/rules/backend.md`, the README, UI text, or the user. The current code
is not a source. If the only source is code, say so in the report or ask.

Cover, where they apply:

- **Happy path**, asserting the business result, not just `200`: the returned
  fields, and a follow-up read that proves persistence (create an order, then
  find it in `GET /api/customer/orders`).
- **Auth and roles**: no token → 401; invalid token → 401; wrong role.
  Wrong-role cases with a valid token are decided by Spring Security's
  access-denied handling; run the test and report the actual status before
  you treat it as a finding.
- **Validation**: one invalid field per request. `GlobalExceptionHandler`
  returns only the first field error, and with several invalid fields which
  one comes first isn't defined. The constraints use default validator
  messages, which depend on the JVM locale, so assert `400` and that
  `$.message` exists rather than the exact default text. Messages the code
  sets explicitly are stable and can be asserted: `"Email already
  registered"`, `"Invalid email or password"` (customer login uses it for
  both an unknown email and a wrong password), `"Only CASH payment is
  supported"`, and for admin login `"Unknown username: <name>"` and
  `"Incorrect password"`. Admin login with username `admin` and any wrong
  password reaches `"Incorrect password"` without knowing the real one.
- **Not found**: an unknown chef, dish or order ID gives `404` with the ID in
  `$.message` (`"Chef 999 not found"`, `"Dish 999 not found"`,
  `"Order 999 not found"`; an unknown order number gives
  `"Order <number> not found"`). Public: `GET /api/chef/{id}`,
  `GET /api/dish/{id}`, `GET /api/order/number/{number}`. `GET /admin/order/{id}`
  and `GET /admin/chef/{id}` need a token. Pick an ID far outside the seed
  range.
- **Boundaries**: pagination (`page`, `size`; the last page of
  `GET /api/chef/active` lands on FM-BUG-02) and the free-delivery threshold
  (FM-BUG-03). Ask before writing either (Hard rules, item 3).

### Unresolved rules: stop and ask

No requirement exists for these. Describe what the code does, ask the user,
and don't assert a result until they answer. List them under "Limitations
and assumptions" in the report. If the user wants one tracked, offer a FOODQA
draft (search for duplicates first; create nothing without approval of the
exact draft).

- **Any authenticated role is accepted on `/admin/**`**, including a
  `CUSTOMER` token. `SecurityConfig` uses `.authenticated()` there and no
  admin controller checks roles. It isn't marked as a seeded defect, and no
  requirement says whether it's intended.
- **Admin order status transitions** (`NEW` → `ACCEPTED`/`REJECTED`,
  `ACCEPTED` → `DELIVERED`/`REJECTED`) exist only in
  `AdminOrderService.ALLOWED_TRANSITIONS`.
- **Initial order status `NEW`** and the order number format
  `"FM-" + (100000 + sequence)` exist only in code. Never assert a specific
  number; the sequence is shared across the run.
- **Additions × quantity**: the backend adds each addition's price once per
  line; the web cart multiplies it by quantity.
- **`DELIVERY` without an address** is saved without one.
- **Ordering from an inactive chef or an inactive dish** is accepted:
  `createOrder` doesn't check chef or dish status (seed chef 3 and dish 4
  are INACTIVE).
- **`GET /api/order/number/{number}` is public** and returns the order with
  the receiver's name, phone and email, with no ownership check.
- **Malformed requests return 500** (catch-all handler, see Step 2), not
  400.

## Step 4: Write the tests

**Placement and names.** A new class in `am.foodme.backend`, named after the
area it covers and ending in `ControllerTest`, e.g.
`apps/backend/src/test/java/am/foodme/backend/OrderAuthorizationControllerTest.java`.
Methods: `endpointOrAction_condition_expectedResult`.

**Style.**

- Copy the existing setup: the three annotations, `@Autowired MockMvc`, and
  `@Autowired ObjectMapper` for request bodies and reading responses.
- Build bodies with `objectMapper.writeValueAsString(Map.of(...))`, using the
  real field names (`chefId`, `paymentType`, `deliveryMethod`,
  `createOrderDishes: [{dishId, quantity}]`; see the API contract in
  `AGENTS.md`).
- Make every test create its own customer with a unique email
  (`"it-" + UUID.randomUUID() + "@example.com"`). Never share mutable state
  through fields or static variables (autowired beans are fine), and never
  use `@TestMethodOrder`.
- Assert with `status()` and `jsonPath(...)`. To use a value from one response
  in the next request, read it with `objectMapper.readTree(...)`.
- Assert values the test controls or the seed fixes (`$.customer.email`,
  `$.message`, chef 1's `username`). Don't assert totals that depend on other
  tests (`$.count` of `/admin/order`), generated IDs, order numbers or exact
  timestamps.
- Keep helpers private to the new class. Don't move helpers out of the
  existing classes.

**Example skeleton** (shape only; check field names and paths against the
code before you copy it):

```java
package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderAuthorizationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // Source: .claude/rules/backend.md, "POST /api/order (role CUSTOMER)".
    @Test
    void createOrder_invalidToken_unauthorized() throws Exception {
        mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer not-a-valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashTakeawayOrder()))
                .andExpect(status().isUnauthorized());
    }

    // Seed chef 1 and its ACTIVE dish 1 (data.sql).
    private String cashTakeawayOrder() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        ));
    }
}
```

For a customer token, copy the register-and-read-`token` pattern from
`CustomerAuthControllerTest.meAndOrders_requireCustomerToken` into a private
helper of the new class.

**Wrong role on `POST /api/order`: status unverified.** The rule that the
endpoint needs role `CUSTOMER` is documented (`.claude/rules/backend.md`),
but the status for a valid token with another role (for example an ADMIN
token from `jwtService.generateToken("admin", "ADMIN")`) isn't fixed by
FoodMe code. `SecurityConfig` sets only an authentication entry point (401)
and no access-denied handler, so the answer comes from Spring Security's
defaults, and no existing test has run it. Don't assert `403` (or `401`)
until it has been observed. To verify it: write the test asserting only the
documented rule's effect, that the request is rejected
(`status().is4xxClientError()`), run it, read the actual status from the
output or
`build/reports/tests/test/index.html`, and report it. Only after the user
accepts that status as expected, tighten the assertion.

## Step 5: Run and classify

From `apps/backend` (on Windows PowerShell use `.\gradlew.bat`), narrowest
first:

```bash
java -version                                   # must be 17
./gradlew test --tests 'am.foodme.backend.OrderAuthorizationControllerTest.createOrder_invalidToken_unauthorized'
./gradlew test --tests 'am.foodme.backend.OrderAuthorizationControllerTest'
./gradlew test                                  # full suite: all four existing classes plus yours
```

Gradle skips a `test` task whose inputs haven't changed: running the same
command twice prints `UP-TO-DATE` and runs nothing. To rerun without code
changes, add `--rerun-tasks`, e.g.
`./gradlew test --rerun-tasks --tests 'am.foodme.backend.OrderAuthorizationControllerTest'`.
A result line marked `UP-TO-DATE` is not a test run; don't report it as one.

The HTML report is `apps/backend/build/reports/tests/test/index.html`. Always
finish with the full suite, because your test shares the database with the
others: a test that passes alone and fails in the suite (or makes another
class fail) depends on shared state.

Classify every failure before you change anything:

| Class | Signs | Action |
|---|---|---|
| **Application defect** | The expectation follows a stated rule and the API disagrees, reproducibly. | Keep the test. Report it. If the area has an `FM-BUG-NN` marker, ask how to handle it (Hard rules, item 3). Otherwise offer a FOODQA Bug draft (duplicates first, nothing created without approval). |
| **Test defect** | Wrong path, field name, role, expected status, or a dependency on data another test created. | Fix the test and say what was wrong. |
| **Environment** | No JDK 17, Gradle download blocked, context fails to start for reasons unrelated to your test. | Don't touch code. Report the exact error. |
| **Flaky** | Passes and fails on reruns, or depends on order or shared data. Or a known `FM-FLAKE-NN`. | Rerun the single test 3–5 times with `--rerun-tasks` (see below). A new flaky test is a test defect: remove the shared-state dependency. A planted flake is reported, not fixed. |

Never "resolve" a failure by editing production code, seed data or test
configuration, loosening an assertion, or skipping the test.

## Step 6: Report

Mask emails, phones, tokens and passwords in anything you paste (JWTs in
headers and `$.token` included).

```markdown
## Integration tests: <area / endpoints>

**Scope:** <endpoints>, apps/backend. Layer: integration (Spring context, MockMvc, H2).
**Branch:** <branch>

### Tests added
| File | Test | Covers (happy / auth / validation / not found / boundary / regression) | Source of the expectation |
|---|---|---|---|

### Commands run
| Command | Result |
|---|---|
| `./gradlew test --tests '<class>'` | exit <code>, <n> passed, <n> failed |
| `./gradlew test` | exit <code>, <n> passed, <n> failed (<known FM-FLAKE-NN, if any>) |
(or "not run: <reason>")

### Failures and classification
- <test>: <application defect | test defect | environment | flaky>. <evidence: expected vs actual, masked response excerpt>

### Suspected defects
- <FM-BUG-NN or new>: <rule, expected, actual>. Proposed handling: <ask user>.

### Limitations and assumptions
- Unresolved rules asked: <rule>: <answer or "awaiting answer">
- Expectations based only on code: <case>

### Not changed
- No production code, existing test classes, data.sql, test configuration or seeded defects touched. Nothing staged or committed.
- `git status`: <output>
- Patch SHA-256: <value> (unchanged)
```
