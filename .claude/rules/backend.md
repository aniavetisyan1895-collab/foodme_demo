---
paths:
  - "apps/backend/**"
---

# Backend conventions (`apps/backend`)

## Layout

Package root: `am.foodme.backend`.

| Package | Contents |
|---|---|
| `controller/api` | Storefront endpoints under `/api/**` |
| `controller/admin` | Back-office endpoints under `/admin/**` |
| `service` | Business logic (e.g. `OrderService`, `ChefService`) |
| `repository` | Spring Data JPA repositories |
| `model` | JPA entities |
| `dto` | Request/response DTOs. Mapping uses static `mapEntityToDto` / `mapDtoToEntity` methods on the DTO |
| `exceptionHandler` | `BadRequestException`, `NotFoundException`, `GlobalExceptionHandler` → `ErrorResponseDto` |
| `security` | `SecurityConfig`, `JwtService`, `JwtAuthenticationFilter` |
| `config`, `observability` | Latency simulation, SPA serving, logging. Mostly intentional workshop behaviour |
| `utils/ControllerUtil` | Base paths for every controller. Add new paths here |

## Rules

- Keep the layering: controller → service → repository. No repository calls
  from controllers.
- Signal client errors by throwing `BadRequestException` / `NotFoundException`.
  Don't build error responses by hand.
- The schema is `foodme`, managed by Flyway (`src/main/resources/db/migration`).
  **Never edit an existing `V*__*.sql`**. Add the next version instead.
  Production uses `ddl-auto=validate`, so entity changes need a migration.
- `SecurityConfig` matchers are order-sensitive. `/api/**` is `permitAll`
  except `/api/customer/**` and `POST /api/order` (role CUSTOMER). Review the
  whole chain before changing access rules.
- Don't rename DTO fields (see the API contract in `AGENTS.md`).
- Lombok is used for getters, setters and constructors. Follow the style of the
  file you're editing.

## Tests

- Location: `src/test/java/am/foodme/backend/`. Current classes use
  `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`.
- The `test` profile (`src/main/resources/application-test.properties`) uses
  H2 in PostgreSQL mode, Hibernate `create-drop`, **Flyway disabled**, seed data
  from `src/test/resources/data.sql`, and zero simulated latency.
- Because Flyway is off in tests, the migrations are not exercised by the test
  suite.
- All test classes share one Spring context and one H2 database, so data
  created by one test is visible to the others.
- Run with `./gradlew test` (JDK 17 required). General test rules:
  `.claude/rules/testing.md`.
