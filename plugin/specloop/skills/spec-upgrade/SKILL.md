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
