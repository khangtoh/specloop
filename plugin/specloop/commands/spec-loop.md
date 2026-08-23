---
description: Run the specloop loop — pick the next unchecked spec box, do it, verify, check it, hand off, commit, repeat.
argument-hint: "[phase number to focus on, or blank for next available]"
---

You are running the **specloop loop** for this repository. The spec lives under
`spec/` and is governed by `spec/spec-summary-status.md` (the mandatory reporting
standard) and `AGENTS.md`. Follow this loop exactly; do not shortcut it.

## 0. Orient

1. Read `spec/README.md` (the phase index), `spec/agent-session-ledger.md` (what
   the last session left running), and `spec/spec-summary-status.md` (the handoff
   format). Run `specloop status` to see live checkbox counts.
2. If the user passed a phase number in `$ARGUMENTS`, focus on that phase.
   Otherwise select the **highest-priority unchecked `- [ ]` task among phases
   whose `Depends on:` line is satisfied**. Priority tags sit just after the
   checkbox — `(p1)` high, `(p2)` medium, `(p3)` low; an untagged task is
   medium. Break ties by lowest phase number, then task position. `specloop
   status` prints this next box. Do not skip ahead past an unmet dependency —
   priority reorders the *eligible* frontier, it never overrides `Depends on:`.

## 1. Do one box

3. State which single task you are taking and from which phase.
4. Implement it. Keep the change scoped to that one atomic task — resist
   bundling several boxes into one edit unless they are genuinely inseparable.
5. **Verify in proportion to risk**: run the build/tests/linters that prove it,
   or the manual check its acceptance language demands. Capture the evidence.

## 2. Record truthfully

6. Check the box (`- [x]`) **only if** its acceptance language is actually
   satisfied. If it is partially done or blocked, leave it unchecked and say so.
7. Add or update the phase's dated `Findings / Results` entry with what you did
   and how you verified it.
8. Reconcile `spec/README.md`'s phase-table row for this phase: update the
   `checked/total` progress and the status emoji (✅/🟡/⬜/⛔).
9. Append a `spec/agent-session-ledger.md` entry if this session changed a
   decision, completed material work, or left a resume point.
10. Run `specloop check`. It must exit clean — fix any structural drift it
    reports before handing off.

## 3. Hand off

11. Produce the mandatory `Spec Summary/Status` section per
    `spec/spec-summary-status.md`: the `Phase | Scope | Progress | Status`
    table for every affected phase, the component/deliverable table when a
    named deliverable changed, and the `Overall` / `Evidence` / `Change state`
    closing lines. Derive every count from the actual checkboxes, never from
    memory or a prior report.
12. Commit with a message naming the phase and task.

## 4. Loop

13. Repeat from step 2's selection unless: the user scoped you to one task, a
    box is blocked on an external dependency (report it), or the goal's
    acceptance checkbox in `spec/README.md` is now checked with live evidence.

Never mark a task or phase complete because code was written — only because its
checkbox's acceptance condition is met and verified.
