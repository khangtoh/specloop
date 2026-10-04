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

The plugin deliberately adds **no** `/goal` command of its own: Claude Code and
Codex both ship one. Feed theirs a specloop-derived condition instead — see
**Host `/goal`** below.

## Skill

`specloop` — activates when working in a specloop repo or when the user mentions
phase specs, the loop, the `Spec Summary/Status` handoff, goal-completion-check,
or the session ledger.

## Hooks

`hooks/hooks.json` registers one `Stop` hook, `hooks/specloop-stop.sh`. While a
specloop run is active it counts the real checkboxes and blocks the turn from
ending until the in-scope ones are done — the deterministic completion check a
transcript-only `/goal` evaluator cannot perform.

It is **inert unless `spec/specloop-run-state.md` records `Run status: active`**.
Plugin hooks fire in every session once the plugin is enabled, so an unarmed
specloop must never block unrelated work. It also needs the CLI on `PATH`, and
honours `stop_hook_active` so the host's eight-block cap still applies.

- Arm it: `specloop goal <target> --start`
- Release it: set `Run status: idle` in `spec/specloop-run-state.md`

## Host `/goal`

`specloop goal [loop | 1,2,3]` prints a completion condition derived from the
spec's own checkboxes, ready for `/goal` in Claude Code or Codex. The condition
names the commands that prove it (`specloop status`, `specloop check`) because
Claude Code's evaluator judges only what the agent printed in the transcript — it
runs no commands and opens no files.

The agent trigger takes the same scopes: `specloop`, `specloop loop`,
`specloop 1,2,3`, each optionally written with the `goal` keyword
(`specloop goal loop`) to ask for the host goal to be set too.

## Companion CLI

The `/spec-*` commands prefer the `specloop` bun CLI when it's on PATH
(`specloop check`, `specloop status`, `specloop goal`, `specloop goal-check`).
The `Stop` hook *requires* it. Install it with
`bun add -g @khangtoh/specloop`. Without it, the commands fall back to reading and editing
the spec files directly.

See the repository root `README.md` and `docs/methodology.md` for the full
method.
