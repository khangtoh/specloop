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
