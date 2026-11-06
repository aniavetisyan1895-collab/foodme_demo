---
name: jira
description: Work with the FoodMe QA Jira project (FOODQA) through the Atlassian MCP connection in Claude Code - search and read issues, draft and (after explicit approval) create bug reports, edit fields, comment, change status and link issues. Use it when asked to look up, file, update, comment on, transition or link a FOODQA ticket, or to turn a test failure into a bug report.
---

# Jira (FOODQA) for FoodMe

FoodMe's QA tickets live in the Jira project **FOODQA** ("FoodMe QA"), reached
through the user's Atlassian MCP server (tools named `mcp__atlassian__*`).
`CLAUDE.md` → Safety constraints and `AGENTS.md` → Jira set the rules; this
skill applies them. They take precedence over it.

## Hard rules

1. **Reads are free; every write needs approval of the exact content, every
   time** (`CLAUDE.md`). Writes are: create, edit, comment (new or edited),
   transition, link, worklog. Show the complete draft (every field and the
   full text) and wait for an explicit "yes" to that draft. Approval of one
   write doesn't cover the next one, and "go ahead and file bugs" doesn't
   cover drafts the user hasn't seen. If the user changes the draft, show
   the new version and ask again.
2. **Search for duplicates before creating** (`AGENTS.md`), and show the
   search and its results with the draft.
3. **Writes can't be undone from here.** The connection has no delete tool
   for issues, comments or links. A wrong ticket or comment stays until
   someone fixes it in Jira. Prefer one correct write over several attempts.
4. **No secrets or personal data in Jira.** Mask emails, phone numbers,
   tokens, passwords and JWTs in descriptions, comments and log excerpts
   (`CLAUDE.md`). Test fixture emails such as `ann@example.com` are fine;
   anything from a real user or a deployed environment isn't. Never paste the
   seeded admin password.
5. **Only FOODQA, unless the user names another project.** Don't read or
   write other projects on the site on your own initiative.
6. **Don't invent fields, values or statuses.** Use only what the metadata
   tools return (Step 2). If a field the user asks for doesn't exist, say so.
7. Never change code, tests or git state as part of a Jira task.

## Step 1: Connect

1. Call `mcp__atlassian__getAccessibleAtlassianResources` to get the `cloudId`
   (and site URL). Pass that `cloudId` to every other call. Don't hardcode
   it; it belongs to the user's Atlassian account.
