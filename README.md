# specloop

**Spec-driven loop engineering** — a repeatable, enforceable construct for
driving coding agents through a project, extracted so it's consistent across
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
| `spec/NN-title.md` | A phase — `Goal:` + `Depends on:` header, flat `- [ ]` / `- [x]` atomic tasks, and a dated `Findings / Results` log. |
| `spec/spec-summary-status.md` | The mandatory `Spec Summary/Status` handoff every agent must emit. |
| `spec/goal-completion-check.md` | A reusable prompt tracing a goal → requirements → specs → checkboxes. |
| `spec/agent-session-ledger.md` | A dated narrative log of what each session did and left running. |
| `AGENTS.md` | Binds all agents in the repo to the reporting standard and the loop. |
| `.specloop.json` | Validator config. |

## Install

### As a bun CLI

```bash
bun add -g specloop        # or: bun add -d specloop  (per project)
specloop init              # scaffold spec/ into the current repo
```

Zero runtime dependencies — the CLI is plain TypeScript run by bun.

### As a Claude Code plugin

```
/plugin marketplace add specloop/specloop
/plugin install specloop@specloop
```

Adds the `/spec-init`, `/spec-loop`, `/spec-status`, and `/goal-check` slash
commands plus the `specloop` skill.

### As a Codex plugin

The same package ships a `.codex-plugin/` manifest and the `specloop` skill.
Install it from the specloop marketplace, or vendor `plugin/specloop/` into your
Codex plugins directory. The `AGENTS.md` scaffolded by `specloop init` is what
binds Codex agents to the loop.

## Use

```bash
specloop init                       # 1. scaffold the structure
# edit spec/README.md: set the goal, decompose into spec/NN-*.md phases
specloop check                      # 2. validate structure (wire into CI/prebuild)
specloop status                     # 3. see progress read from the checkboxes
specloop goal-check "X is done"     # 4. audit a goal before you ship it
```

Then run the loop (with an agent): pick the next unchecked box in the
lowest-numbered phase whose `Depends on:` is satisfied → do it → verify → check
it → update Findings, the index, and the ledger → `specloop check` → emit the
`Spec Summary/Status` handoff → commit → repeat. In Claude Code / Codex that's
`/spec-loop`.

## `specloop check` — what it enforces

- `spec/` and the required process files exist.
- Every `NN-*.md` phase file has a `Goal:` and a `Depends on:` line.
- Task lines are well-formed `- [ ]` / `- [x]` checkboxes (malformed ones are
  flagged, code fences ignored).
- Every phase file is listed in the index, and no index row is an orphan.
- Each index row's `checked/total` **and** status emoji match the real counts
  in the phase file it links to (`⛔ blocked` is respected as a human override).
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
