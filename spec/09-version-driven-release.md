# Phase 09 — VERSION-driven CI release kit

Goal: pushing a `VERSION` change to `main` verifies, packages, publishes and
tags that version in CI, through a release kit shared byte-for-byte with
ProductOS, and a failed run resumes by re-running without bumping or
republishing different bytes.

Depends on: None.

## Decisions

_2026-09-27_, from the user's choices: CI publishes to npm; the kit is an
identical copy in both repositories with a drift check, not a cross-repository
reusable workflow; the local `bun run release` only bumps and CI releases. This
supersedes Phase 08's local publish driver (`scripts/release.mjs`,
`finish-release.sh`), which is removed. Release evidence moves from an appended
ledger entry to the GitHub Release body and `SHA256SUMS`, since CI does not
push commits back to `main`.

## Tasks

- [x] (p1) Add `VERSION` as the release source of truth, with `bump` syncing `package.json` and both plugin manifests, committing and pushing `main`.
- [x] (p1) Implement the shared kit (`plan`, `verify`, `package`, `publish`, `github-release`, `drift`, `check`), configured per repository by `release.config.json`.
- [x] (p1) Add the release workflow: releases on a `VERSION` push to `main`, dry-runs on pull requests, resumes on re-run, and checks kit drift.
- [x] Retire the local publish driver and update the README and release runbook.
- [x] Test the kit hermetically, run the real verify/package pipeline and a registry-backed dry run for a new version, and lint the workflow.
- [ ] Owner adds the `NPM_TOKEN` Actions secret.
- [ ] Record the first live CI release: npm integrity, tag and GitHub Release from a `VERSION` push.

## Findings / Results

- _2026-09-27_ — Implemented the kit and workflow. Kit tests 14/14 (temporary
  git repository with bare origin, stub npm/gh); `bun test ./tests` 136/136
  after removing the old driver's 12 tests; typecheck and structural checks
  pass. Real `package` on 0.7.0 passed 90/90 onboarding checks against the
  packed tarball. A scratch 0.8.0 bump planned a release and dry-ran publish
  against the real registry (not yet published → would publish) and the
  GitHub Release. actionlint 1.7.7 reports the workflow clean. Evidence:
  [release kit](evidence/09-release-kit.md). Live CI needs the secret and a
  merge to `main`; not yet run.
