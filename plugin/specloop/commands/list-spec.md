---
description: List specloop phases in priority (BACKLOG) order with derived done-state.
argument-hint: "[all|done|undone]"
---

List the project's phases in priority order. Order comes from
`spec/BACKLOG.md`; **done-state is derived** from each phase's checkboxes (a
phase is done when every `- [ ]` in `spec/NN-*.md` is checked).

Filter argument (`$ARGUMENTS`): `undone` (default) shows the remaining backlog,
`done` shows completed phases, `all` shows both. Reject anything else.

If `specloop` is on PATH, run `specloop list-spec $ARGUMENTS`. Otherwise read
`spec/BACKLOG.md`'s `## Phases (priority order)`, and for each entry resolve
`spec/NN-*.md`, count its checkboxes, and print:

```
1. [ ] 07 <Title> — <checked/total> (spec/07-slug.md)
2. [x] 04 <Title> — <checked/total> (spec/04-slug.md)
```

The leading number is the 1-based priority position in the full order (before
filtering), so a filtered view may show gaps. Reflect BACKLOG exactly — do not
reorder or renumber; to change priority use `/prio-spec <NN> <pos>`.
