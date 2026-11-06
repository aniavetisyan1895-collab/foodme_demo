---
paths:
  - "apps/admin/**"
---

# Back-office conventions (`apps/admin`)

## Layout

| Path | Contents |
|---|---|
| `src/App.jsx` | `<Admin>` with resources: orders, chefs, dishes. Default **hash router** (URLs look like `/#/orders`) |
| `src/providers/dataProvider.js` | react-admin data provider (`getList`, `getOne`, `update`, …). `updateMany` is deliberately unsupported |
| `src/providers/authProvider.js` | Admin JWT login/logout |
| `src/api/base-api.js` | Shared axios instance (`BaseApi`) and API base URL logic |
| `src/api/{auth,chef,dish,order}-api.js` | Endpoint wrappers over `BaseApi` |
| `src/pages/{orders,chefs,dishes}/` | List, show and edit screens |
| `src/security/`, `src/layout/`, `src/theme/`, `src/constants/` | Route guards, layout, MUI theme, `OrderStatus` |

## Rules

- Plain JavaScript/JSX only. No TypeScript in this app.
- Put backend calls in `src/api/*-api.js` using `BaseApi`. Standard CRUD
  operations are wired through `dataProvider`; custom actions may call API
  wrappers directly.
- Pages must never import axios directly.
- In production the app is served under `/backoffice/` (`vite.config.js`
  `base`). Locally it runs at `/`. Use react-admin navigation, not hardcoded
  absolute paths.
- `src/pages/orders/OrderShow.jsx` contains seeded defect FM-BUG-08. Leave it
  unless the task names it.
- Lint with `npm run lint` (eslint) and build with `npm run build`. Both need
  `npm ci` first. `node_modules` isn't installed by default.
- Admin E2E tests (`e2e/admin-flows.spec.ts`) need the backend on :8081 and
  use the seeded admin account from the Flyway seed data.
