# specloop (plugin)

The specloop plugin for **Claude Code** and **Codex**. Same package, two
manifests (`.claude-plugin/` and `.codex-plugin/`), one shared skill.

## Commands

| Command | Purpose |
|---|---|
| `/spec-init <goal>` | Scaffold `spec/` into the repo and decompose a goal into phase specs. |
| `/spec-loop [phase]` | Run the loop: do the next unchecked box, verify, check it, hand off, commit, repeat. |
| `/spec-status [phase]` | Report phase status from the actual checkboxes in the mandatory format. |
| `/goal-check <goal>` | Audit whether a goal is truly met by tracing it through the spec chain. |

## Skill

`specloop` — activates when working in a specloop repo or when the user mentions
phase specs, the loop, the `Spec Summary/Status` handoff, goal-completion-check,
or the session ledger.

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
