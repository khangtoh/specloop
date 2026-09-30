# Phase 09 release-kit evidence — 2026-09-27

## Automated

- `node --test scripts/release-kit/release.test.mjs`: 14 pass / 0 fail. Covers
  version ordering, bump (in-place JSON and pattern sync, changelog cut,
  commit, push to a bare origin), refusal of dirty trees, older versions and
  existing tags, `--no-push` and off-branch bumps, stale-file detection, plan
  outputs for main/non-main/tagged/backwards versions, verify ordering and
  failure, packaging with checksums and evidence, publish token handling
  (placeholder-only npmrc), identical-bytes resume, different-bytes refusal,
  dry runs, GitHub Release notes/assets/idempotence, and drift against an
  HTTP-served upstream.
- `bun test ./tests`: 136 pass / 0 fail. `bun run typecheck` exit 0.
  `check:spec` and `check:self` valid.

## Real pipeline, local

- `plan` on this checkout: `v0.7.0 already exists; nothing to release`,
  `new=false release=false`.
- `package`: `npm pack` produced `khangtoh-specloop-0.7.0.tgz`; onboarding
  verification against that tarball passed 90/0; `SHA256SUMS` and
  `release-evidence.md` written.
- Scratch copy bumped to 0.8.0 (`--no-push`): `plan` → `v0.8.0 is new;
  releasing from main`; `package` passed; `publish --dry` queried the real npm
  registry and reported it would publish `@khangtoh/specloop@0.8.0`;
  `github-release --dry` reported the tag target and two assets.
- `bun install --frozen-lockfile` could not run locally: Bun 1.3.11 cannot
  parse the lockfile (`lockfileVersion: 2`). CI installs the latest Bun via
  `oven-sh/setup-bun@v2`; this is unverified until the first workflow run.
- actionlint 1.7.7: no findings for `.github/workflows/release.yml`.

## Not yet verified

The workflow has not run on GitHub: it needs the `NPM_TOKEN` secret and a merge
to `main`. The first `VERSION` push is the live acceptance test.
