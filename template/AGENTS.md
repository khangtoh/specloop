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

Work the next unchecked box in phase order, respecting each phase's
`Depends on:` line:

1. Pick the next unchecked `- [ ]` task in the lowest-numbered phase whose
   dependencies are satisfied.
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
