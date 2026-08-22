# Phase 01 — Example: project scaffold

Goal: a runnable, empty project skeleton that builds and passes an empty
test suite, so later phases have a verified baseline to build on. This
phase is shipped as a worked example — replace it with your own Phase 01.

Depends on: None (this is the first phase).

- [x] Initialize the repository and commit an empty but building skeleton.
      Done: `git init`, baseline commit `0000000`.
- [x] Add a test runner and one trivially-passing test. Done: `npm test`
      green, 1/1.
- [ ] Add a lint step and wire it into the build. Acceptance: `npm run
      lint` exits 0 on the skeleton.
- [ ] Document the local build/test commands in the project README.

## Findings / Results

- _2026-01-01_ — Skeleton builds and the placeholder test passes
  (`npm test`, 1/1). Lint step still to add; README build-commands
  section is a stub. Phase is 2/4, `🟡 Partial`.
