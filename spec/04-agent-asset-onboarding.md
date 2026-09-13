# Phase 04 — Agent-asset onboarding for new and migrated repos

Goal: a repository receives the `specloop` skill and the `/spec-*` commands from
the CLI itself — `specloop init` for a new repo, `specloop upgrade --apply` for
an existing one — so a clone onboards its agent with no separate plugin install,
and both entry points leave a layout that passes `specloop check` immediately.

Depends on: None.

<!--
  Decisions locked for this phase:
    - Assets are COPIED into the target repo's `.claude/`, not registered into
      the user's global Claude Code plugin state. `~/.claude/plugins` is that
      tool's internal registry (versioned cache paths, git SHAs); a CLI writing
      there is invasive and fragile. A committed `.claude/` also onboards every
      clone, which a per-user plugin install cannot do.
    - The marketplace plugin install stays supported and is now documented as
      the optional, user-wide alternative.
    - `copy` is the default; `link` exists for developing specloop itself and
      must refuse to link out of a bun cache or `node_modules` (both rot).
    - Existing assets are never clobbered without `--force`: a project may have
      edited its copy.
-->

## A. Install mechanism

- [x] (p1) Add `src/commands/agentAssets.ts` exporting `planAgentAssets`
      (inspect only) and `installAgentAssets` (write), returning the installed,
      present and missing asset paths so both callers can report accurately.
- [x] (p1) Resolve the shipped `plugin/specloop/` directory from the package
      root so it works identically under `bunx`, a global install, and a
      project `node_modules`.
- [x] (p1) Never overwrite an existing asset unless `--force` is passed.
- [x] Treat a broken symlink as occupying its path — `existsSync` reports false
      for one, which would silently leave a dangling asset in place.
- [x] Compute symlink targets from the *physical* paths, so a symlinked parent
      (macOS `/var` → `/private/var`) cannot produce a link that resolves
      somewhere else.
- [x] Degrade `--skills link` to `copy`, with a printed reason, when the source
      is inside a bun cache or `node_modules`.

## B. CLI wiring

- [x] (p1) `specloop init` installs the assets by default and points the user
      at `/spec-loop` plus the session restart needed to load them.
- [x] (p1) `specloop upgrade --apply` installs them as a first-class planned
      action, visible in the dry run before anything is written.
- [x] Add `--skills <copy|link|none>` to both commands, rejecting an
      unrecognized value with a nonzero exit and the accepted list.
- [x] Document `--skills` and the changed `init`/`upgrade` behavior in `HELP`.

## C. A migrated repo must validate

- [x] (p1) Generate `spec/README.md` on `upgrade --apply` when the spec
      directory has no index — the validator requires it, so adoption used to
      end by telling the user to run a check that then failed.
- [x] (p1) Derive each generated index row's progress and status emoji from
      that phase's own checkboxes, so `enforceIndexCounts` passes with no hand
      editing.
- [x] (p1) Test: `upgrade --apply` followed by `runCheck` exits 0, and the
      generated index lists the real phase rather than the template example.

## D. Tests and end-to-end proof

- [x] (p1) Unit-test both entry points across all three `--skills` modes,
      including idempotency, the `--force` restore, and link resolution.
- [x] (p1) Add `scripts/verify-onboarding.sh`: pack the publishable tarball,
      create a throwaway repo, `bun add` the tarball, run `bunx specloop init`,
      and assert the spec scaffold, `node_modules`, and every `.claude/` asset.
- [x] (p1) Assert the packed tarball actually ships `plugin/specloop/` — the
      packaging risk the whole feature rests on.
- [x] Cover the migrate path in the same script: an ad-hoc numbered spec repo
      is adopted, keeps its existing phase content, and passes `specloop check`.
- [x] Cover `--skills none` opting out with no `.claude/` directory written.
- [x] Wire the script into `scripts/release.sh` and a `verify:onboarding`
      package script so a release cannot ship a broken onboarding.

## E. Documentation and release

- [x] Document `--skills`, the per-repo install, and the now-optional
      marketplace install in the root `README.md`.
- [x] Note in `plugin/specloop/README.md` that the assets are plugin-root-free
      and therefore safe to copy per repository.
- [ ] Decide and document the project-local path Codex reads skills from, then
      extend the installer with an `--agent claude|codex|both` flag. Deferred:
      the Claude Code path is verified, the Codex one is not.
- [ ] Publish the release to npm and confirm the published tarball installs and
      onboards a fresh repository.

## Findings / Results

- _2026-09-13_ — Phase authored. Prior state: the skills and commands existed
  only inside `plugin/specloop/`, reachable solely through a marketplace plugin
  install; `node_modules/@khangtoh/specloop/plugin/` shipped them but nothing
  read from there, so a project that depended on specloop still had no skill.

- _2026-09-13_ — Sections A–D complete. `bun test` — 72 pass / 0 fail across 16
  files (12 new in `tests/agent-assets.test.ts`, 1 new regression test in
  `tests/upgrade-apply.test.ts`). `bun run typecheck` exits 0.

- _2026-09-13_ — End-to-end proof: `bash scripts/verify-onboarding.sh` — 62
  passed / 0 failed. It packs the real tarball, installs it into two throwaway
  git repositories, and asserts `node_modules/@khangtoh/specloop`, the linked
  `.bin/specloop`, the full spec scaffold, all 4 skills and 7 commands
  byte-identical to the package, absence of `CLAUDE_PLUGIN_ROOT`, and
  `specloop check` exiting 0 for both the new and the migrated repo.

- _2026-09-13_ — Escaped defect found by the end-to-end script and fixed here:
  `upgrade --apply` never scaffolded `spec/README.md`, but `.specloop.json`
  lists `README.md` as a required process file. Every adopted repository
  therefore failed the `specloop check` that `upgrade` itself recommends. Phase
  01 marked `upgrade` verified 28/28 without catching it because no test ran
  the validator over an adopted tree. `tests/upgrade-apply.test.ts` now does.

- _2026-09-13_ — Release blocked at the publish step, not the build. `bun run
  release minor --dry` passed every gate (72 tests, template + self check, 62/62
  onboarding, typecheck) and `npm publish --dry-run` reports
  `+ @khangtoh/specloop@0.5.0`, so the artifact is publishable. The real publish
  returns `E403: Two-factor authentication or granular access token with bypass
  2fa enabled is required`. The script's ordering held: nothing was tagged or
  pushed and npm still serves 0.4.0; the 0.5.0 bump is committed.

- _2026-09-13_ — Diagnosis corrected. The blocker is the *credential type*, not
  an OTP prompt: `npm profile get` reports `two-factor auth: disabled` for
  `khangtoh`, so no OTP can be generated and `npm publish --otp=<code>` cannot
  work. `npm token list` shows a single granular token (id `988c23`, created
  2026-08-22) which lacks the "bypass 2FA" capability npm now requires for
  publishing. This clone has no repo-local `.npmrc` (the file is gitignored),
  so it falls back to `~/.npmrc`; 0.4.0 was very likely published from an
  environment holding a different, publish-capable token. Resolve by minting a
  granular token with "bypass 2FA" and read/write on `@khangtoh/specloop`, or
  by enabling account 2FA and using an OTP. `scripts/finish-release.sh` then
  completes the release (publish, tag, push) without re-bumping the version.

- _2026-09-13_ — The local Bun package cache that blocked Phase 03's runtime
  task has recovered: `bun install` succeeded (5 packages) and `bun run
  typecheck` now exits 0. Phase 03's own boxes are left untouched — that
  verification belongs to its own loop iteration.
