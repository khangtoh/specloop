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

## Companion CLI

The `/spec-*` commands prefer the `specloop` bun CLI when it's on PATH
(`specloop check`, `specloop status`, `specloop goal-check`). Install it with
`bun add -g @khangtoh/specloop`. Without it, the commands fall back to reading and editing
the spec files directly.

See the repository root `README.md` and `docs/methodology.md` for the full
method.