2. If the `mcp__atlassian__*` tools aren't available or the call fails, stop:
   tell the user the Atlassian MCP server isn't connected and that they can
   check it with `/mcp` in Claude Code. The server is configured outside the
   repository (the user's local Claude Code config); `.mcp.json` is
   gitignored and no `.mcp.json.example` exists in the repo yet. Don't
   create or edit MCP configuration.
3. `mcp__atlassian__atlassianUserInfo` tells you whose account the writes
   will be made as.

## Step 2: What FOODQA looks like

Read at the time of writing with the metadata tools. Re-read before any
write, because a Jira admin can change these:

- **Project:** key `FOODQA`, team-managed software project.
- **Issue types:** Bug, Task, Story, Epic, Subtask
  (`mcp__atlassian__getJiraProjectIssueTypesMetadata`).
- **Fields for a Bug** (`mcp__atlassian__getJiraIssueTypeMetaWithFields`
  with `requiredFieldsOnly: false`):
  - required: Summary, Project, Issue Type, Reporter (Reporter defaults to
    the connected user);
  - optional and useful: Description, Priority (Highest, High, Medium, Low,
    Lowest; default Medium), Labels, Assignee, Parent, Due date, Linked
    Issues;
  - there is **no Components field** for Bug in this project, so don't send
    `components`.
- **Workflow:** statuses To Do, In Progress, Done. Transition IDs come from
  `mcp__atlassian__getTransitionsForJiraIssue` for the specific issue; never
  reuse an ID from memory.
- **Link types** (`mcp__atlassian__getIssueLinkTypes`): Blocks, Cloners,
  Duplicate, Relates.
- **Existing tickets:** list them with the search in Step 3. At the time of
  writing there is one, `FOODQA-1` (Bug, Done): "FM-BUG-07: Decreasing cart
  quantity from 2 removes the item instead of reducing it to 1".

## Step 3: Read and search

| Need | Tool | Notes |
|---|---|---|
| One issue | `mcp__atlassian__getJiraIssue` | `issueIdOrKey`, `responseContentFormat: "markdown"`. Passing `fields` replaces the default field list, so to see comments ask for them together with what you need, e.g. `["summary", "status", "description", "comment"]` |
| Search | `mcp__atlassian__searchJiraIssuesUsingJql` | `jql`, `fields`, `maxResults` (≤ 100), `nextPageToken` for more pages. Use `searchResultMode: "count"` only when a total is needed |
| Remote links (PRs, pages) | `mcp__atlassian__getJiraIssueRemoteIssueLinks` | read-only |
| Valid transitions | `mcp__atlassian__getTransitionsForJiraIssue` | read-only |
| A user's account ID | `mcp__atlassian__lookupJiraAccountId` | `searchString` (name or email); needed for `assignee_account_id`. Don't paste the returned email into a report |

Useful JQL (the first, second and fourth patterns were run against FOODQA
while this skill was written; `text ~` matched FOODQA-1 by its marker):

```text
project = FOODQA ORDER BY created DESC
project = FOODQA AND statusCategory != Done ORDER BY updated DESC
project = FOODQA AND type = Bug AND text ~ "cart"
project = FOODQA AND text ~ "FM-BUG-03"
```

When you report what you found, quote keys, summaries and statuses as Jira
returned them.

## Step 4: Duplicate search (before any create)

Search with at least two queries: the seeded marker if there is one
(`text ~ "FM-BUG-NN"`) and the key words of the symptom
(`text ~ "delivery" AND text ~ "threshold"`). Include Done issues: a closed
ticket for the same defect is a reason to ask whether to reopen or link
instead of filing a new one. Show the user the queries and every candidate,
with your reading of whether it's the same problem.

## Step 5: Draft a bug report

Use the structure from `AGENTS.md` and the existing FOODQA-1:

- **Summary:** one line stating the symptom. If the defect is a seeded one,
  start with its marker, as FOODQA-1 does
  (`FM-BUG-03: Delivery is charged when the subtotal equals the free-delivery threshold`).
- **Description** (Markdown, `contentFormat: "markdown"`), with these
  sections:
  - **Precondition**
  - **Steps to reproduce** (numbered)
  - **Expected result**, with its source (requirement, ticket, UI text, or
    "assumption"; see `unit-test` Step 4, `integration-test` Step 3 and
    `e2e-test` Step 3). If the expectation rests only on code behaviour or on
    one of those skills' "unresolved rules", say so in the ticket or ask the
    user before filing
  - **Actual result**
  - **Environment** (app, URL type such as local dev or Render, browser,
    signed-in state, branch and commit)
  - **Test data** (seed IDs or fixture names, no personal data)
  - **Evidence**: test ID and file, the failing assertion, and a masked log
    excerpt with the query or command that produced it
- **Priority:** only if the user chose one; otherwise leave the default.
- **Labels:** only if the user asks; don't invent a labelling scheme.

Show the draft as the exact tool arguments you'll send:

```text
Tool: mcp__atlassian__createJiraIssue
cloudId: <from Step 1>
projectKey: FOODQA
issueTypeName: Bug
summary: <summary>
contentFormat: markdown
description: <full Markdown text>
additional_fields: <only if approved, e.g. {"priority": {"name": "High"}}>
```

## Step 6: Writes (each one only after approval)

| Operation | Tool | Required arguments | Before you call it |
|---|---|---|---|
| Create | `mcp__atlassian__createJiraIssue` | `cloudId`, `projectKey`, `issueTypeName`, `summary` | Steps 4 and 5 done, draft approved |
| Edit fields | `mcp__atlassian__editJiraIssue` | `cloudId`, `issueIdOrKey`, `fields` | Read the issue first; show old and new value of every field you change. An explicit `null` clears a field |
| Comment | `mcp__atlassian__addCommentToJiraIssue` | `cloudId`, `issueIdOrKey`, `commentBody` | Show the full text. Passing `commentId` **edits an existing comment** instead of adding one; only do that when the user asked to edit that comment |
| Change status | `mcp__atlassian__transitionJiraIssue` | `cloudId`, `issueIdOrKey`, `transition: {id}` | Get the ID from `getTransitionsForJiraIssue` for this issue; name the current and target status in the approval request |
| Link issues | `mcp__atlassian__createIssueLink` | `cloudId`, `inwardIssue`, `outwardIssue`, `type` | Check the direction: for `Blocks`, `inwardIssue` is the blocker and `outwardIssue` the blocked issue. For `Duplicate`, say which issue is the duplicate |

`mcp__atlassian__addWorklogToJiraIssue` also exists (`timeSpent` required;
`worklogId` edits an existing worklog). Don't log work unless the user
explicitly asks, and then under the same approval rule. Don't set the
optional `transition` argument of `createJiraIssue`; create first, then
transition separately if the user asks. The Confluence tools on the same
server are out of scope for this skill.

After each write, read the issue back (`getJiraIssue`) and report the key,
URL and the fields as Jira stored them. If a call fails, report the error
message as returned and don't retry with changed content without asking.

## Step 7: Report

```markdown
## Jira: <what was done>

**Site / project:** <site>, FOODQA. **Acting as:** <display name from atlassianUserInfo>

### Reads
| Call | Query / key | Result |
|---|---|---|

### Writes
| Operation | Issue | Approved draft shown | Result (key, URL, status) |
|---|---|---|---|
(or "none")

### Notes
- Duplicates considered: <keys and verdict>
- Masked in the ticket: <what was masked>
```
