---
description: Reprioritize a phase in the specloop BACKLOG — move it up/down or to the top of the work order.
argument-hint: <NN> <pos>
---

Reprioritize a phase in `spec/BACKLOG.md`. Arguments: `$ARGUMENTS` (`<NN> <pos>`).

- `NN` = the phase id (the number prefix of `spec/NN-*.md`).
- `pos` = signed move within the **incomplete** phases: `0` → top, `+N` → up N,
  `-N` → down N. Complete phases (all tasks checked) stay anchored.

If `specloop` is on PATH, just run `specloop prio-spec $ARGUMENTS` — it moves the
single line, derives done-state from the phase files, and prints the new order.

Otherwise do it by hand: in `spec/BACKLOG.md`, under `## Phases (priority order)`,
move only phase `NN`'s line to the new position among the incomplete entries
(a phase is complete when its `spec/NN-*.md` has every `- [ ]` checked). Change
nothing else — no other line's text, no phase file, no ids. Then show the result
with `/list-spec`.

BACKLOG stores **order only**; done-state is always derived from the checkboxes.
Reprioritizing never edits a phase file.

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
