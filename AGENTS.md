# Working agreement for agents in FoodMe

This file covers *how* to work here. Project facts, commands, the test
inventory and the non-negotiable safety constraints are in `CLAUDE.md`. Read
it first. App conventions are in `.claude/rules/`.

## Before you change anything

1. Check where you are: `git branch --show-current` and `git status`.
   Read-only inspection on `main` is fine. Before making any file change on
   `main`, stop and ask for a feature branch.
2. Inspect before you assume. Read the actual config or source. If you can't
   verify something, say so and label it as an assumption.
3. Keep to the requested scope. Don't refactor, rename, reformat or "fix"
   neighbouring code, and ask before widening the change.
4. Don't install dependencies, add tools or change build config unless the task
   asks for it.

## Intentional workshop behaviour (don't "fix")

These exist on purpose:

- `SimulatedLatencyConfig` adds a random 200–1500 ms delay to `/api/**` and
  `/admin/**` (not `/api/images/**`). The `test` profile sets it to 0.
- `FlakyHeartbeatJob` (backend, disabled under the `test` profile) and
  `lib/flakyHeartbeat` (web, admin) report synthetic failures to Sentry/GlitchTip.
- `GET /api/debug/boom` always throws.
- `HttpLoggingFilter` logs request and response bodies with auth headers and
  password/token fields masked. Emails, names and phone numbers are *not* masked.

## Seeded defects and flaky tests

The code contains planted defects marked `FM-BUG-NN` and planted flaky tests
marked `FM-FLAKE-NN`. List them with
`grep -rn --exclude-dir=node_modules "FM-BUG-\|FM-FLAKE-" apps`. They're
exercise material.

- Don't fix a seeded defect, remove a marker or "stabilise" a planted flaky
  test unless the task names it.
- A new test that exposes a seeded defect is a valid finding. How to handle it
  (expected failure vs. failing loudly) is the user's decision, so ask.
- FM-BUG-07 (cart decrement) is already fixed on `main` (commit `b2adfa2`,
  Jira FOODQA-1).

## API contract

Don't rename API paths or JSON fields. If a change really needs one, update all
three together: backend DTOs, `apps/web/src/types` + `apps/web/src/api/foodme.ts`,
and the admin `src/api/*` + pages.

## Git workflow

- Staging, committing, pushing and protecting the patch: follow
  `CLAUDE.md` → **Safety constraints**. That section is the single source for
  these rules.
- One feature branch per piece of work.
- Commit messages: Conventional Commits, `<type>(<scope>): <summary>`, with a
  Jira key when one exists (e.g. `(FOODQA-1)`). Types: `feat`, `fix`, `test`,
  `refactor`, `chore`, `docs`, `ci`.

## Jira

- Project **FOODQA** (FoodMe QA) is reached through the user's Atlassian MCP
  connection. Read operations (search, view) are fine.
- Before creating a ticket, search FOODQA for duplicates.
- Any create, edit, transition, comment or link needs the user's explicit
  approval of the exact draft first.
- Write Bug reports with: summary, description, steps to reproduce, expected
  result, actual result, environment, and masked evidence (test ID, assertion,
  log excerpt with its query).

## Evidence and reporting

- Quote the exact command you ran and its real result (exit code, pass/fail
  counts). If you didn't run something, say "not run".
- Separate verified facts from assumptions.
- Mask secrets and personal data in anything you paste: logs, payloads, tickets.

## Definition of done

- The change does only what was asked, and existing behaviour is preserved.
- Relevant checks were run for each touched app (see `CLAUDE.md` → Commands),
  or you state clearly why they couldn't run.
- `git status` is shown, and the pre-commit checks in `CLAUDE.md` → Safety
  constraints pass.
