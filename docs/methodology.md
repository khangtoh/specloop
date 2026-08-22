# The specloop methodology

specloop packages a way of working that emerged from running agents
across many sessions on the same codebase. This document explains *why* each
piece exists, so you can apply it deliberately rather than cargo-culting the
file layout.

## The problem it solves

A single agent session is good at doing a well-specified task. It is bad at:

- **Knowing when something is actually done.** "The tests seem to pass and the
  feature seems to work" rounds up to "done" far too easily.
- **Resuming.** The next session (or the next agent, or you in a week) has to
  re-derive what was decided, what's left, and why.
- **Staying honest across a long project.** Status drifts from reality; a
  README says a phase is complete while the code says otherwise.

specloop attacks all three by making the *plan itself* the source of truth, and
making that plan machine-checkable.

## The chain: goal → requirements → phases → tasks → checkboxes

Work flows down a strict chain, and completion is only ever read back **up** it:

1. **Goal** — one sentence with a real acceptance condition. Lives at the top of
   `spec/README.md`.
2. **Requirements / decisions** — what the goal implies, recorded in a phase's
   `Decisions` section or in the README's Status/Non-goals.
3. **Phases** — `spec/NN-title.md`, ordered, each with a `Goal:` and a
   `Depends on:` line. A phase is a unit of dependency, not a unit of size.
4. **Tasks** — flat `- [ ]` checkboxes inside a phase. Each is **atomic**:
   completable and verifiable in one short sitting. Atomicity is what lets an
   agent pick up exactly one and lets a reviewer accept or reject exactly one.
5. **Checkboxes** — the only authoritative record of completion. A box is
   checked **only** when its acceptance language is met and verified.

The `goal-completion-check` prompt walks this chain in reverse to answer "is X
done?" — it refuses to answer from impression, and flags any requirement with no
mapped phase as a gap.

## The loop

One iteration, run by an agent:

> pick the next unchecked box (lowest-numbered phase whose `Depends on:` is
> satisfied) → do it → **verify in proportion to risk** → check the box only if
> its acceptance holds → update the phase's dated Findings, the README phase
> table, and the session ledger → run the validator → emit the
> `Spec Summary/Status` handoff → commit → repeat.

Because each iteration is small and self-contained, it survives context limits,
parallel agents, and hand-offs between humans and agents. The ledger is what
makes resumption cheap; the handoff format is what keeps each iteration honest.

## The handoff: Spec Summary/Status

Every task handoff — complete, partial, **or** blocked — must include a
`Spec Summary/Status` section: a phase table with `checked/total` progress and a
status emoji (✅/🟡/⬜/⛔), a component/deliverable table when a named thing
changed, and `Overall` / `Evidence` / `Change state` lines. Two rules do the
heavy lifting:

- **Counts are derived, never asserted.** You read the boxes; you don't trust a
  prior report or a commit message.
- **Distinct states don't collapse.** "Functionally complete, visual pass
  pending" must not be reported as "complete." Blocked needs a *named*
  dependency, not a vibe.

## Enforcement

Conventions rot. specloop's validator (`specloop check`) makes the structure
non-optional: missing process files, phase files without a `Goal:`/`Depends on:`
header, malformed task lines, and — most importantly — a README phase table
whose progress or status disagrees with the phase file it points to all fail the
build. Wire it into CI and prebuild and the plan can't silently drift from
reality, because the thing that drifts stops the pipeline.

## What specloop is *not*

- **Not an issue tracker.** Phases are a dependency-ordered plan, not a backlog.
- **Not estimation.** There are no points or dates in a task; there is an
  acceptance condition and a checkbox.
- **Not a substitute for judgment.** "Verify in proportion to risk" is
  deliberately not mechanized — the method tells you to verify and to record how,
  not how much a given task deserves.

## Applying it well

- Keep tasks genuinely atomic. If a box can't be verified on its own, split it.
- Write acceptance conditions a *different* agent could check.
- Put decisions in the spec the moment you make them; the ledger records that
  you made them and why.
- Run `goal-check` before telling anyone something ships. That's the whole point.
