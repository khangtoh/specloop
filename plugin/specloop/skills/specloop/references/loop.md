# Execute spec work

An explicit `loop [phase]` action authorizes execution under the repository's
run contract. It is distinct from submitting the bare skill for a menu.
Plan Mode still permits planning only; never edit while that mode is active.

In Codex or Claude, native `/goal specloop loop` is an explicit **all-specs run**. When
the active native goal condition is `specloop loop`, interpret it as: complete
all outstanding numbered-phase tasks, including grouped sub-specs, verify
applicable index acceptance, and pass required checks. State this expanded
completion condition in the conversation so native goal progress can be assessed.
This goal need not match the index's existing goal text. Follow BACKLOG order
and dependency gates across phases; do not stop after one phase or an earlier
index acceptance while phase tasks remain. Recount live checkboxes at the end;
zero unchecked phase tasks, evidence-backed applicable acceptance, and passing
checks are required for success. If no eligible work remains but unchecked
tasks do, report the dependency or external blocker and resume point, not
completion. Do not check, delete, or waive tasks merely to finish the goal.
The host runtime owns `/goal`; do not install a competing command. Mentioning or asking
about this syntax does not start a run. Ordinary loop defaults remain intact.
In Codex, reuse the active native goal; do not create a duplicate or replace
its objective to expand the shorthand. Follow the native goal tools' rules
for completion, blocking, pausing, and user-specified budgets. Mark the native
goal complete only after the all-specs completion evidence above is recorded.
A runtime budget/usage limit or interruption is not successful completion.

1. Read the phase index, ledger, relevant specs, and reporting standard. Run
   `specloop status` to inspect the live work order and checkbox counts.
2. Choose run scope: the native all-specs goal above spans all phases. Otherwise, an explicit phase focuses on that phase (respect its
   dependencies). Otherwise, an active goal mapped to the index acceptance
   checkbox is a goal run; without one, choose the highest-priority eligible
   phase as a standard run. Do not silently choose a different phase if the
   requested phase is absent or blocked; report the missing phase/dependency.
3. Write the advisory run-state record at start, after completed tasks, and
   when paused, blocked, or ended. Never treat it as completion evidence.
4. Select the highest BACKLOG phase allowed by scope and dependencies, then
   its highest-priority unchecked box: p1, p2/untagged, p3, then position.
5. Implement the task and verify proportionally to risk. Check only evidence-
   supported tasks; update Findings/Results, index counts, and session ledger.
   Run `specloop check`, commit the verified work, and continue selection.
6. For an all-specs run, continue until the expanded completion condition above
   is verified. Otherwise continue until the scoped phase is fully verified (focused/standard run)
   or the mapped goal acceptance checkbox is checked with recorded evidence
   (goal run). A user stop or genuine external blocker also ends the run;
   name a missing decision/external state and resume point for a blocker.
   Do not stop for another trigger at a task boundary. A status question gets
   a concise answer and the run continues. Honor explicit narrower user scope.
7. At the terminal condition, produce the mandatory Spec Summary/Status
   handoff with recounted phase/component tables and Overall, Evidence, and
   Change state. Report partial work honestly when acceptance remains open.
