---
name: specloop
description: Manage specloop phase checklists, run spec work, audit completion, or display the specloop command menu when explicitly invoked without an action.
metadata:
  version: "0.2.0"
---

# specloop

Use the user's request to choose an action. Explicit invocation uses
`$specloop` in Codex, `/specloop` in a Claude project install, or
`/specloop:specloop` in a Claude marketplace install. Trailing user text is
input to this skill; Claude may supply it as `ARGUMENTS:`. Do not require
Claude-specific placeholder substitution in Codex.

## Menu and routing

An explicit skill invocation with no action, or with `help`, displays the menu
below as the response and stops. Use the invoking runtime's prefix in the
examples. Do not run preflight, start a loop, edit files, append the ledger,
or produce a spec completion handoff just for a menu. The menu also works
outside a specloop repository and without a CLI installed.

| Action | Arguments | Purpose |
|---|---|---|
| `init` | `[goal] [--dir path] [setup options]` | Scaffold specs and decompose a project goal |
| `upgrade` | `[dir] [--apply] [setup options]` | Inspect adoption; apply scaffolding and re-author specs when requested |
| `refresh` | `[dir] [--apply] [--agent runtime]` | Preview or apply safe agent-asset updates |
| `check` | `[--dir path] [--json]` | Validate spec structure |
| `preflight` | `[--dir path] [--json]` | Check workspace readiness |
| `status` | `[phase] [--dir path] [--json]` | Report actual checkbox progress |
| `list` | `[all|done|undone] [--dir path] [--json]` | List phases in priority order; default undone |
| `prio spec` | `<NN> <pos> [--dir path]` | Reorder a phase: 0 top, +N up, -N down |
| `prio task` | `<NN.T> [--to p1|p2|p3] [--dir path]` | Set task priority or bump it one level |
| `layout` | `[--dir path] [--json]` | Inspect flat/grouped layouts and recommendations |
| `group` | `<NN> [--apply] [--no-split] [--dir path]` | Preview or apply grouping into sub-specs |
| `audit` | `"<goal>" [--dir path]` | Trace goal completion through requirements and evidence |
| `loop` | `[phase]` | Execute spec work to the run's terminal condition |
| `help` | None | Show this menu |
| `version` | None | Show the installed CLI version |

Setup options: `--agent claude|codex|both`, `--skills copy|link|none`;
`init` also accepts `--force`. Preserve the CLI's existing option semantics.

For Codex show examples `$specloop status`, `$specloop list undone`,
`$specloop prio spec 22 0`, `$specloop prio task 07.3 --to p1`, and
`$specloop loop`. For Claude substitute the actual slash invocation prefix.
Mention that shell commands use `specloop <action>` without `$` or `/`;
`loop` is agent-only, and shell `audit` prints the prompt rather than auditing.
Bare shell `specloop` runs preflight. Plain chat `specloop` starts an autonomous
run; the explicit skill menu does not.

Normalize legacy actions before routing: `list-spec`/`listspec` → `list`,
`prio-spec`/`priospec` → `prio spec`, `prio-task`/`priotask` → `prio task`,
`goal-check`/`goalcheck` → `audit`, `spec-init` → `init`, `spec-loop` → `loop`,
`spec-status` → `status`, `spec-upgrade` → `upgrade`, and `spec-layout` → `layout`. Old slash commands
and skills remain supported. Unknown explicit actions or missing/invalid
`prio` targets show usage and stop without changes. `start`, `run`, and `go`
are not aliases for loop.

Implicit use during an ordinary request follows that request; merely loading
this skill is not a menu request or permission to start a loop. Explicit
invocation with a natural-language request should fulfill that request when
its intent is clear, otherwise ask for the intended action.

## Native Codex and Claude goals

An active Codex or Claude `/goal` whose condition is `specloop loop` routes directly
to `loop` with all-specs scope; read [execution](references/loop.md). This is
a native goal condition, not a shell command or another slash command to
install. A question or documentation example containing it does not authorize
a run. Announce the expanded completion condition for native goal tracking. In Codex,
reuse the active goal and follow its native lifecycle/budget rules; mark it
complete only after verifying the all-specs condition.

## Action workflows

Resolve the selected target directory before project reads or edits; a `--dir`
or directory argument applies to the whole workflow, not just its CLI calls.

Read only the reference needed for the selected action, relative to this skill:

- `init`: [setup](references/init.md). Treat free text as the goal; pass only
  setup options and the target directory to the CLI, not the goal as a path.
- `upgrade`: [adoption](references/upgrade.md). Without `--apply`, inspect
  only; after explicit apply, scaffold and translate existing requirements.
- `loop`: [execution](references/loop.md). Respect Plan Mode when active.
- `audit`: [goal audit](references/audit.md). Perform the audit, rather than
  returning only the CLI's printed prompt.
- `status`: run `specloop status` with supplied CLI flags. An optional phase
  filters the agent report, not the shell command. Read the phase's checkboxes
  and report using the project's required status format. For `--json`, return
  the requested machine-readable output without a prose wrapper.
- `list`, `prio spec`, `prio task`, `check`, `preflight`, `refresh`, `layout`, `group`, `version`:
  run the corresponding CLI command, preserving argument boundaries and flags.
  Never interpolate raw user text into shell code. Refresh and group remain dry runs
  unless `--apply` is supplied. Pass through failures with the cause and repair;
  do not silently install packages or replace a failing command with edits.

Prefer `specloop` on PATH, then the project's installed binary. If neither
exists, report that the CLI is unavailable and show
`bun add -d @khangtoh/specloop`; do not claim checks or version succeeded.
Read-only status/list and an audit may still be performed directly from the
project files. Do not invent a path to templates that were not installed.

## Spec invariants

Before project work read its `spec/agent-session-ledger.md` and relevant specs.
Use the configured spec directory when `.specloop.json` overrides `spec/`.
`BACKLOG.md` ranks phases; `Depends on:` gates eligibility; task `(pN)` and
position order boxes within a phase. Priority never overrides dependencies.
A phase may be a flat `NN-title.md` file or a `NN-title/` folder with
`README.md` and sub-specs. Aggregate grouped progress across all owned files;
task indices span root tasks first, then sub-specs in filename order.
Done-state comes from actual checkboxes. Check tasks only with evidence,
update Findings/Results and the phase index, and follow the project's
`spec-summary-status.md` handoff when reporting material work or status.
Read-only menu/list requests need no ledger churn. Run `specloop check` before
a material-work handoff. Existing custom assets and ledger history are protected.

## Decision reconciliation — every session

Before any work, including direct user requests outside `/spec-loop`, and after
resumption or compaction, read `spec/agent-session-ledger.md` and the relevant
authoritative specs. Compare incoming instructions with applicable decisions.
Follow instruction precedence: a clear user override of a project decision
needs no repeated permission; clarify genuinely ambiguous conflicts.

Before dependent implementation, append a dated entry to the existing ledger:

- **Previous decision:** what was decided and its source.
- **Conflicting instruction:** what changed and its source.
- **Resolution:** what survives, what is superseded, and why.
- **Scope and consequences:** affected requirements, tasks, and remaining work.

Then update the authoritative spec and add a supersession reference. Never
rewrite ledger history or undo completed historical checkboxes. Do not create
a separate decision ledger. Append a session entry for ordinary material work
or a meaningful resume point; read-only questions need no ledger churn.
In Plan Mode, review and describe pending reconciliation without mutating
project files; record the resolution when implementation is authorized.
Hooks remind and check file changes; semantic reconciliation remains the
agent's responsibility even when hooks are unavailable or a check passes.
