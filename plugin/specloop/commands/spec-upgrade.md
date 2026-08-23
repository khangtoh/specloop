---
description: Adopt an existing project's spec model into specloop — scaffold the structure, then re-author specs into atomic-task phases.
argument-hint: "[dir]"
---

Adopt the spec model in `$ARGUMENTS` (default: this repo) into specloop. The CLI
handles the mechanical parts; you handle the semantic mapping.

## 1. Inspect and scaffold (mechanical)

Run `specloop upgrade $ARGUMENTS` to see the detected model and adoption plan,
then `specloop upgrade $ARGUMENTS --apply` to scaffold non-destructively: it adds
the missing process files (`spec-summary-status.md`, `goal-completion-check.md`,
`agent-session-ledger.md`), an `AGENTS.md` binding, a `.specloop.json`, and
generates `BACKLOG.md` from the existing numbered specs. It never overwrites
existing spec content. (If `specloop` isn't on PATH, copy those template files in
by hand.)

## 2. Re-author specs into phases (your judgment)

specloop phases are **flat checklists of atomic tasks**, not PRD prose. For each
existing spec that is PRD-style (`Summary/Problem/Scope/Acceptance Criteria`):

- Keep its number and slug (`NN-<slug>.md`) — ids are stable.
- Add a `Goal:` line (one verifiable outcome) and a `Depends on:` line.
- Convert its **Acceptance Criteria / Deliverables** into `- [ ]` atomic tasks,
  each completable and verifiable in one short sitting. Preserve the PRD prose
  above the checklist if useful; the checklist is what the loop executes.
- Mark already-satisfied criteria `- [x]` only with real evidence.

## 3. Reconcile order and validate

- Put the phases in `BACKLOG.md` in the intended work order (use `/prio-spec`).
- Ensure every phase is in both `BACKLOG.md` and the `README.md` index.
- Run `specloop check` until clean.
- Hand off with the `Spec Summary/Status` section.

Do not delete the original specs' intent — you are translating them into the
executable checklist form, not discarding their requirements.
