---
name: unit-test
description: Write and run unit tests for FoodMe code. Backend services, DTO mappers and security helpers use JUnit 5, Mockito and AssertJ without a Spring context. Web and admin logic (zod schemas, utils, cart helpers, data provider) needs Vitest, which isn't installed yet, so this skill reports the gap and proposes a setup instead of installing it. Use it when asked to unit-test, add test coverage for, or write regression tests for a specific FoodMe class, function, schema or bug.
---

# Unit tests for FoodMe

Unit tests in FoodMe are a new layer. Today the repo has backend integration
tests (`@SpringBootTest` + MockMvc + H2) and Playwright E2E. It has no backend
unit tests and no frontend unit-test runner. This skill adds tests below those
layers. It doesn't replace them.

Read `CLAUDE.md`, `AGENTS.md`, `.claude/rules/testing.md` and the rule file for
the app you're touching (`backend.md`, `web.md`, `admin.md`). They take
precedence over this skill.

## When to use

Use it when the user asks you to:

- unit-test a named backend class or method (`OrderService.calculateDeliveryPrice`,
  `ChefService.getActiveChefsPage`, `OrderDto.mapEntityToDto`, `JwtService`, …);
- unit-test a frontend module (`apps/web/src/lib/utils.ts`, `src/schemas/*`,
  `src/hooks/useCart.ts` helpers, `apps/admin/src/providers/dataProvider.js`);
- write a regression test for a fixed bug or a FOODQA ticket;
- review or extend unit-test coverage for a change.

Don't use it for:

- HTTP-level checks (status codes, security matchers, JSON shape over MockMvc).
  Those are integration tests and follow the existing `*ControllerTest` style.
- Browser flows. Those are Playwright E2E (`apps/web/e2e`, `apps/admin/e2e`).
- Testing intentional workshop behaviour as if it were a defect:
  `SimulatedLatencyConfig`, `FlakyHeartbeatJob`, `lib/flakyHeartbeat`,
  `GET /api/debug/boom`, `HttpLoggingFilter` (see `AGENTS.md`).

If the right layer isn't unit, say so and suggest which one is.

## Hard rules

1. **Never change production code to make a test pass.** If a test fails
   because the code is wrong, report it. Production code is everything under
   `apps/backend/src/main`, and everything under `apps/web/src` and
   `apps/admin/src` except unit-test files. This skill may create new
   unit-test files and change the ones it created in this task:
   `*.test.ts`, `*.test.tsx`, `*.test.js` and `*.test.jsx` in `apps/web` and
   `apps/admin`, and new test classes under `apps/backend/src/test/java/`.
   Changing existing test files (the `*ControllerTest` classes, Playwright
   specs) needs approval, because they contain planted flakes. Any change to
   production code needs the user's explicit approval for that exact change.
2. **Never fix a seeded `FM-BUG-NN` or "stabilise" an `FM-FLAKE-NN`** unless
   the task names it. A new test that exposes a seeded defect is a valid
   finding. If you know before writing that a case lands on a seeded defect
   (see the Step 1 table), ask the user first; if a test exposes one
   unexpectedly, stop and ask then. Don't disable or skip the test on your
   own. The options that keep the test running are:
   - **Loud failure** (JUnit 5 and Vitest): the test asserts the expected
     result from the business rule and fails until the defect is fixed. The
     report names the marker. In Java this is the only option.
   - **Expected failure** (Vitest only): declare the test with Vitest's
     `test.fails` and start its title with the marker key, for example
     `FM-BUG-03`. Vitest runs the test and reports it as passing only while
     its assertion fails, so it starts failing once the defect is fixed.

   JUnit 5 has no expected-failure mode. `@Disabled` skips execution: the
   test doesn't run, so it can't show whether the defect is still there, and
   it isn't an expected-failure test. Don't propose it. Don't fake an
   expected failure in Java either, for example by asserting the defective
   result or by wrapping the correct assertion in an
   `assertThrows(AssertionError.class)` call. If the user explicitly asks for
   a skip, the reason must name the `FM-BUG-NN`, `FM-FLAKE-NN` or FOODQA key
   (`.claude/rules/testing.md`). The project hook
   `.agents/hooks/block-bad-tests.js` blocks your edits that add a skip,
   `@Disabled`, `test.fails`, `.only` or a test without an assertion, so if
   the user approves the expected-failure option or a skip, they apply that
   change themselves.
