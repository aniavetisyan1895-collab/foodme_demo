# `.agents/`: tool-neutral agent assets

FoodMe keeps agent material in two folders:

- **`.claude/`**: Claude Code configuration that Claude Code reads directly:
  rules (`.claude/rules/`), skills (`.claude/skills/`) and settings
  (`.claude/settings.json`, which registers the hook below).
- **`.agents/`** (this folder): shared, tool-neutral assets that those pieces
  call or refer to, such as scripts, hook programs and data. They work with
  any agent tool, and with a human at a terminal.

Rules of thumb:

- **Instructions** (what to do, conventions) go in `CLAUDE.md`, `AGENTS.md`,
  `.claude/rules/` or `.claude/skills/`, not here.
- **Executable helpers and data** go here.
- Nothing here duplicates text from `.claude/`. No symlinks between the two,
  because they need extra rights on Windows.
- No secrets, tokens or machine-specific paths. Local values go in
  `.claude/settings.local.json` (gitignored).
- Scripts are written for Node (already required by the web and admin apps),
  so they don't depend on `jq` or Python.

## Contents

| Path | Purpose | Status |
|---|---|---|
| `hooks/block-bad-tests.js` | PreToolUse hook for Write/Edit/MultiEdit. Blocks changes to test files that add skipped, disabled, focused or expected-failure tests, or tests without a meaningful assertion | exists |
| `hooks/__tests__/block-bad-tests.cases.js` | Self-check for the hook: `node .agents/hooks/__tests__/block-bad-tests.cases.js` | exists |
| `hooks/` (other hooks) | Dangerous-command guard, formatting, action log, Jira-write guard | planned |
| `scripts/` | Helpers used by skills: masking, read-only log queries, test-result summaries | planned |
| `catalog/` | Data files, e.g. a map of seeded defects (`FM-BUG-NN`, `FM-FLAKE-NN`) to tests and FOODQA tickets | planned |
| `logs/` | Local action logs written by hooks. Gitignored, never committed | planned |

Planned items don't exist yet; each is added in a later, separately approved
phase.

**Limitation of `block-bad-tests.js`:** it only sees Claude Code's
Write/Edit/MultiEdit tools. Test files changed through the Bash or PowerShell
tool, by a script or by a person aren't checked, and neither are helper files
that tests import (for example `apps/web/e2e/auth.ts`). Blocking shell writes
reliably would require parsing arbitrary commands, and a PostToolUse hook
can't undo a command that already ran. Review test changes in the diff as
usual.
