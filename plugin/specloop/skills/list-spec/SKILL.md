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
