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
   with `specloop prio spec <NN> <pos>` and tasks with `specloop prio task
   <NN.T>` (or edit the tags/BACKLOG by hand). `specloop status` and `specloop
   list` print the order. (No `BACKLOG.md` → numeric phase order.)
2. Do it. Verify it in proportion to risk.
3. Check the box, update Findings/Results, and reconcile `spec/README.md`'s
   phase-table progress/status for that phase.
4. Append `spec/agent-session-ledger.md` if the session changed a decision,
   completed material work, or left a resume point.
5. Produce the `Spec Summary/Status` handoff. Commit.
6. Repeat until the goal's acceptance checkbox in `spec/README.md` is checked
   with live evidence recorded.

## `specloop` execution command

When the user sends exactly `specloop`, start or resume autonomous execution.
It is an authorization to continue; do not stop after a checkbox merely to wait for another `specloop` message. Keep the user informed in commentary and
use the mandatory final handoff only at the run's terminal condition.

Claude's native `/goal specloop loop` is an explicit **all-specs run**. When
the active native goal condition is `specloop loop`, interpret it as: complete
all outstanding numbered-phase tasks, including grouped sub-specs, verify
applicable index acceptance, and pass required checks. State this expanded
completion condition in the conversation so the goal evaluator can assess it.
This goal need not match the index's existing goal text. Follow BACKLOG order
and dependency gates across phases; do not stop after one phase or an earlier
index acceptance while phase tasks remain. Recount live checkboxes at the end;
zero unchecked phase tasks, evidence-backed applicable acceptance, and passing
checks are required for success. If no eligible work remains but unchecked
tasks do, report the dependency or external blocker and resume point, not
completion. Do not check, delete, or waive tasks merely to finish the goal.
Claude owns `/goal`; do not install a competing command. Mentioning or asking
about this syntax does not start a run. Ordinary loop defaults remain intact.

Choose the run scope before taking the next task (unless the all-specs goal above applies):

1. **Goal run:** when an active user, system, or agent goal maps to the goal
   and acceptance checkbox in `spec/README.md`, work across eligible phases
   until that acceptance checkbox is checked with recorded evidence.
2. **Standard run:** when no active goal is set, complete the highest-priority
   eligible numbered phase from `spec/BACKLOG.md`, including every unchecked
   task in that phase.

For plain chat messages, only the exact, unadorned message `specloop` triggers a run. `specloop start`, `specloop run`, and `specloop go` are not run triggers; ask the user to confirm
with the exact command instead.

Explicit skill invocation is a separate interface: `$specloop` in Codex and
`/specloop` in Claude project installs display the command menu without starting
work. Appending `loop [phase]` explicitly starts a run with the same scope and
terminal rules above; a supplied phase focuses the run on that phase while
respecting dependencies. Claude marketplace installs use `/specloop:specloop`.
Menu/help requests and unknown actions do not mutate project files or append
the ledger. Merely loading the skill implicitly is not a menu or run trigger.

Write `spec/specloop-run-state.md` when a run starts, after each completed task,
and when it pauses, blocks, or ends. The record is advisory, not evidence:
completion is always derived from the checkboxes.

In either mode, pause only for a genuine blocker requiring user input or an
external state change, or when the user sends a different instruction. A
direct user instruction supersedes the run immediately. A status question gets
a concise status answer and the run continues. A blocker must name the missing
decision or external state and leave a resume point. `specloop help` requests help only; it does not start or resume execution. Never claim completion
because of elapsed time, token budget, a checked box, or a phase boundary —
only the terminal conditions end a run. Do not stop at a task or phase boundary:
continue until a terminal condition is reached.

## Structural enforcement

Run `specloop check` (or `bun run check:spec`) before handing off. It fails
when the layout drifts from the template: missing process files, phase files
without `Goal:`/`Depends on:`, malformed task lines, or a `README.md`
phase-table row whose progress/status disagrees with the phase file it points
to. Keep it green.

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
