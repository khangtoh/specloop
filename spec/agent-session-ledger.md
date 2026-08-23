# Agent Session Ledger

A running record of what an agent session actually did on this repo —
decisions made, state changed, automation left running — so the next
session (human or agent) can resume without re-deriving context or
re-litigating settled calls. Append a new dated entry per session; never
rewrite history in an earlier entry (if something changes, add a note,
don't edit the old record).

This is a log, not a spec. Requirements and task checklists live in
`spec/*.md`; this file is "what happened and why," cross-referencing
those files rather than duplicating their content.

Read this first when resuming after a break; append a new entry when
closing one out.

---

## Session: YYYY-MM-DD (branch `<branch>`)

### Scope of this session

<What this session set out to do, and against what starting state.>

### What got done, in order

1. <Action, with the phase/task it maps to and how it was verified.>
2. <Decision made and why; link the spec section that records it.>

### State left running / open

<Anything still deploying, any blocker handed to the next session, the
next unchecked box to pick up.>
