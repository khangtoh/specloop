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

## Decision reconciliation — every session

Before any work, including direct user requests outside `/spec-loop`, and after
resumption or compaction, read `spec/agent-session-ledger.md` and the relevant
authoritative specs. Compare incoming instructions with applicable decisions.
Follow instruction precedence: a clear user override of a project decision
needs no repeated permission; clarify genuinely ambiguous conflicts.

Before dependent implementation, append a dated entry to the existing ledger:

- **Previous decision:** what was decided and its source.
- **Conflicting instruction:** what changed and its source.
- **Resolution:** what survives, what is superseded, and why.
- **Scope and consequences:** affected requirements, tasks, and remaining work.

Then update the authoritative spec and add a supersession reference. Never
rewrite ledger history or undo completed historical checkboxes. Do not create
a separate decision ledger. Append a session entry for ordinary material work
or a meaningful resume point; read-only questions need no ledger churn.
In Plan Mode, review and describe pending reconciliation without mutating
project files; record the resolution when implementation is authorized.
Hooks remind and check file changes; semantic reconciliation remains the
agent's responsibility even when hooks are unavailable or a check passes.
