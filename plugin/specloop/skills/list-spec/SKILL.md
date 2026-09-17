---
name: list-spec
description: List a specloop project's phases in priority order with done-state. Use when the user asks to run list-spec, show the backlog, or see remaining/done phases in priority order.
---

# list-spec

List phases in priority order. Order comes from `spec/BACKLOG.md`; **done-state
is derived** from each phase's checkboxes.

Filter argument: `undone` (default, remaining backlog), `done` (completed), or
`all`. Reject anything else.

Prefer the CLI: `specloop list-spec [all|done|undone]`.

Otherwise read `spec/BACKLOG.md`'s `## Phases (priority order)`; for each entry
resolve `spec/NN-*.md`, count checkboxes, and print:

```
1. [ ] 07 <Title> — <checked/total> (spec/07-slug.md)
```

The leading number is the 1-based priority position in the full order (before
filtering), so filtered views may show gaps. Reflect BACKLOG exactly — never
reorder or renumber. To change priority, use the `prio-spec` skill.

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
