# specloop (plugin)

The specloop plugin for **Claude Code** and **Codex**. Same package, two
manifests (`.claude-plugin/` and `.codex-plugin/`), one shared skill.

## Commands and skill menu

Submit `$specloop` in Codex or `/specloop` in a Claude project install to see
all commands, arguments, and examples. For a Claude marketplace plugin use
`/specloop:specloop`. Append an action to the same invocation, for example
`$specloop prio task 07.3 --to p1` or `/specloop list undone`.

| Actions | Purpose |
|---|---|
| `init`, `upgrade`, `refresh` | Setup, adoption, and safe asset refresh |
| `check`, `preflight` | Structure and workspace verification |
| `status`, `list` | Checkbox progress and backlog listing |
| `prio spec <NN> <pos>` | Phase priority (0 top, +N up, -N down) |
| `prio task <NN.T> [--to pN]` | Task priority (explicit level or bump) |
| `layout`, `group <NN> [--apply] [--no-split]` | Inspect layouts or group a flat phase |
| `audit "<goal>"` | Evidence-based goal audit |
| `loop [phase]` | Execute spec work to the scoped terminal condition |
| `help`, `version` | Menu or installed CLI version |

Bare skill invocation only displays the response menu. Plain chat `specloop`
continues to start an autonomous run. Shell `specloop` runs preflight; the
shell has no loop command and its audit command prints a prompt.

The legacy `/spec-init`, `/spec-loop`, `/spec-status`, `/goal-check`,
`/prio-spec`, `/list-spec`, and `/spec-upgrade` commands and existing named
skills remain compatible. Current workflows live inside the shared skill so
both runtimes receive the necessary references through project installation.

## Per-repository install (no plugin needed)

`specloop init` and `specloop upgrade --apply` copy this directory's `skills/`
and `commands/` into the target repo's `.claude/` directory. Nothing here
references `${CLAUDE_PLUGIN_ROOT}` — the files resolve only repo-relative
`spec/` paths and the `specloop` CLI — so a plain copy works, and committing
`.claude/` onboards every clone. Use `--skills none` to opt out, or
`--skills link` when developing specloop itself.

## Companion CLI

The `/spec-*` commands prefer the `specloop` bun CLI when it's on PATH
(`specloop check`, `specloop status`, `specloop goal-check`). Install it with
`bun add -g @khangtoh/specloop`. Without it, the commands fall back to reading and editing
the spec files directly.

See the repository root `README.md` and `docs/methodology.md` for the full
method.


## Decision reconciliation and project hooks

Every skill and command includes the same reconciliation contract, including
work outside `/spec-loop`. `specloop init --agent claude|codex|both` and
`upgrade --apply` install project hooks with the shared runner in
`.specloop/hooks/reconcile.mjs`. Codex skills go in `.agents/skills`;
Claude retains `.claude/skills` and `.claude/commands`.

`refresh --agent both` previews safe updates; add `--apply` to install them.
Custom assets require manual merges. Ledger history is never overwritten.
The marketplace plugin provides skills/commands; use the CLI project install
for the reconciliation hooks. Installing files does not establish runtime
trust or activation. See `docs/decision-reconciliation.md` in the package.

Codex and Claude native goal shorthand: `/goal specloop loop` works across all outstanding
phases until every task and applicable index acceptance has verified evidence
and required checks pass. It reports genuine blockers as partial, never done.
Ordinary `$specloop loop` (Codex) and `/specloop loop` (Claude) retain their default scope. This requires the updated
skill/instructions; `/goal` itself is provided by the host runtime.

Skill coordination is available during applicable work: skills declare optional
relationships, and the configured spec directory's skill-coordination.md can add
project integrations and scoped ownership decisions. The shared
[coordination workflow](skills/specloop/references/coordination.md) checks
guidance/result readiness, conflicts, cycles and handoff evidence. It does not
start a loop or turn a menu request into work.