3. **Don't install dependencies or change build config** (`build.gradle`,
   `package.json`, `vite.config.*`, `tsconfig*`) without approval. The same
   applies to new test infrastructure files such as `vitest.config.*` and
   `vitest.setup.ts`: create them only after the user explicitly approves
   them. For the frontend, describe the gap and propose a setup (see Step 3b).
4. **Never weaken or delete an assertion** to get to green. Never use
   `Thread.sleep`, fixed waits or `.only`. Never skip or disable a test
   (`@Disabled`, `test.skip`, `it.skip`) on your own; see item 2.
5. **Never claim a test passed without running it.** Quote the command and its
   real output. If it couldn't run (no JDK, no `node_modules`), say "not run"
   and give the reason.
6. Follow the git and patch rules in `CLAUDE.md` → Safety constraints. This
   skill never stages, commits or pushes.

## Step 1: Orient

```bash
git branch --show-current     # stop and ask for a feature branch if on main
git status
grep -rn --exclude-dir=node_modules "FM-BUG-\|FM-FLAKE-" apps
```

Note any `FM-BUG-NN` / `FM-FLAKE-NN` markers inside or near the target code
before you design the tests. Current markers at the time of writing:

| Marker | Location | What a unit test there would touch |
|---|---|---|
| FM-BUG-01 | `OrderService.createOrder`, subtotal line | Line-total arithmetic (cast to `int`) |
| FM-BUG-02 | `ChefService.getActiveChefsPage` | Last-page content trimming |
| FM-BUG-03 | `OrderService.calculateDeliveryPrice` | Free-delivery threshold comparison |
| FM-BUG-04 | `CreateOrderDishDto.quantity` | Quantity validation |
| FM-BUG-05 | `OrderService.createOrder`, dish lookup | Dish ↔ chef consistency |
| FM-BUG-06 | `OrderService.createOrder` / `OrderDto.mapEntityToDto` | `createdAt` handling |
| FM-BUG-08 | `apps/admin/src/pages/orders/OrderShow.jsx` | Admin order detail |

Re-run the grep. Don't trust this table if the code has changed. FM-BUG-07
(cart decrement, `decrementCartItem` in `useCart.ts`) is fixed on `main`
(`b2adfa2`, FOODQA-1), so a regression test for it is welcome (see Step 3b
for what FOODQA-1 confirms).

## Step 2: Analyse the target and pick the boundary

Read the target source and its direct collaborators. Then decide:

- **Unit under test.** A single public method or function, with behaviour you
  can describe in one sentence.
- **What to fake.** Only what crosses a boundary: repositories, IndexedDB,
  the web `apiClient` (`src/api/client.ts`) and the admin `api` wrapper
  (`src/api/base-api.js`). Use a real `SimpleMeterRegistry` for
  `MeterRegistry`. Pure helpers, DTOs and entities stay real.
- **Secrets.** `JwtService` has no clock; build it with a fixed issuer and an
  obviously fake secret such as `"unit-test-secret-not-real"`. Never copy the
  real FoodMe secret into a test: not the `foodme.jwt.secret` value from any
  `application*.properties`, and not a value set in a deployed environment.
- **What to assert.** The observable result (return value, thrown exception
  and message, the entity passed to `save`, the stored cart row). Don't assert
  the internal call sequence when the result shows the behaviour.

FoodMe units, roughly from best to worst fit:

