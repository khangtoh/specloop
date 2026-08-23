# Repository Agent Instructions

This repository uses the **specloop** methodology: a spec is a set of numbered
phase files under `spec/`, each a flat checklist of atomic tasks, driven by an
agent loop that picks up the next unchecked box, verifies it, and hands off in
a mandatory report format.

## Mandatory spec completion handoff

All coding, documentation, review, and scheduled agents working in this
repository **must** follow
[`spec/spec-summary-status.md`](spec/spec-summary-status.md).

Before reporting a task complete—or closing a task after partial, blocked,
implementation, or documentation progress—the final handoff must include a
section named exactly `Spec Summary/Status`. Use the prescribed phase and
component/deliverable tables, calculate progress from current spec checkboxes,
and include the required `Overall`, `Evidence`, and `Change state` lines.

Update affected spec checkboxes, Findings/Results, the phase index
(`spec/README.md`), and the session ledger (`spec/agent-session-ledger.md`)
first when the canonical completion procedure requires those changes. Never
infer completion from code or prose when checklist evidence can be inspected
directly.

## The loop

Work in priority order — `spec/BACKLOG.md` ranks the phases, `Depends on:` gates,
and task tags order the boxes within a phase:

1. Take the highest `spec/BACKLOG.md` phase whose `Depends on:` line is
   satisfied, and within it the highest-priority unchecked `- [ ]` task —
   `(p1)` high, `(p2)`/untagged medium, `(p3)` low, then task position. So
   **BACKLOG order picks the phase; `(pN)` picks the box.** Reprioritize phases
   with `specloop prio-spec <NN> <pos>` and tasks with `specloop prio-task
   <NN.T>` (or edit the tags/BACKLOG by hand). `specloop status` and `specloop
   list-spec` print the order. (No `BACKLOG.md` → numeric phase order.)
2. Do it. Verify it in proportion to risk.
3. Check the box, update Findings/Results, and reconcile `spec/README.md`'s
   phase-table progress/status for that phase.
4. Append `spec/agent-session-ledger.md` if the session changed a decision,
   completed material work, or left a resume point.
5. Produce the `Spec Summary/Status` handoff. Commit.
6. Repeat until the goal's acceptance checkbox in `spec/README.md` is checked
   with live evidence recorded.

## Structural enforcement

Run `specloop check` (or `bun run check:spec`) before handing off. It fails
when the layout drifts from the template: missing process files, phase files
without `Goal:`/`Depends on:`, malformed task lines, or a `README.md`
phase-table row whose progress/status disagrees with the phase file it points
to. Keep it green.
