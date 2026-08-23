# Goal Completion Check — reusable prompt

A prompt template for checking whether a stated goal has actually been
met, by tracing it through this repo's requirements → spec → checklist
chain rather than inferring from "things seem to have happened." Use it
any time someone asks "are we done with X" and the honest answer
requires more than a vibe — including at the start of a session picking
this project back up, or before telling a stakeholder something ships.

## How to use it

Copy the prompt below, fill in `{GOAL}` with the goal to check (a
sentence is enough — "the checkout flow is done," "the migration is
done," "Phase 4 is done"), and run it. Under specloop, the
`/goal-check` plugin command wraps this prompt.

## The prompt

```
Check whether the following goal has been met: "{GOAL}"

This repo's process is: a goal produces requirements (recorded in a
spec phase's "Decisions" section, or in spec/README.md's Status/
Non-goals sections), each requirement is implemented by one or more
spec phases (spec/NN-*.md, each a flat checklist of atomic `- [ ]` /
`- [x]` tasks), and a phase isn't done until its own file says so —
checkboxes plus a dated Findings entry, not a general impression that
work happened nearby. Follow that chain exactly; don't shortcut it.

1. IDENTIFY REQUIREMENTS
   Search spec/README.md and every spec/*.md file for requirements,
   decisions, or scope statements that relate to this goal - not just
   files whose title matches. Requirements live in "Decisions" sections,
   the Goal/Depends-on line at the top of each phase file, and the
   Status/Non-goals sections of spec/README.md.
   When a historical requirement has an explicit dated supersession or
   extraction notice, the latest decision controls: report the old wording as
   historical context, not as a second active requirement. Follow its link to
   the replacement phase.
   List every requirement found, one line each, with its exact source
   (file + section).

2. MAP REQUIREMENTS TO SPECS
   For each requirement from step 1, name the spec phase(s) whose
   checklist is supposed to satisfy it (spec/README.md's phase table
   gives the canonical phase -> purpose mapping - start there). If a
   requirement has no corresponding spec phase at all, flag it as
   "requirement without a spec" - that is a gap regardless of what else
   is checked off, and it means the requirement→spec derivation this
   process depends on was never finished.

3. CHECK SPEC COMPLETION
   For each spec file mapped in step 2, open it and actually count
   checked (`- [x]`) vs unchecked (`- [ ]`) items in every section
   relevant to the requirement - ignore sections of the file that don't
   bear on this particular requirement. Read, don't estimate. For any
   item marked done-with-a-caveat ("N/A", "adapted", "deferred",
   "blocked on X"), decide explicitly whether that caveat still
   satisfies the requirement or is a real, open gap - state which and
   why, don't silently count it either way.

4. REPORT
   - State the goal verbatim.
   - Table: Requirement | Source | Mapped spec(s) | Completion
     (checked/total) | Status (Met / Partial / Not started).
   - Overall goal verdict, one of:
     - MET - every requirement's mapped specs are fully checked, no
       unresolved caveats.
     - PARTIALLY MET - list exactly which requirements are satisfied
       and which aren't.
     - NOT MET - state which blocking requirement(s) have no completed
       spec work, and why they block the goal specifically (not just
       "stuff is unchecked").
   - If not fully met: list the specific unchecked items blocking it,
     across all mapped specs, in priority/dependency order, so picking
     this back up doesn't require re-deriving where it left off.
   - Append the mandatory `Spec Summary/Status` section from
     `spec/spec-summary-status.md`: use the exact
     `Phase | Scope | Progress | Status` table for every mapped phase,
     the applicable component/deliverable table, and the required
     `Overall`, `Evidence`, and `Change state` closing lines.

Do not mark anything "Met" on inference. A requirement is satisfied only
if its mapped spec's relevant checklist items are actually checked off
in the file - not because related work "seems done," not because a
similar-sounding task was completed elsewhere, and not because the
underlying feature happens to work when tried manually without the spec
being updated to reflect it.
```