| Target | Kind | Fakes needed |
|---|---|---|
| `OrderService.calculateDeliveryPrice` | Pure branching on chef data. Threshold tests land on FM-BUG-03 | `ChefRepository` |
| `OrderService.createOrder` | Totals, payment rule, address, number | `Customer`/`Chef`/`Dish`/`OrderRepository`, `MeterRegistry` |
| `OrderService.listForCustomer` | Page and size clamping (`max(page,0)`, `1..50`) | `CustomerRepository`, `OrderRepository` |
| `ChefService.getActiveChefsPage` / `toExploreDtoWithDishes` | Paging, dish sort by tag priority then `priorityIndex`. Last-page tests of `getActiveChefsPage` land on FM-BUG-02 | `ChefRepository`, `DishRepository`, `ChefTagOrderRepository` |
| DTO `mapEntityToDto` / `mapDtoToEntity` (e.g. `OrderDto`, `AddressDto`) | Pure mapping, null handling | none |
| `JwtService` | Token round-trip (subject, `role` claim, issuer); a token signed with another secret, with another issuer, or tampered with is rejected. It sets no expiry and has no clock, so there are no expiry tests | none; `new JwtService(secret, issuer)` |
| `apps/web/src/lib/utils.ts` (`formatAmd`, `translate`, `sameLabel`) | Pure functions | none |
| `apps/web/src/schemas/checkout-schema.ts`, `auth-schema.ts` | zod validation | none |
| `apps/web/src/hooks/useCart.ts` helpers (`addDishToCart`, `decrementCartItem`, …) | Dexie cart logic | in-memory IndexedDB (`fake-indexeddb`) |
| `apps/admin/src/providers/dataProvider.js` | Maps react-admin calls to `api.get`/`api.put` on `/order`, `/chef`, `/dish`; `page - 1`; `{list, count}` → `{data, total}`; unsupported methods throw | mock the default export of `src/api/base-api.js` |

Controllers, `SecurityConfig` and JPA queries aren't unit targets. Their
behaviour depends on the Spring context, so leave them to the MockMvc
integration tests.

## Step 3a: Backend (Java 17, Spring Boot 3.3)

**What's available.** `build.gradle` declares
`testImplementation 'org.springframework.boot:spring-boot-starter-test'`.
That starter brings JUnit 5 (Jupiter), Mockito (`mockito-core`,
`mockito-junit-jupiter`), AssertJ, Hamcrest, JSONassert and JsonPath. No extra
dependency is needed. The existing tests use only JUnit `assertTrue` and
MockMvc matchers. AssertJ and Mockito are available but not used yet.

**Placement.** Put the test in a package that mirrors the class under test, so
package-private members are reachable:
`apps/backend/src/test/java/am/foodme/backend/service/OrderServiceTest.java`.

**Style.**

- No `@SpringBootTest`, no `@ActiveProfiles`, no H2. A unit test must not
  start the Spring context. That keeps it fast, and it can't see the shared
  H2 data that the integration tests leave behind.
- Use `@ExtendWith(MockitoExtension.class)` with `@Mock` for repositories and
  build the service by hand through its constructor. FoodMe services use
  constructor injection. Prefer an explicit `new OrderService(...)` in
  `@BeforeEach` over `@InjectMocks`, so a new constructor parameter fails to
  compile instead of passing `null`. `MockitoExtension` uses strict stubs:
  stub inside each test, not in `@BeforeEach`, or an unused stub fails with
  `UnnecessaryStubbingException`.
- For `MeterRegistry`, use a real `new SimpleMeterRegistry()`
  (`io.micrometer.core.instrument.simple`, on the classpath through
  Actuator). Then you can assert `registry.counter("foodme.orders").count()`
  instead of verifying a mock.
- Build entities with their Lombok setters in small private factory methods
  (`chef(id, deliveryPrice, freeDeliveryFrom)`, `dish(id, price)`). Don't rely
  on `data.sql` IDs.
- Assert with AssertJ: `assertThat(...)`, `assertThatThrownBy(...)
  .isInstanceOf(BadRequestException.class).hasMessageContaining("CASH")`.
  Compare doubles with `isCloseTo(x, within(0.001))`.
