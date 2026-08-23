# Backlog

The **ranked work order** for this project's phases. This file is the source of
truth for **order**; done-state is *derived* from each phase's checkboxes (never
kept here), so there is nothing to sync.

- **List position = priority** — the top entry is what the loop does next.
- `NN` is a **stable spec id** matching `spec/NN-*.md`, *not* a priority.
- `Depends on:` still gates: the loop takes the highest entry whose deps are met.
- Reprioritize with `specloop prio-spec <NN> <pos>` (`0` = top, `+N` up, `-N`
  down among incomplete phases). List it with `specloop list-spec`.
- Within a phase, task tags `- [ ] (p1) …` and `specloop prio-task` order the
  boxes. So: prio-spec picks the phase, `(pN)` picks the box.

## Phases (priority order)

- 01 Example: project scaffold
