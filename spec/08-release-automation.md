# Phase 08 — Automated publish and release workflow

Goal: one documented command verifies, versions, publishes, verifies the
published artifact, records evidence and pushes a release; a failed or partial
run can resume safely without publishing a different artifact or bumping twice.

Depends on: None.

## Tasks

- [x] (p1) Automate clean-main, upstream, registry-version and npm-auth preconditions with clear non-destructive failure guidance.
- [x] (p1) Run required verification and version the npm and both plugin manifests together; dry-run leaves release files unchanged and performs no publication, commits, tags or pushes (remote-ref fetch is allowed).
- [x] (p1) Pack once, verify and publish that exact tarball, then verify registry identity/integrity with bounded retries.
- [x] (p1) Record accurate append-only ledger evidence and commit/tag/push the release explicitly, preserving unrelated state and historical spec checkboxes.
- [x] (p1) Provide safe recovery for partial publication/tag/push failures without duplicate bumping, republishing different bytes or overwriting unknown tags.
- [x] Document normal releases, version choices, prerequisites, authentication and recovery using the implemented commands.
- [x] Verify success, dry-run, authentication/version/divergence failures and partial-release recovery with hermetic tests; run full regression and structural checks.

## Findings / Results

- _2026-09-27_ — Authored under the user's explicit subagent automation request.
  The already-published 0.7.0 artifact remains immutable. Workflow validation
  uses mocked external services plus current release evidence; no extra npm
  release is required solely to test automation.

- _2026-09-27_ — Implemented a shared Node release/recovery driver with clean-main,
  upstream, registry and authentication gates; synchronized npm/plugin versions;
  mandatory regression/typecheck/spec checks; one verified tarball; registry
  integrity confirmation; append-only evidence; and explicit commit/tag/push.
  Atomic recovery intent and saved artifacts survive partial publication, ledger
  writes, commits and pushes. Unknown edits/tags and stale unpublished versions
  stop without discarding work. Dry-run restores its manifest edits.
- _2026-09-27_ — Subagent implementation, documentation and independent review
  completed. All 145 tests pass (691 assertions), including 12 release scenarios
  (80 assertions). Typecheck, template/self validation, Node/shell syntax and
  whitespace checks pass. The new supplied-tarball onboarding path passes all
  90 assertions against the actual published 0.7.0 artifact. The runbook is
  `docs/releasing.md`. No extra npm version was published for automation testing.