- Unstubbed Mockito mocks return `Optional.empty()` for `Optional`, empty
  collections for `List`, `0` for primitives and `null` for other objects
  such as `Order` or `Page`. Stub what the method under test reads:
  - A successful `createOrder` reads `customerRepository.findByEmail` (with
    the email trimmed and lower-cased), `chefRepository.findById` (twice for
    `DELIVERY`), `dishRepository.findById` per item, and the result of
    `orderRepository.save`. Stub `save` to return its argument:
    `when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0))`.
    Then use `ArgumentCaptor<Order>` on `save` to check the order that was
    built against the expectations from Step 4 (total, delivery price,
    address).
  - `listForCustomer` reads `customerRepository.findByEmail(String)`
    (`Optional<Customer>`) and then
    `orderRepository.findByCustomerIdOrderByCreatedAtDesc(Long, Pageable)`
    (`Page<Order>`). Return a `PageImpl`; its
    `(List<T> content, Pageable pageable, long total)` constructor is already
    used in `DishSearchRepositoryImpl`. Shape only; the clamping expectation
    itself is code behaviour (see Step 4):

    ```java
    Customer customer = new Customer();
    customer.setId(5L);
    when(customerRepository.findByEmail("c@example.com")).thenReturn(Optional.of(customer));
    when(orderRepository.findByCustomerIdOrderByCreatedAtDesc(eq(5L), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

    service.listForCustomer("c@example.com", -1, 51);

    ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
    verify(orderRepository).findByCustomerIdOrderByCreatedAtDesc(eq(5L), pageable.capture());
    ```

    In addition to the skeleton's imports below, this needs
    `am.foodme.backend.model.Customer`, `org.mockito.ArgumentCaptor`,
    `org.springframework.data.domain.PageImpl`,
    `org.springframework.data.domain.PageRequest`,
    `org.springframework.data.domain.Pageable` and
    `static org.mockito.ArgumentMatchers.eq`.
- **Order number.** `createOrder` builds it from
  `nextOrderNumberSequenceValue()` (an unstubbed mock returns `0`). Assert an
  exact number such as `"FM-100007"` only when both are true: the test stubs
  the sequence value (here `7L`), and the user or a requirement has
  confirmed the formula `"FM-" + (100000 + sequence)`. Otherwise don't
  assert the number; list it under "Limitations and assumptions". Never
  assert a real database sequence value (`.claude/rules/testing.md`).
- **`JwtService` rejections.** `verify` throws from the `com.auth0:java-jwt`
  library (3.18.3 in `build.gradle`). Assert that it throws; check the
  library's exception class before you assert a specific type.
- Use `verify(...)` only when the interaction *is* the behaviour, e.g.
  `verify(orderRepository, never()).save(any())` after a rejected payment type.
- Don't use `@TestMethodOrder`. `OrderControllerTest` uses it today, together
  with planted flakes. Don't copy that pattern.
- `LocalDateTime.now()` in `createOrder` isn't injectable. Don't assert an
  exact `createdAt`; at most assert it isn't null. If a time assertion is
  essential, report that the code needs a `Clock` and ask. Don't add one.

**Example skeleton** (shape only, adapt it to the real code):

```java
package am.foodme.backend.service;

import am.foodme.backend.dto.DeliveryPriceRequestDto;
import am.foodme.backend.dto.DeliveryPriceResponseDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.DishRepository;
import am.foodme.backend.repository.OrderRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock ChefRepository chefRepository;
    @Mock DishRepository dishRepository;
    @Mock CustomerRepository customerRepository;
    SimpleMeterRegistry meterRegistry;
    OrderService service;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        service = new OrderService(orderRepository, chefRepository,
                dishRepository, customerRepository, meterRegistry);
    }

    // Source: TAKEAWAY has no delivery fee in the backend and in the web
    // checkout (Checkout/index.tsx). Consistent in both, no requirement document.
    @Test
    void calculateDeliveryPrice_takeaway_isFreeRegardlessOfSubtotal() {
        // Arrange
        when(chefRepository.findById(1L)).thenReturn(Optional.of(chef(1L, 1000.0, 5000.0)));
        var request = new DeliveryPriceRequestDto(1L, 100.0, "TAKEAWAY");

        // Act
        DeliveryPriceResponseDto result = service.calculateDeliveryPrice(request);

        // Assert
        assertThat(result.getDeliveryPrice()).isZero();
    }

    // Source: CLAUDE.md, "cash-only checkout".
    @Test
    void createOrder_nonCashPayment_rejectedWithoutSaving() {
        // Arrange
        OrderDto dto = cashOrder();
        dto.setPaymentType("CARD");

        // Act + Assert
        assertThatThrownBy(() -> service.createOrder(dto, "c@example.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("CASH");
        verify(orderRepository, never()).save(any());
    }

    // Minimal CASH TAKEAWAY order. createOrderDishes is a placeholder: the
    // payment check runs first, so these tests never reach it.
    private static OrderDto cashOrder() {
        OrderDto dto = new OrderDto();
        dto.setChefId(1L);
        dto.setPaymentType("CASH");
        dto.setDeliveryMethod("TAKEAWAY");
        dto.setCreateOrderDishes(List.of());
        return dto;
    }

    private static Chef chef(Long id, Double deliveryPrice, Double freeDeliveryFrom) {
        Chef chef = new Chef();
        chef.setId(id);
        chef.setDeliveryPrice(deliveryPrice);
        chef.setFreeDeliveryFrom(freeDeliveryFrom);
        return chef;
    }
}
```

