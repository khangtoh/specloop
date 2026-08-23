---
name: spec-upgrade
description: Adopt an existing project's spec model into specloop. Use when the user asks to upgrade/adopt/migrate/convert a project into specloop, or to bring an existing spec, backlog, or PRD-style spec set under the specloop model.
---

# spec-upgrade

Adopt an existing project's spec model into specloop. The CLI does the mechanical
scaffolding; you do the semantic mapping.

## 1. Inspect and scaffold (mechanical)

Run `specloop upgrade [dir]` to see the detected model + plan, then
`specloop upgrade [dir] --apply` to non-destructively scaffold: missing process
files (`spec-summary-status.md`, `goal-completion-check.md`,
`agent-session-ledger.md`), an `AGENTS.md` binding, `.specloop.json`, and a
`BACKLOG.md` generated from the existing numbered specs. It never overwrites
existing content.

## 2. Re-author specs into phases (judgment)

specloop phases are flat checklists of atomic tasks, not PRD prose. For each
PRD-style spec (`Summary/Problem/Scope/Acceptance Criteria`):

- Keep its `NN-<slug>.md` id.
- Add a `Goal:` (one verifiable outcome) and `Depends on:` line.
- Convert Acceptance Criteria / Deliverables into `- [ ]` atomic tasks, each
  verifiable in one short sitting. Mark satisfied ones `- [x]` only with evidence.

## 3. Reconcile and validate

- Order the phases in `BACKLOG.md` (use the `prio-spec` skill).
- Ensure every phase is in both `BACKLOG.md` and the `README.md` index.
- Run `specloop check` until clean; hand off with `Spec Summary/Status`.

Translate the original specs' requirements into executable checklists — do not
discard their intent.
