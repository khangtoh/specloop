# <Project> — Spec Index

Goal: <one paragraph stating the single overarching goal of this project,
concretely enough that "is it done?" has a real answer>.

## How this spec set works

- Every numbered file under `spec/` is a phase. Every phase is a flat checklist
  of **atomic tasks** — each completable and verifiable in one short sitting.
  Unnumbered files such as `spec-summary-status.md` are process definitions or
  supporting records, not implementation phases.
- Check a box (`- [x]`) only once the task is actually done and, where
  applicable, verified.
- Every completed, partial, blocked, or documentation-only task handoff must
  include the canonical `Spec Summary/Status` report defined in
  [`spec-summary-status.md`](spec-summary-status.md).
- Phase **work order** lives in [`BACKLOG.md`](BACKLOG.md) (top = next), not in
  the filename number — reorder it with `specloop prio-spec <NN> <pos>`. Each
  phase's `Depends on:` still gates. Done-state is derived from the checkboxes.
- The loop: an agent takes the top `BACKLOG.md` phase whose `Depends on:` is
  met and its highest-priority box, does it, verifies it, updates its checkbox
  and the Results/status records, produces the mandatory `Spec Summary/Status`
  handoff, commits, and moves on — repeating until the goal's acceptance
  phase is fully checked and its live evidence is recorded below.

**Is a goal actually done?**
[`goal-completion-check.md`](goal-completion-check.md) — a reusable
prompt that traces a stated goal through requirements → mapped spec
phases → actual checkbox state, instead of answering from impression.
Use it before telling anyone something ships.

**How must agents report spec status?**
[`spec-summary-status.md`](spec-summary-status.md) — the canonical phase and
component/deliverable tables, counting rules, closing evidence fields, and
mandatory completion procedure for every agent handoff.

**What actually happened, session by session?**
[`agent-session-ledger.md`](agent-session-ledger.md) — a dated log of
what each agent session did, decided, and left running (distinct from
the spec files, which are requirements/checklists, not narrative).
Read this first when resuming after a break; append a new entry when
closing one out.

## Phases

Status column legend (defined in
[`spec-summary-status.md`](spec-summary-status.md)): ✅ complete ·
🟡 partial · ⬜ not started · ⛔ blocked. Progress is `checked/total`
boxes in the phase file; keep both in sync when checking boxes.
`specloop check` fails the build when a row's progress or emoji drifts
from the phase file it points to.

| # | File | Purpose | Status | Blocking dependency |
|---|------|---------|--------|----------------------|
| 1 | [01-example-phase.md](01-example-phase.md) | Example scaffold phase — replace with your own | 🟡 2/4 | None |

## Status

- [ ] **<Goal acceptance statement>** — the single checkbox that means the
  whole project's goal is met. Record the live evidence (URL, run, artifact)
  next to it when it flips to `[x]`.
- Overall phase progress: see individual files.

## Non-goals

- <Things explicitly out of scope, so they don't get silently pulled in.>
