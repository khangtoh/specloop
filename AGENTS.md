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

## `specloop` execution command

When the user sends exactly `specloop`, start or resume autonomous execution.
It is an authorization to continue; do not stop after a checkbox merely to wait for another `specloop` message. Keep the user informed in commentary and
use the mandatory final handoff only at the run's terminal condition.

### Run scope — the trigger grammar

The trigger takes an optional scope argument. `goal` is an optional keyword that
asks for the host's `/goal` to be set as well (see **Prefer the host's `/goal`**);
it never changes which phases are in scope:

| Message | Scope |
|---|---|
| `specloop` / `specloop goal` | **Standard run** — the highest-priority eligible phase from `spec/BACKLOG.md`, worked until every one of its unchecked tasks is done. |
| `specloop loop` / `specloop goal loop` | **Loop run** — every eligible phase, in BACKLOG order, until no eligible unchecked task remains. |
| `specloop 1,2,3` / `specloop goal 1,2,3` | **Scoped run** — exactly phases 01, 02, 03, in BACKLOG order, each until complete. |

A phase is **eligible** when its `spec/README.md` status cell is not `⛔ blocked`
and its `Depends on:` line is satisfied. Skip every ineligible phase and come
back to it once it clears; a skipped phase never holds a run open. In a loop run,
after the last eligible phase is complete, check the acceptance checkbox in
`spec/README.md` and record its live evidence if the goal is now met.

`specloop start`, `specloop run`, and `specloop go` are not run triggers; ask the user to confirm
with the exact command instead. An argument that is neither `loop` nor a phase
list is not a trigger either — ask which scope was meant.

### Prefer the host's `/goal`

Claude Code and Codex both ship a native `/goal`: a persistent completion
condition that keeps the session working across turns, judged after every turn
(by an independent evaluator in Claude Code, by `update_goal` in Codex). Prefer
it over driving the loop from this contract alone, because it survives turn
boundaries that prose cannot.

On any run trigger above:

1. Run `specloop goal <target> --start` — it prints the condition for that scope
   and records the scope in `spec/specloop-run-state.md`, arming the Stop hook.
2. Set the host goal to that condition (`/goal <condition>`), or tell the user
   the exact `/goal` line to paste when you cannot set it yourself.
3. Work the loop. **Every turn, run `specloop status` and `specloop check` and
   show their output.** Claude Code's evaluator reads only what is in the
   transcript — it runs no commands and opens no files — so unprinted progress
   is invisible to it and a goal can be judged met on nothing.
4. On Codex, call `update_goal` only with the checkbox counts quoted. Never
   report progress from impression.

When the host has no `/goal` (an older version, a different runner, `/goal`
disabled by `disableAllHooks`), fall back to this contract's own autonomy rules
below — they still fully define a run.

### Run-state and continuation

Write `spec/specloop-run-state.md` when a run starts, after each completed task,
and when it pauses, blocks, or ends. The record is advisory, not evidence:
completion is always derived from the checkboxes. Its `Run scope:` field is the
exception that carries weight — the specloop Stop hook reads it to learn which
phases are in scope, and stays inert unless `Run status:` is `active`. Set
`Run status: idle` when a run ends, or the hook keeps blocking.

In every mode, pause only for a genuine blocker requiring user input or an
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
