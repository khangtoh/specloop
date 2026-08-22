---
description: Report specloop phase status read straight from the spec checkboxes, in the mandatory handoff format.
argument-hint: "[phase number, or blank for all]"
---

Report the current spec status for this repository.

1. Run `specloop status` (and `specloop check`) to read live checkbox counts
   and surface any structural drift.
2. For each phase (or the one named in `$ARGUMENTS`), open the phase file and
   confirm the counts by reading the actual `- [x]` / `- [ ]` boxes — do not
   trust a prior report or commit message.
3. Produce the `Spec Summary/Status` section defined in
   `spec/spec-summary-status.md`: the `Phase | Scope | Progress | Status` table,
   the component/deliverable table when relevant, and the `Overall` /
   `Evidence` / `Change state` closing lines.
4. Name the next unchecked box (respecting phase order and `Depends on:`) so the
   next session can resume without re-deriving where it left off.
