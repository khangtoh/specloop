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
| `spec/BACKLOG.md` | The ranked **work order** — one line per phase; the loop takes the top. Stores order only; done-state is derived. `prio spec` edits it. |
| `spec/NN-title.md` | A phase — `Goal:` + `Depends on:` header, flat `- [ ]` / `- [x]` atomic tasks, and a dated `Findings / Results` log. |
| `spec/NN-title/` | A large phase as a folder: `README.md` (Goal/Depends on) plus `NNa-*.md`, `NNb-*.md` sub-specs. See [Phase layout](#phase-layout--one-file-or-a-folder-of-sub-specs). |
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
| **Scheduling** | what to do next | `BACKLOG.md` (stored order) + phase files/tasks (units) + `prio spec`/`list` (phase priority) + `(pN)`/`prio task` (task priority) |
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

`init` and `upgrade --apply` install project-local agent assets and reconciliation
hooks. Claude is the compatibility default; choose `--agent codex` or `--agent both`.
Commit the installed files so every clone receives them.

| Target | Skills / commands | Hook configuration |
|---|---|---|
| Claude | `.claude/skills`, `.claude/commands` | `.claude/settings.json` (merged) |
| Codex | `.agents/skills` | `.codex/hooks.json` (merged) |
| Shared | `AGENTS.md`, process contract | `.specloop/hooks/reconcile.mjs` |

`--skills copy` is the default. `link` symlinks skills/commands into a local
specloop checkout; package-cache sources fall back to copy. `none` skips agent
assets and hooks. `init --force` restores scaffold files and skills, but always
preserves existing ledger history. Hook configurations use safe merging even
with `--force`.

For existing installations, preview and apply a safe refresh:

```bash
specloop refresh --agent both
specloop refresh --agent both --apply
```

Refresh replaces only unchanged managed assets or byte-recognized shipped
assets from 0.5.0. Customized instructions, skills, symlinks, and hooks are
preserved and reported as `manual merge` (exit 2). Unrelated hooks and settings
survive. No ledger is ever replaced by refresh. The committed
`.specloop/managed-assets.json` records ownership hashes; it contains no session
history. Merge the reported instruction changes manually and rerun the preview.

Installed configuration does **not** establish active hooks. Review the runner
and hook definitions, approve runtime trust, restart the session, and inspect
`/hooks`. Bun must be on the runtime's PATH. See
[reconciliation and runtime acceptance](docs/decision-reconciliation.md) for
behavior, limitations, trust requirements and acceptance scenarios.

### As a Claude Code plugin

```
/plugin marketplace add khangtoh/specloop
/plugin install specloop@specloop
```

Adds the shared `specloop` skill and compatible legacy slash commands.
Project installs expose `/specloop` in Claude and `$specloop` in Codex.
Claude marketplace plugin skills use `/specloop:specloop`.

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
specloop list                       # 3. see the ranked backlog (undone by default)
specloop prio spec 07 0             #    move phase 07 to the top of the work order
specloop audit "X is done"           # 4. audit a goal before you ship it
```

### Priority — two levels that compose

**`prio spec` picks the phase; `(pN)`/`prio task` picks the box within it.**

- **Phase order** lives in `spec/BACKLOG.md` (top = next). Reorder it with
  `specloop prio spec <NN> <pos>` (`0` = top, `+N` up, `-N` down among incomplete
  phases). `specloop list [all|done|undone]` renders it.
- **Task order** within a phase is a tag after the checkbox — `- [ ] (p1) do the
  thing` (p1 high, p2/untagged medium, p3 low). Raise one with
  `specloop prio task <NN.T> [--to pN]`.

```bash
specloop prio spec 22 0             # phase 22 to the top of the backlog
specloop prio task 07.3 --to p1     # phase 07's 3rd task to high
```

BACKLOG stores **order only**; done-state is always **derived** from the
checkboxes, so nothing can drift. Priority never overrides a phase's `Depends
on:` gating. `specloop check` keeps BACKLOG and the phase files consistent and
flags a mistyped tag like `(p4)`.

Then run the loop (with an agent): take the top BACKLOG phase whose `Depends on:`
is satisfied and its highest box → do it → verify → check it → update Findings,
the index, and the ledger → `specloop check` → emit the `Spec Summary/Status`
handoff → commit → repeat. Use `/specloop loop` in Claude Code or `$specloop loop` in Codex.

### Agent command menu

Submit `$specloop` in Codex or `/specloop` in a Claude project to see the menu
as the agent's response. Append an action to execute it:

```text
$specloop list undone
$specloop prio spec 22 0
$specloop prio task 07.3 --to p1
$specloop audit "the checkout flow is done"
$specloop loop
```

Use the slash prefix instead in Claude. The menu lists `init`, `upgrade`,
`refresh`, `check`, `preflight`, `status`, `list`, `prio spec`, `prio task`,
`layout`, `group`, `audit`, `loop`, `help`, and `version`, with arguments and descriptions.
It performs no project work. `loop [phase]` is an agent action, not a shell
command; the shell's `audit` prints the audit prompt while the agent performs
it. Agent `init [goal]` decomposes a goal; shell `init [dir]` scaffolds files.
`upgrade`, `refresh`, and `group` preview changes unless `--apply` is supplied.

Old CLI names remain aliases: `list-spec`/`listspec`, `prio-spec`/`priospec`,
`prio-task`/`priotask`, and `goal-check`/`goalcheck`. Existing `/spec-*`,
`/goal-check`, `/prio-spec`, `/list-spec`, and `/spec-layout` agent commands remain available.

### Autonomous agent runs

Sending exactly `specloop` authorizes an autonomous agent-session run. With an
active goal that maps to the acceptance checkbox in `spec/README.md`, it works
across eligible phases until that checkbox has recorded evidence. Without a goal,
it completes the highest-priority eligible numbered phase. It ends only when the
acceptance condition is met, the user directly interrupts it, or a genuine
blocker names the missing decision or external state and a resume point.

Use a direct instruction to stop. `specloop help` is informational and does not start a run. `specloop start`, `specloop run`, and `specloop go` are rejected
aliases for plain messages. Explicit skill `loop [phase]` also starts a run,
with an optional phase focus that respects dependencies. This is
not the shell CLI: use `specloop help` in a terminal for CLI help.

The optional `spec/specloop-run-state.md` is an advisory resume record. It is
scaffolded by `init` and offered by `upgrade --apply`, but it is not required
by `specloop check`; completion always comes from the phase checkboxes.

### Phase layout — one file, or a folder of sub-specs

A phase is either a **flat file** or a **folder**; every command treats them the
same, and the phase keeps its number `NN` either way (so BACKLOG never changes).

```
spec/07-auth.md                  flat (default): one file, one checklist
spec/12-security/                grouped: a folder of sub-specs
  README.md                      root: Goal:, Depends on:, shared context
  12a-retire-static-keys.md      sub-specs, in name order; tasks only,
  12b-harden-ci.md               no Goal:/Depends on: needed
```

A grouped phase's progress is the **aggregate** of its root and sub-specs, and
task numbers run across the whole folder (`prio-task 12.30` may land in `12c`).
Keep phases flat until one gets unwieldy: many tasks, several independent
sections, or parallel agents that would otherwise edit one file at once.

```bash
specloop layout                  # per-phase layout + keep / group / flatten advice
specloop group 12                # dry run: proposed sub-specs, links to rewrite
specloop group 12 --apply        # move to spec/12-*/README.md (git mv), split each
                                 # task section into 12a-…, 12b-…, relink
specloop group 12 --no-split --apply   # just move the file into a folder
```

`group` refuses to write if the checkbox totals would change or the folder
already exists. It rewrites markdown links (inside the moved content and inbound
from `spec/` and `AGENTS.md`) and lists other files that still mention the old
path — scripts and prose are yours to update. `layout` only recommends grouping
unfinished phases (> 40 tasks, or > 25 tasks across 3+ sections of 3+ tasks) and
flattening a group with at most one sub-spec and ≤ 10 tasks; flattening is done
by hand. `upgrade` prints the same advice when adopting a project.

### Adopt an existing project

`specloop upgrade [dir]` inspects a project that already has a spec model
(dillinger-style phases, an omarchy-style backlog, or ad-hoc numbered specs),
reports what it found, and — with `--apply` — non-destructively scaffolds the
missing specloop pieces: process files, `AGENTS.md`, config, a generated
`BACKLOG.md`, a generated `spec/README.md` phase index whose per-phase progress
and status emoji are derived from the existing checkboxes, and the same
`.claude/` skills and commands `init` installs (`--skills` applies here too).
An adopted repo passes `specloop check` immediately. Re-authoring PRD-style
specs into atomic-task phases is agent work: `/specloop upgrade --apply` or
`$specloop upgrade --apply`.

## `specloop check` — what it enforces

- `spec/` and the required process files exist.
- Every phase has a `Goal:` and a `Depends on:` line — in `NN-*.md`, or in
  `NN-*/README.md` for a grouped phase (a numbered folder without a README is an
  error).
- Task lines are well-formed `- [ ]` / `- [x]` checkboxes (malformed ones are
  flagged, code fences ignored — in every sub-spec too).
- Every phase file is listed in the index, and no index row is an orphan.
- Each index row's `checked/total` **and** status emoji match the real counts
  in the phase it links to — aggregate for a folder, which may be linked as
  `NN-x/README.md` or `NN-x/` (`⛔ blocked` is respected as a human override).
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
