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

### As a Claude Code plugin

```
/plugin marketplace add khangtoh/specloop
/plugin install specloop@specloop
```

Adds the `/spec-init`, `/spec-loop`, `/spec-status`, `/goal-check`, `/prio-spec`,
`/list-spec`, and `/spec-upgrade` slash commands plus the `specloop` skill.

### As a Codex plugin

The same package ships a `.codex-plugin/` manifest and the `specloop` skill.
Install it from the specloop marketplace, or vendor `plugin/specloop/` into your
Codex plugins directory. The `AGENTS.md` scaffolded by `specloop init` is what
binds Codex agents to the loop.

## Use

```bash
specloop init                       # 1. scaffold the structure (incl. BACKLOG.md)
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

Sending exactly `specloop` is also an autonomous execution command. With an
active goal that maps to the acceptance checkbox in `spec/README.md`, it runs
across phases until the goal has recorded evidence. Without one, it completes
the highest-priority eligible numbered phase. It pauses only for a real blocker
or a new user instruction; `specloop help` is help, not a run command.

### Adopt an existing project

`specloop upgrade [dir]` inspects a project that already has a spec model
(dillinger-style phases, an omarchy-style backlog, or ad-hoc numbered specs),
reports what it found, and — with `--apply` — non-destructively scaffolds the
missing specloop pieces (process files, `AGENTS.md`, config, and a generated
`BACKLOG.md`). Re-authoring PRD-style specs into atomic-task phases is agent
work: `/spec-upgrade`.

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
bun run typecheck   # tsc --noEmit
```

## License

MIT
