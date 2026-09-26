---
name: prio-spec
description: Reprioritize a phase in a specloop project's spec/BACKLOG.md. Use when the user asks to run prio-spec, reprioritize a phase/spec, move a phase up or down, or change the backlog work order.
---

# prio-spec

Reprioritize one **incomplete** phase in `spec/BACKLOG.md`. Arguments: `<NN> <pos>`.

- `NN` = phase id (prefix of `spec/NN-*.md`).
- `pos` = signed move among incomplete phases: `0` = top, `+N` = up N, `-N` = down N.
- Complete phases (all tasks in `spec/NN-*.md` checked) stay anchored.

Prefer the CLI: `specloop prio spec <NN> <pos>`. It moves the single line,
derives done-state from the phase files, and prints the new order.

If the CLI isn't available, edit `spec/BACKLOG.md` by hand: under
`## Phases (priority order)`, move only phase `NN`'s line to the target position
among the incomplete entries. Change nothing else — no other line, no phase file,
no ids. Then show the result via the `list-spec` skill.

BACKLOG stores **order only**; done-state is always derived from the checkboxes.

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
