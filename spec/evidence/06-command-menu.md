# Phase 06 command-menu evidence — 2026-09-26

## Codex runtime

Runtime: `codex-cli 0.157.1`. Isolated fixture initialized from this checkout
with `bun run bin/specloop.ts init <project> --agent codex`. The project-local
`node_modules/.bin/specloop` wrapper invoked this checkout's Bun CLI. No global
installation, publishing, hook trust bypass, or project task execution.

Two independent native runtime invocations:

```sh
codex exec --ephemeral --ignore-user-config --skip-git-repo-check --sandbox read-only -C <project> --json '$specloop'
codex exec --ephemeral --ignore-user-config --skip-git-repo-check --sandbox read-only -C <project> --json '$specloop list undone --json'
```

The first sandboxed process launch failed to initialize its app-server client
with `Operation not permitted`; the approved outside-sandbox launch succeeded.
The tested Codex agent itself retained `--sandbox read-only` in both probes.

Menu result: all 13 action rows, their arguments, and Codex examples appeared.
No command-execution events occurred. A SHA-256 snapshot of every project file
(including the ledger and advisory run-state) was identical before and after
both probes. This proves the observed menu/list behavior, not writable loop
execution or reconciliation-hook activation.

Exact menu response:

| Action | Arguments | Purpose |
|---|---|---|
| `init` | `[goal] [--dir path] [setup options]` | Scaffold specs and decompose a goal |
| `upgrade` | `[dir] [--apply] [setup options]` | Inspect or apply adoption |
| `refresh` | `[dir] [--apply] [--agent runtime]` | Preview or apply agent-asset updates |
| `check` | `[--dir path] [--json]` | Validate spec structure |
| `preflight` | `[--dir path] [--json]` | Check workspace readiness |
| `status` | `[phase] [--dir path] [--json]` | Report checkbox progress |
| `list` | `[all|done|undone] [--dir path] [--json]` | List phases by priority; default undone |
| `prio spec` | `<NN> <pos> [--dir path]` | Reorder phase: 0 top, +N up, -N down |
| `prio task` | `<NN.T> [--to p1|p2|p3] [--dir path]` | Set or bump task priority |
| `audit` | `"<goal>" [--dir path]` | Trace completion through evidence |
| `loop` | `[phase]` | Execute spec work |
| `help` | None | Show this menu |
| `version` | None | Show installed CLI version |

Setup options: `--agent claude|codex|both`, `--skills copy|link|none`. `init` also accepts `--force`.

Examples:

```text
$specloop status
$specloop list undone
$specloop prio spec 22 0
$specloop prio task 07.3 --to p1
$specloop loop
```

Shell commands use `specloop <action>` without `$` or `/`. `loop` is agent-only; shell `audit` prints the audit prompt. Bare shell `specloop` runs preflight.

Plain chat `specloop` starts an autonomous run. This explicit skill invocation only displays the menu.

## Explicit action routing

The second probe read the installed skill and project metadata, then ran:

```sh
node_modules/.bin/specloop list undone --json
```

The CLI exited 0. The agent returned the same JSON, including the expected
example phase's 2/4 checkbox count:

```json
{
  "hasBacklog": true,
  "filter": "undone",
  "phases": [
    {
      "position": 1,
      "number": 1,
      "title": "Example: project scaffold",
      "done": false,
      "checked": 2,
      "total": 4
    }
  ]
}
```

Raw local transcripts (temporary diagnostic artifacts):
- `/tmp/specloop-menu-proof-fivr_gl4/menu.jsonl` — SHA-256 `68cc6de9a1cf17717c2e1bab8f67352ff90dfd624b84aa898cd05b8e3081da38`
- `/tmp/specloop-menu-proof-fivr_gl4/action.jsonl` — SHA-256 `e307213164f45d7693a7deef762a6274289a81935d35b9965840c1f13ee974a2`

## Claude runtime

`claude auth status` exited 1 and reported `loggedIn: false`, `authMethod:
none`. Live Claude acceptance remains unchecked pending authentication.
Installation tests and packed reference comparisons are not substitutes for
live `/specloop` and `/specloop list undone --json` response evidence.

## Automated checks

- Full Bun suite: 110 tests passed, 0 failed.
- TypeScript typecheck and template/self structural validators passed.
- Packaged onboarding: 82 assertions passed, 0 failed, including all four
  shared workflow references in both runtime directories and list aliases.
- Skill frontmatter validation passed after moving its version to metadata.
