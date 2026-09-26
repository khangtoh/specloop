---
description: List specloop phases in priority (BACKLOG) order with derived done-state.
argument-hint: "[all|done|undone]"
---

List the project's phases in priority order. Order comes from
`spec/BACKLOG.md`; **done-state is derived** from each phase's checkboxes (a
phase is done when every `- [ ]` in `spec/NN-*.md` is checked).

Filter argument (`$ARGUMENTS`): `undone` (default) shows the remaining backlog,
`done` shows completed phases, `all` shows both. Reject anything else.

If `specloop` is on PATH, run `specloop list $ARGUMENTS`. Otherwise read
`spec/BACKLOG.md`'s `## Phases (priority order)`, and for each entry resolve
`spec/NN-*.md`, count its checkboxes, and print:

```
1. [ ] 07 <Title> — <checked/total> (spec/07-slug.md)
2. [x] 04 <Title> — <checked/total> (spec/04-slug.md)
```

The leading number is the 1-based priority position in the full order (before
filtering), so a filtered view may show gaps. Reflect BACKLOG exactly — do not
reorder or renumber; to change priority use `/prio-spec <NN> <pos>`.

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
