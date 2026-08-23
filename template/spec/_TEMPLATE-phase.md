# Phase NN — <Short phase title>

Goal: <one or two sentences describing the concrete outcome this phase
produces, in terms a reviewer could accept or reject>.

Depends on: <Phase MM decisions locked | None (design only) | external
dependency>.

<!--
  Rules for this file (enforced by `specloop check`):
  - Every task is a flat, atomic checkbox: `- [ ]` unchecked / `- [x]` done.
  - An atomic task should be completable and verifiable in one short sitting.
  - Do not nest sub-checklists as the unit of completion; use indented plain
    text under a task for detail, not more checkboxes.
  - Optional priority tag right after the checkbox: `- [ ] (p1) task…`
    (p1 high, p2 medium, p3 low; untagged = medium). Within a phase the loop
    takes the highest-priority box first. Raise one with `specloop prio-task`
    (phase order itself is set in `BACKLOG.md` via `specloop prio-spec`).
  - Check a box only once the task is actually done and, where applicable,
    verified. Record how it was verified inline or in a Findings entry.
  - The `Goal:` and `Depends on:` lines above are REQUIRED and must be the
    first non-heading lines of the file.
-->

- [ ] First atomic task. State the acceptance condition plainly so "done"
      is unambiguous.
- [ ] Second atomic task.
- [ ] Third atomic task. When done, note verification inline, e.g.
      "Done: `npm test` green, 42/42."

## Findings / Results

<!--
  Add a dated entry here when the phase requires evidence of completion,
  a decision was made, or a task was closed with a caveat. This is the
  evidence the reporting standard and goal-completion-check read.
-->

- _YYYY-MM-DD_ — <what was done / decided / verified, with commands or
  links that prove it>.
