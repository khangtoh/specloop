# specloop — Spec Index (self-hosted)

Goal: specloop develops specloop. Each of its own commands is covered by an
automated, CI-gating verification suite so the methodology's tooling is as
trustworthy as the methodology it enforces. This spec set is dogfood — specloop's
own `spec/`, driven by its own loop and validated by `specloop check`.

## How this spec set works

- Every numbered file under `spec/` is a phase: a flat checklist of **atomic
  tasks**, each verifiable in one short sitting.
- Phase **work order** lives in [`BACKLOG.md`](BACKLOG.md) (top = next); reorder
  with `specloop prio spec <NN> <pos>`. Done-state is derived from the checkboxes.
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
| 1 | [01-verify-upgrade.md](01-verify-upgrade.md) | Automated suite verifying `specloop upgrade` detection + non-destructive adoption | ✅ 28/28 | None (0.3.0 shipped) |
| 2 | [02-autonomous-run-contract.md](02-autonomous-run-contract.md) | Durable run state, alias/stop policy, and tests guarding the autonomous `specloop` contract | ✅ 22/22 | None |
| 3 | [03-preflight-check.md](03-preflight-check.md) | `specloop preflight` workspace checks; bare `specloop` runs them (breaking, 0.4.0) | 🟡 14/26 | Phase 02 (run-state record) |
| 4 | [04-agent-asset-onboarding.md](04-agent-asset-onboarding.md) | `init`/`upgrade` install the skill + `/spec-*` commands into a repo's `.claude/`; adopted repos validate; Codex added in Phase 07 | ✅ 23/23 | None |

| 5 | [05-grouped-phase-layout.md](05-grouped-phase-layout.md) | Flat or folder-of-sub-specs phases; layout recommends, group migrates | ✅ 20/20 | None |
| 7 | [07-decision-reconciliation.md](07-decision-reconciliation.md) | Session reconciliation, runtime hooks and safe refresh | 🟡 11/14 | None |
| 6 | [06-command-menu.md](06-command-menu.md) | Short commands, native skill response menu and inline argument hints | 🟡 11/12 | Claude authentication for live acceptance |
| 8 | [08-release-automation.md](08-release-automation.md) | Automated verified publishing and recoverable release workflow (local driver superseded by Phase 09) | ✅ 7/7 | None |
| 9 | [09-version-driven-release.md](09-version-driven-release.md) | VERSION-triggered CI release through a kit shared with ProductOS | ✅ 7/7 | None (0.8.0 released through CI) |

## Status

- [ ] **specloop's commands are covered by an automated verification suite** —
  `upgrade` (Phase 01) done; the autonomous run contract (Phase 02) and
  `preflight` (Phase 03) next. Onboarding (Phase 04) adds an end-to-end proof
  over the packed tarball, `scripts/verify-onboarding.sh`. Future phases cover
  the remaining commands.

## Non-goals

- Re-testing bun/Node internals or the template content itself (covered by the
  existing `tests/validator.test.ts`).
- The semantic quality of agent-driven `/spec-upgrade` re-authoring beyond a
  single manual smoke check (agent judgment isn't unit-testable).
