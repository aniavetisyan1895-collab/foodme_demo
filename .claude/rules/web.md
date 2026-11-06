---
paths:
  - "apps/web/**"
---

# Storefront conventions (`apps/web`)

## Layout

| Path | Contents |
|---|---|
| `src/router.tsx` | Routes: `/`, `/explore`, `/chef/:id`, `/checkout`, `/login`, `/register`, `/orders`, `/orders/success`, `/orders/failed`, `/tracking/:number` |
| `src/pages/<Name>/index.tsx` | One folder per page |
| `src/components/ui` | shadcn-style primitives (`components.json`) |
| `src/components/sections`, `src/components/layout` | Feature components, header/footer/layout |
| `src/api/client.ts` | `apiClient` (fetch wrapper: auth header, error → `ApiRequestError`, 401 on `/api/customer` clears auth) |
| `src/api/foodme.ts` | All endpoint calls. Add new calls here, never call `fetch` from components |
| `src/types/index.ts` | API types (must match backend DTO field names) |
| `src/schemas/` | zod schemas for checkout and auth forms (react-hook-form) |
| `src/hooks/useCart.ts`, `src/lib/db.ts` | Cart stored in IndexedDB via Dexie (`FoodMeCart` DB, `products` table) |
| `src/lib/` | `auth-storage`, `i18n`, `sentry`, `utils` (`cn`, `formatAmd`, `translate`) |

## Rules

- Import from `src` with the `@/` alias (configured in `vite.config.ts`).
- Server state goes through TanStack Query. Cart state goes through the
  `useCart` helpers, not component state.
- UI strings are hardcoded English today. i18next is initialised
  (`src/lib/i18n.ts`) but no component calls `useTranslation`. E2E tests match
  on these English strings, so changing UI text breaks tests.
- Keep accessible names (roles, labels, `aria-*`) stable. The E2E suite
  relies on them.
- Lint with `npm run lint` (oxlint) and type-check/build with
  `npm run build`. `tsconfig.app.json` includes only `src`, so `e2e/*.ts` is
  **not** type-checked by the build.
- Don't change the API base URL logic in `src/api/client.ts`. It handles
  both same-origin production and the `:8081` dev default.
