# specloop — Spec Index (self-hosted)

Goal: specloop develops specloop. Each of its own commands is covered by an
automated, CI-gating verification suite so the methodology's tooling is as
trustworthy as the methodology it enforces. This spec set is dogfood — specloop's
own `spec/`, driven by its own loop and validated by `specloop check`.

## How this spec set works

- Every numbered file under `spec/` is a phase: a flat checklist of **atomic
  tasks**, each verifiable in one short sitting.
- Phase **work order** lives in [`BACKLOG.md`](BACKLOG.md) (top = next); reorder
  with `specloop prio-spec <NN> <pos>`. Done-state is derived from the checkboxes.
- Every handoff includes the `Spec Summary/Status` report from
  [`spec-summary-status.md`](spec-summary-status.md).
- Validate with `specloop check --dir .` (the `bun run check:spec` script checks
  the shipped `template/`; this self-hosted spec is checked separately).

**Audit a goal:** [`goal-completion-check.md`](goal-completion-check.md).
**What happened, session by session:** [`agent-session-ledger.md`](agent-session-ledger.md).

## Phases

Legend: ✅ complete · 🟡 partial · ⬜ not started · ⛔ blocked. Progress is
`checked/total`.

| # | File | Purpose | Status | Blocking dependency |
|---|------|---------|--------|----------------------|
| 1 | [01-verify-upgrade.md](01-verify-upgrade.md) | Automated suite verifying `specloop upgrade` detection + non-destructive adoption | 🟡 4/28 | None (0.3.0 shipped) |

## Status

- [ ] **specloop's commands are covered by an automated verification suite** —
  starting with `upgrade` (Phase 01). Future phases cover the other commands.

## Non-goals

- Re-testing bun/Node internals or the template content itself (covered by the
  existing `tests/validator.test.ts`).
- The semantic quality of agent-driven `/spec-upgrade` re-authoring beyond a
  single manual smoke check (agent judgment isn't unit-testable).
