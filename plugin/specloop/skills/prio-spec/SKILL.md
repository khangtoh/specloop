---
name: prio-spec
description: Reprioritize a phase in a specloop project's spec/BACKLOG.md. Use when the user asks to run prio-spec, reprioritize a phase/spec, move a phase up or down, or change the backlog work order.
---

# prio-spec

Reprioritize one **incomplete** phase in `spec/BACKLOG.md`. Arguments: `<NN> <pos>`.

- `NN` = phase id (prefix of `spec/NN-*.md`).
- `pos` = signed move among incomplete phases: `0` = top, `+N` = up N, `-N` = down N.
- Complete phases (all tasks in `spec/NN-*.md` checked) stay anchored.

Prefer the CLI: `specloop prio-spec <NN> <pos>`. It moves the single line,
derives done-state from the phase files, and prints the new order.

If the CLI isn't available, edit `spec/BACKLOG.md` by hand: under
`## Phases (priority order)`, move only phase `NN`'s line to the target position
among the incomplete entries. Change nothing else — no other line, no phase file,
no ids. Then show the result via the `list-spec` skill.

BACKLOG stores **order only**; done-state is always derived from the checkboxes.