Check the real constructor signatures and getter names of the DTOs before you
write the test. Don't guess them from this example.

**Run, narrowest first** (from `apps/backend`. On Windows PowerShell use
`.\gradlew.bat`):

```bash
./gradlew test --tests 'am.foodme.backend.service.OrderServiceTest.calculateDeliveryPrice_takeaway_isFreeRegardlessOfSubtotal'
./gradlew test --tests 'am.foodme.backend.service.OrderServiceTest'
./gradlew test        # full backend suite, includes the MockMvc integration tests
```

JDK 17 must be on `JAVA_HOME`. Check it first (`java -version`). If it's
missing, say the tests weren't run. The full suite contains planted flakes
(FM-FLAKE-02/03/04). If they fail, classify them, don't fix them.

## Step 3b: Frontend (`apps/web` TS, `apps/admin` JS)

**Check before you write anything:**

```bash
# from apps/web or apps/admin
grep -nE '"(vitest|@vitest/[^"]+|jsdom|happy-dom|@testing-library/[^"]+|fake-indexeddb|msw)"' package.json
grep -n '"test' package.json
ls node_modules >/dev/null 2>&1 || echo "node_modules missing: run npm ci (ask first)"
grep -n "test:" vite.config.* 2>/dev/null
```

At the time of writing, **neither app has a unit-test runner.** `apps/web`
has only Playwright, oxlint and Vite 8. `apps/admin` has only Playwright,
eslint and Vite 6, and no `node_modules`. If that's still true, don't write
test files that can't run. Instead, report the gap and propose the smallest
setup that fits the target:

