# specloop

**Spec-driven loop engineering** — a repeatable, enforceable construct for
driving agents through a project, extracted so it's consistent across
every repo you use it in.

A goal is decomposed into **numbered phase specs**, each a flat checklist of
atomic tasks. An **agent loop** executes the next unchecked box, verifies it,
and hands off in a **mandatory report format**. A **bun validator** enforces the
directory structure so it can't silently drift, and a **goal-completion-check**
prompt audits whether a goal is actually met — by tracing it through
requirements → specs → checkboxes, not vibes.

It installs as a **Claude Code plugin**, a **Codex plugin**, and a standalone
**bun CLI**. The same `template/` directory is what the CLI scaffolds, what the
validator checks against, and what you inspect to learn the method.

---

## What you get

| Piece | What it is |
|---|---|
| `spec/README.md` | Phase index — the goal, the `# \| File \| Purpose \| Status \| Blocking dependency` table, and non-goals. |
| `spec/BACKLOG.md` | The ranked **work order** — one line per phase; the loop takes the top. Stores order only; done-state is derived. `prio-spec` edits it. |
| `spec/NN-title.md` | A phase — `Goal:` + `Depends on:` header, flat `- [ ]` / `- [x]` atomic tasks, and a dated `Findings / Results` log. |
| `spec/spec-summary-status.md` | The mandatory `Spec Summary/Status` handoff every agent must emit. |
| `spec/goal-completion-check.md` | A reusable prompt tracing a goal → requirements → specs → checkboxes. |
| `spec/agent-session-ledger.md` | A dated narrative log of what each session did and left running. |
| `AGENTS.md` | Binds all agents in the repo to the reporting standard and the loop. |
| `.specloop.json` | Validator config. |

## Architecture: three layers

specloop's constructs group into three layers, each answering one question. The
validator (`specloop check`) sits underneath all three, keeping every derived
fact (counts, status, done-state) honest so no layer drifts from reality.

| Layer | Question | Constructs |
|---|---|---|
| **Scheduling** | what to do next | `BACKLOG.md` (stored order) + phase files/tasks (units) + `prio-spec`/`list-spec` (phase priority) + `(pN)`/`prio-task` (task priority) |
| **Verification** | is it right / is it done | `spec-summary-status` (per-iteration handoff) + `goal-completion-check` (whole-goal gate & stop condition) |
| **Memory** | what happened | `agent-session-ledger` (narrative continuity) |

