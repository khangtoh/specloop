---
name: specloop
description: This skill should be used when working in a repository that uses the specloop methodology (a spec/ directory of numbered phase files driven by an agent loop), or when the user asks to "set up specloop", "scaffold a spec", "run the spec loop", "work the next spec box", "check spec status", "is this goal done", "validate spec structure", "spec-driven development for agents", or mentions phase checklists, the Spec Summary/Status handoff, goal-completion-check, or the agent session ledger.
version: 0.1.0
---

# Skill: specloop

specloop is a repeatable construct for driving agents through a project:
requirements are decomposed into **numbered phase specs**, each a flat checklist
of atomic tasks; an **agent loop** executes the next unchecked box, verifies it,
and hands off in a mandatory report format; and a **bun validator** enforces the
structure so it can't silently drift.

## The pieces

Under `spec/` in a specloop repo:

| File | Role |
|---|---|
| `README.md` | Phase index: the `# | File | Purpose | Status | Blocking dependency` table, the overarching goal, and non-goals. |
| `NN-title.md` | A phase: `Goal:` + `Depends on:` header, then flat `- [ ]` / `- [x]` atomic tasks, plus a dated `Findings / Results` log. |
| `spec-summary-status.md` | The mandatory `Spec Summary/Status` handoff format every agent must emit. |
| `goal-completion-check.md` | A reusable prompt that traces a goal → requirements → specs → checkboxes. |
| `agent-session-ledger.md` | A dated narrative log of what each session did and left running. |
| `AGENTS.md` (repo root) | Binds all agents to the reporting standard and the loop. |
| `.specloop.json` (repo root) | Validator config. |

## Core rules

- A task is **atomic**: completable and verifiable in one short sitting.
- The loop takes the **highest-priority** open box among dependency-eligible
  phases (ties → lowest phase, then position). A task may carry a tag right
  after the checkbox: `- [ ] (p1) …` (high) · `(p2)`/untagged (medium) ·
  `(p3)` (low). Raise one with `specloop upgrade <NN.T>`.
- Check a box **only** when its acceptance language is met and verified — never
  because code was written or a similar task was done nearby.
- Progress is `checked/total` counted from the actual boxes. Status emoji:
  ✅ complete · 🟡 partial · ⬜ not started · ⛔ blocked (blocked needs a named
  dependency).
- Every task handoff — complete, partial, or blocked — must include the
  `Spec Summary/Status` section.
- Keep `spec/README.md`'s phase table in sync with the phase files; the
  validator fails the build when they disagree.

## Commands

Slash commands (this plugin): `/spec-init`, `/spec-loop`, `/spec-status`,
`/goal-check`.

CLI (bun): `specloop init`, `specloop check`, `specloop status`,
`specloop upgrade <NN.T> [--to pN]`, `specloop goal-check "<goal>"`. Run
`specloop check` (or `bun run check:spec`) before every handoff and wire it
into CI/prebuild.

## How to work

1. **Setup** — `/spec-init` scaffolds `spec/` and decomposes the goal into phases.
2. **Execute** — `/spec-loop` runs the loop: pick the next unchecked box (lowest
   phase whose `Depends on:` is met) → do it → verify → check it → update
   Findings, the index, and the ledger → `specloop check` → emit
   `Spec Summary/Status` → commit → repeat.
3. **Audit** — `/goal-check "<goal>"` before telling anyone something ships;
   `/spec-status` for a current rollup.

Read `spec/spec-summary-status.md` in the target repo for the exact handoff
tables and closing lines; it is the source of truth for reporting.
