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

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's first p1 non-overwrite safety test.

### What got done, in order

1. Added the protected-file sentinel test and the `upgrade --apply` kept-file report.
2. Verified the focused test and `specloop check --dir .`.

### State left running / open

Next task: Phase 01 p1 phase-file byte-identity test.

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's second p1 phase-file byte-identity safety test.

### What got done, in order

1. Added SHA-256 pre/post verification for multiple numbered phase files, including CRLF content.
2. Verified the focused test and `specloop check --dir .`.

### State left running / open

Next task: Phase 01 p1 idempotency test.

---

## Session: 2026-08-23 (branch `main`)

### Scope of this session

Complete Phase 01's third p1 idempotency test.

### What got done, in order

1. Added a recursive file-tree SHA-256 snapshot around the second `upgrade --apply`.
2. Verified it reports nothing to adopt and preserves the snapshot.

### State left running / open

Next task: Phase 01 git-status safety test.