The scheduling layer is *forward state* (what's next), memory is *backward
state* (what happened), and verification is *derived truth* read straight from
the checkboxes. **Order is stored and human-owned (BACKLOG); done-state is always
derived** from the checkboxes — so priority is cheap to change and can't drift.
See [`docs/roadmap-0.3.0.md`](docs/roadmap-0.3.0.md) for how the layers fit.

## Install

### As a bun CLI

```bash
bun add -g @khangtoh/specloop   # or: bun add -d @khangtoh/specloop  (per project)
specloop init              # scaffold spec/ into the current repo
```

Zero runtime dependencies — the CLI is plain TypeScript run by bun.

`init` also installs the `specloop` skill and the `/spec-*` commands into the
repo's `.claude/` directory, so a fresh clone onboards its agent with no
separate plugin install. Commit them and the whole team gets the loop. Control
it with `--skills`:

| `--skills` | Effect |
|---|---|
| `copy` (default) | Copy the skills and commands into `.claude/` — self-contained and committable. |
| `link` | Symlink them into a local specloop checkout, for developing specloop itself. |
| `none` | Scaffold `spec/` only and leave `.claude/` alone. |

Existing files are never clobbered; `--force` restores them to the shipped
version. Restart the agent session after an install to pick the assets up.

### As a Claude Code plugin

```
/plugin marketplace add khangtoh/specloop
/plugin install specloop@specloop
```

Adds the `/spec-init`, `/spec-loop`, `/spec-status`, `/goal-check`, `/prio-spec`,
`/list-spec`, and `/spec-upgrade` slash commands plus the `specloop` skill.

This is the *user-wide* install. It is optional: `specloop init` and `specloop
upgrade --apply` already place the same skill and commands in the repository's
own `.claude/` directory, which is what makes a cloned project work for
everyone on it rather than only for whoever installed the plugin.

### As a Codex plugin

The same package ships a `.codex-plugin/` manifest and the `specloop` skill.
Install it from the specloop marketplace, or vendor `plugin/specloop/` into your
Codex plugins directory. The `AGENTS.md` scaffolded by `specloop init` is what
binds Codex agents to the loop.

## Use

```bash
specloop init                       # 1. scaffold the structure (incl. BACKLOG.md + .claude/)
# edit spec/README.md: set the goal, decompose into spec/NN-*.md phases
specloop check                      # 2. validate structure (wire into CI/prebuild)
specloop list-spec                  # 3. see the ranked backlog (undone by default)
specloop prio-spec 07 0             #    move phase 07 to the top of the work order
specloop goal-check "X is done"     # 4. audit a goal before you ship it
```

### Priority — two levels that compose

**`prio-spec` picks the phase; `(pN)`/`prio-task` picks the box within it.**

- **Phase order** lives in `spec/BACKLOG.md` (top = next). Reorder it with
  `specloop prio-spec <NN> <pos>` (`0` = top, `+N` up, `-N` down among incomplete
  phases). `specloop list-spec [all|done|undone]` renders it.
- **Task order** within a phase is a tag after the checkbox — `- [ ] (p1) do the
  thing` (p1 high, p2/untagged medium, p3 low). Raise one with
  `specloop prio-task <NN.T> [--to pN]`.

```bash
specloop prio-spec 22 0             # phase 22 to the top of the backlog
specloop prio-task 07.3 --to p1     # phase 07's 3rd task to high
```

BACKLOG stores **order only**; done-state is always **derived** from the
checkboxes, so nothing can drift. Priority never overrides a phase's `Depends
on:` gating. `specloop check` keeps BACKLOG and the phase files consistent and
flags a mistyped tag like `(p4)`.

Then run the loop (with an agent): take the top BACKLOG phase whose `Depends on:`
is satisfied and its highest box → do it → verify → check it → update Findings,
the index, and the ledger → `specloop check` → emit the `Spec Summary/Status`
handoff → commit → repeat. In Claude Code / Codex that's `/spec-loop`.

### Autonomous agent runs

Sending exactly `specloop` authorizes an autonomous agent-session run. With an
active goal that maps to the acceptance checkbox in `spec/README.md`, it works
across eligible phases until that checkbox has recorded evidence. Without a goal,
it completes the highest-priority eligible numbered phase. It ends only when the
acceptance condition is met, the user directly interrupts it, or a genuine
blocker names the missing decision or external state and a resume point.

Use a direct instruction to stop. `specloop help` is informational and does not start a run. `specloop start`, `specloop run`, and `specloop go` are rejected
aliases; only the exact message starts or resumes the agent-session run. This is
not the shell CLI: use `specloop help` in a terminal for CLI help.

The optional `spec/specloop-run-state.md` is an advisory resume record. It is
scaffolded by `init` and offered by `upgrade --apply`, but it is not required
by `specloop check`; completion always comes from the phase checkboxes.

### Adopt an existing project

`specloop upgrade [dir]` inspects a project that already has a spec model
(dillinger-style phases, an omarchy-style backlog, or ad-hoc numbered specs),
reports what it found, and — with `--apply` — non-destructively scaffolds the
missing specloop pieces: process files, `AGENTS.md`, config, a generated
`BACKLOG.md`, a generated `spec/README.md` phase index whose per-phase progress
and status emoji are derived from the existing checkboxes, and the same
`.claude/` skills and commands `init` installs (`--skills` applies here too).
An adopted repo passes `specloop check` immediately. Re-authoring PRD-style
specs into atomic-task phases is agent work: `/spec-upgrade`.

## `specloop check` — what it enforces

- `spec/` and the required process files exist.
- Every `NN-*.md` phase file has a `Goal:` and a `Depends on:` line.
- Task lines are well-formed `- [ ]` / `- [x]` checkboxes (malformed ones are
  flagged, code fences ignored).
- Every phase file is listed in the index, and no index row is an orphan.
- Each index row's `checked/total` **and** status emoji match the real counts
  in the phase file it links to (`⛔ blocked` is respected as a human override).
- `BACKLOG.md` lists every phase exactly once, with no orphan or duplicate
  entries (and warns when it's absent, falling back to numeric order).
- `AGENTS.md` references the reporting standard.

Non-zero exit on any error, so it gates CI and prebuild.

## Why the ceremony

The value isn't the checkboxes — it's that "done" is defined by an inspectable
checklist, not a summary; that status is **counted**, not asserted; that the
handoff format makes partial and blocked work legible instead of rounded up to
"done"; and that the structure is machine-enforced so it survives many sessions
and many agents. See [`docs/methodology.md`](docs/methodology.md).

## Development

```bash
bun test            # validator + parser unit tests
bun run check:spec  # run the validator against the shipped template
bun run check:self  # validate specloop's own self-hosted spec/
bun run typecheck   # tsc --noEmit
```

## Releasing

One command promotes and publishes a new version:

```bash
bun run release              # patch  (x.y.Z)
bun run release minor        # minor  (x.Y.0)
bun run release major        # major  (X.0.0)
bun run release patch --dry  # rehearse: verify + preview, no publish/push
```

`scripts/release.sh` runs the whole flow in order and is **safe by
construction** — it verifies before it bumps, and it touches git only after the
publish succeeds:

1. **Preconditions** — must be on `main` with a clean working tree.
2. **Verify** — `bun test`, `check --dir template`, `check --dir .` (and
   `typecheck` when `node_modules` is present). A broken build never ships.
3. **Bump** `package.json` only (no git yet).
4. **`npm publish`** (uses the token in your project `.npmrc`).
5. **Only after a successful publish** — commit `release: vX.Y.Z`, tag it, and
   `git push --follow-tags origin main`.

Because the bump isn't committed until the publish lands, a failed publish never
leaves a tagged, unpublished version — discard the uncommitted bump and retry.
The CLI reads its version from `package.json`, so `specloop version` always
matches the published release.

## License

MIT
