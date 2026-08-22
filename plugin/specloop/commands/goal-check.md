---
description: Check whether a stated goal is actually met by tracing it through requirements → specs → checkboxes.
argument-hint: "<the goal to check, e.g. 'the checkout flow is done'>"
---

Check whether this goal is actually met: **$ARGUMENTS**

Do not answer from impression. Follow `spec/goal-completion-check.md` exactly.
If `specloop` is on PATH you can run `specloop goal-check "$ARGUMENTS"` to print
the filled prompt; otherwise read `spec/goal-completion-check.md` and substitute
the goal yourself.

Then execute its four steps against this repo:

1. **Identify requirements** for this goal from `spec/README.md` and the
   `Decisions` / `Goal:` / `Depends on:` lines across `spec/*.md`. Honor dated
   supersession notices — the latest decision controls.
2. **Map each requirement to the spec phase(s)** meant to satisfy it. Flag any
   requirement with no mapped phase as a gap.
3. **Count actual checkboxes** in each mapped phase file. Read, don't estimate.
   Decide explicitly whether each caveated item still satisfies the requirement.
4. **Report**: the requirement→spec→completion table, an overall verdict
   (MET / PARTIALLY MET / NOT MET), the specific unchecked items blocking it in
   dependency order, and the mandatory `Spec Summary/Status` section.

A requirement is satisfied only if its mapped spec's checklist items are checked
off in the file — never because related work "seems done."