| Target | Minimal additions (devDependencies) | Config |
|---|---|---|
| Pure functions (`lib/utils.ts`), zod schemas | `vitest` | `test.environment: "node"`; `test.include: ["src/**/*.test.{ts,tsx}"]` so Playwright's `e2e/*.spec.ts` isn't picked up |
| `useCart.ts` helpers (Dexie) | `vitest`, `fake-indexeddb` | `import "fake-indexeddb/auto"` must run before `@/lib/db` creates the Dexie instance. By default, make it the first import of the test file. A setup file (`apps/web/vitest.setup.ts`, outside `src`, containing only that import, listed in `test.setupFiles`) is a test infrastructure change: include it in the setup proposal and create it only after explicit approval (Hard rules, item 3) |
| React components or hooks | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` (+ `@testing-library/jest-dom`) | `test.environment: "jsdom"` |
| `apps/admin` `src/providers/dataProvider.js` | `vitest` | `test.environment: "node"`; `test.include: ["src/**/*.test.{js,jsx}"]` so Playwright's `e2e/*.spec.ts` isn't picked up |

Notes for the proposal:

- Both apps get a `"test:unit": "vitest run"` script in `package.json`.
- Pick a Vitest major whose `vite` peer range covers the app's Vite version
  (web: Vite 8, admin: Vite 6). Check with a read-only `npm view vitest
  peerDependencies` or the release notes, and say which version you checked.
  The repository doesn't establish which Vitest versions support Vite 8 or
  Vite 6. Don't name a version from memory; until you've checked, report
  compatibility as unverified. Also confirm that the chosen version provides
  the `vitest/config` types and `mergeConfig` used below.
- Reuse the `@/` alias instead of duplicating it. In `apps/web`,
  `vite.config.ts` imports `defineConfig` from `"vite"` and is type-checked
  by `tsconfig.node.json`, so a `test` block there needs the
  `/// <reference types="vitest/config" />` line shown below. Otherwise
  `npm run build` fails.
- `apps/admin/vite.config.js` exports a function of `{ mode }`, not a plain
  object. A `vitest.config.js` has to call it before merging, as shown below.
  When `vitest.config.js` exists, Vitest uses it instead of `vite.config.js`.
- `apps/web/tsconfig.app.json` includes `src`, so co-located `*.test.ts(x)`
  files are type-checked by `npm run build`. It sets `types: ["vite/client"]`,
  so import `describe`, `it` and `expect` from `"vitest"` instead of relying
  on globals. It also sets `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` and `erasableSyntaxOnly`: no unused imports, type-only
  imports as `import type { DishDto } from "@/types"`, and no `enum` or
  `namespace`.
- `.claude/rules/testing.md` loads automatically for `**/*.test.ts`,
  `**/*.test.tsx` and `apps/backend/src/test/**`. Its `paths` don't include
  admin `*.test.js` / `*.test.jsx`, so it won't load for admin unit tests:
  read it explicitly and follow it. Don't modify `testing.md` as part of
  this skill.

Proposed `apps/web/vite.config.ts` (the current file plus the reference line
and the `test` block). Only if the user has explicitly approved creating
`apps/web/vitest.setup.ts`, also add `setupFiles: ["./vitest.setup.ts"]` to
`test`:

```ts
/// <reference types="vitest/config" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Proposed new `apps/admin/vitest.config.js` (`apps/admin/vite.config.js`
stays unchanged):

```js
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default defineConfig((configEnv) =>
  mergeConfig(viteConfig(configEnv), {
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,jsx}"],
    },
  }),
);
```

Show the proposed `package.json` and config diff and **stop for approval**.
Only after the user approves it and runs or permits `npm install`, write the
tests.

**Once Vitest exists, test style:**

- Schemas: build one valid base object and change one field per test, so
  each failure has a single cause. Use `checkoutSchema.safeParse(...)` and
  assert `success` plus the issue `path` and `message` (e.g. `DELIVERY` with
  a blank `street` gives `["street"]`, "Street is required"; `TAKEAWAY` with
  a blank street passes; `note` at 300 characters passes, at 301 fails;
  `paymentType` other than `"CASH"` fails).
- `utils.ts`: `formatAmd` rounding and grouping (`1234.5` → `"1,235 AMD"`),
  `translate` fallback (missing lang → first entry, `undefined` → `""`),
  `sameLabel` case and accent insensitivity.
- `useCart.ts`: start every test with `await db.products.clear()`. Cover:
  a chef mismatch returns `"mismatch"` and leaves the cart unchanged, and with
  `replaceOtherChef` it clears the cart. `minimumOrderCount` raises the initial
  quantity. Adding the same dish twice merges the quantity.
  FOODQA-1 regression: with `minQuantity` 1 and quantity 2,
  `decrementCartItem` leaves the item in the cart with quantity 1.
  Decrementing an item whose quantity already equals `minQuantity` has no
  confirmed requirement (see "Unresolved business rules" in Step 4). Don't
  assert anything for that case until the user confirms the rule.
- `dataProvider.js`: mock the module it imports, at the path relative to the
  test file, e.g. from `src/providers/dataProvider.test.js`:
  `vi.mock("../api/base-api.js", () => ({ default: { get: vi.fn(), put: vi.fn() } }))`.
- Mock the web `apiClient` (`src/api/client.ts`) or the admin `api` default
  export (`src/api/base-api.js`) at the module boundary with `vi.mock`.
  Never make real network calls. Never depend on the backend on :8081.
- Use `vi.useFakeTimers()` / `vi.setSystemTime()` for anything time-based, and
  restore them in `afterEach`.

Run narrowest first: `npx vitest run src/lib/utils.test.ts`, then
`npx vitest run -t "decrement"`, then the full `npm run test:unit` (whatever
script name was approved), then `npm run lint` and `npm run build`, because
the tests are type-checked.

## Step 4: Design the cases

For each unit, list the cases before you write code. For every case, write
down the expected result **and its source**. Valid sources are a FOODQA
ticket, a written requirement, `CLAUDE.md` or the README, UI text, or the
user. The current code is not a source. When the backend and the web
implement the same behaviour the same way, you may use it, but mark it in
the report as "consistent in backend and web, not confirmed by a
requirement". If there's no source, the case belongs under "Unresolved
business rules" below.

Cover:

- **Happy path.** For example, a CASH TAKEAWAY order whose dishes have no
  additions. CASH-only is documented (`CLAUDE.md`: "cash-only checkout").
  TAKEAWAY without a delivery fee, and a line total of price × quantity for
  a dish without additions, are consistent in backend and web
  (`OrderService`, `Checkout/index.tsx`, `useCart.ts`). The initial status
  `NEW` exists only in backend code: treat it as an assumption unless the
  user confirms it. Use whole-AMD prices; fractional prices land on
  FM-BUG-01.
- **Negative.** A payment type other than `CASH` →
  `BadRequestException`. Unknown chef or dish → `NotFoundException` whose
  message contains the ID. Unknown customer →
  `NotFoundException("Customer not found")`, with no ID or email in the
  message. An invalid schema input gives the specific issue and message.
- **Boundaries.** Free-delivery threshold: exactly at `freeDeliveryFrom`,
  one below and one above. The UI says "free from X" and the web cart
  charges delivery only below the threshold (`user-cart.tsx`). The
  at-threshold case lands on FM-BUG-03, so ask before you write it (Hard
  rules, item 2; in Java, an approved test is a loud failure).
  `listForCustomer` with page `-1`, size `0`, `50` and `51`: the clamping
  exists only in code, so state it as an assumption or ask. Quantity `0` or
  `1` against `minimumOrderCount`.
- **Validation.** Bean Validation annotations aren't exercised by calling a
  service directly. Test them with a `Validator`
  (`Validation.buildDefaultValidatorFactory().getValidator()`) or leave them
  to MockMvc. Today only `CustomerRegisterRequestDto`,
  `CustomerLoginRequestDto` and `CreateOrderDishAdditionDto` declare
  constraints. `OrderDto` and `CreateOrderDishDto` declare none, so a
  quantity constraint test lands on FM-BUG-04.
- **Regression.** One test per fixed bug or ticket, named after it. Java:
  `method_condition_expectedResult_KEY`. Vitest:
  `it("FOODQA-1: decrementing from 2 to 1 keeps the item (minQuantity 1)")`.

### Unresolved business rules: stop and ask

No authoritative requirement exists yet for these cases. Don't pick an
expected result, and don't treat the current code as the rule. Describe what
the code does today, ask the user which behaviour is required, and don't
write an assertion for the case until they answer. Until then, list it under
"Limitations and assumptions" in the report. If the user wants it tracked,
offer a FOODQA draft: search for duplicates first, and create nothing
without approval of the exact draft.

- **Decrement at `minQuantity`.** `decrementCartItem` deletes the item when
  quantity ≤ `minQuantity` (`useCart.ts`). FOODQA-1 covers only 2 → 1 with
  `minQuantity` 1.
- **Additions × quantity.** Backend `OrderService.createOrder` adds each
  addition's price once per line. The web cart (`addDishToCart`, `useCart`)
  multiplies additions by quantity. Record the discrepancy; assert no
  expected total for a dish with additions and quantity > 1.
- **Null and missing input.** In the backend today: a `null` request
  `subtotal` is treated as 0; a `null` chef `freeDeliveryFrom` means
  delivery is never free; a `null` chef `deliveryPrice` or a `null`
  `createOrderDishes` throws a `NullPointerException`; an empty
  `createOrderDishes` saves an order without dishes; `null` item `additions`
  are ignored; `DELIVERY` without `addressDto` saves an order without an
  address. None of these is confirmed as the required behaviour.
- **Order number format.** `"FM-" + (100000 + sequence)` exists only in code
  (see Step 3a).

## Step 5: Write the tests

- **Names:** `method_condition_expectedResult` in Java
  (`calculateDeliveryPrice_takeaway_isFreeRegardlessOfSubtotal`). In Vitest use
  `describe("checkoutSchema")` + `it("rejects DELIVERY without street")`.
- **Arrange, Act, Assert:** three visible blocks. One behaviour per test, so
  it fails for one reason. Several assertions are fine if they describe the
  same outcome.
- **Isolated and order-independent:** fresh mocks and fresh service per test
  (`@BeforeEach`), no static mutable state, no shared cart rows, unique values
  where uniqueness matters.
- **Deterministic:** no real clock, randomness, network, file system or
  DB IDs from `data.sql`. Fix the stubbed sequence values.
- **Behaviour over implementation:** assert outputs and the saved entity.
  Don't assert private fields, call counts that don't matter, or log output.
- **Readable:** small factory helpers for entities and DTOs, no logic or
  loops in assertions, no copy-paste blocks over about 10 lines.

## Step 6: Run and analyse

Run the single new test, then the class or file, then the app's suite (see
the commands in 3a/3b). For every failure, classify it before you change
anything:

| Class | Signs | Action |
|---|---|---|
| **Application defect** | The expectation follows a stated business rule and the code disagrees. It's reproducible. | Keep the test as is. Report it. Check whether the area has an `FM-BUG-NN` marker. If it does, ask how to handle it (loud failure, or Vitest `test.fails`; see Hard rules, item 2). Don't disable or skip the test. If there is no marker, offer a FOODQA Bug draft (search for duplicates first, don't create it without approval). |
| **Test defect** | Wrong stub, wrong constructor or getter, wrong expectation, missing Arrange. | Fix the test and say what was wrong. |
| **Environment** | `JAVA_HOME` not set, wrong JDK, Gradle download blocked, `node_modules` missing, Vitest not installed, port in use. | Don't touch the code. Report the exact error and the fix the user needs to make. |
| **Flaky** | Passes and fails on reruns with no change. Depends on time, order or shared state. Or a known `FM-FLAKE-NN`. | Rerun the single test 3–5 times to confirm. Backend: add `--rerun-tasks` (`./gradlew test --rerun-tasks --tests 'am.foodme.backend.<package>.<Class>.<method>'`), because Gradle skips an unchanged `test` task and prints `UP-TO-DATE` without running anything; an `UP-TO-DATE` result is not a test run. Vitest has no such cache. A new test that's flaky is a test defect, so fix the nondeterminism. A planted flake is something you report, not fix. |

Never "resolve" a failure by editing production code, loosening the
assertion, or skipping the test.

## Step 7: Report

End with this report. Mask emails, phones and tokens in any excerpt.

```markdown
## Unit tests: <target>

**Scope:** <class/function>, <app>. Layer: unit (no Spring context / no browser).
**Branch:** <branch>

### Tests added / changed
| File | Test | Covers (happy / negative / boundary / validation / regression) |
|---|---|---|

### Commands run
| Command | Result |
|---|---|
| `./gradlew test --tests '…'` | exit 0, 7 passed, 0 failed |
| `./gradlew test` | exit 1, 41 passed, 1 failed (FM-FLAKE-02, known) |
(or "not run: <reason>")

### Failures and classification
- <test>: <application defect | test defect | environment | flaky>. <evidence: assertion message, expected vs actual>

### Suspected defects
- <FM-BUG-NN or new>: <rule, expected, actual>. Proposed handling: <ask user>.

### Limitations and assumptions
- <e.g. createdAt not assertable (LocalDateTime.now()); expectation for X assumed from UI text>
- Unresolved business rules asked: <rule>: <user answer or "awaiting answer">
- Expectations not confirmed by a requirement: <case>: <source, e.g. "consistent in backend and web">

### Frontend setup gap (if applicable)
- Missing: <deps>. Proposed: <diff>. Not installed.

### Not changed
- No production code or seeded defects touched. Build config and test infrastructure: <unchanged | changed with the user's approval: files>. Nothing staged or committed.
- `git status`: <output>
- Patch SHA-256: <value> (unchanged)
```
