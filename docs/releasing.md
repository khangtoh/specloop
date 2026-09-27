# Publishing a specloop release

`VERSION` at the repository root is the release version and the trigger. A push
to `main` that changes it runs the [release workflow](../.github/workflows/release.yml),
which releases that version once. There is no local publish command.

The workflow and `scripts/release-kit/` are the shared release kit, byte-identical
in specloop (the source copy) and ProductOS. Each repository describes its own
steps in `release.config.json`; specloop's verifies with Bun, packs with npm and
publishes to npm.

## One-time setup

Add an npm token that can publish `@khangtoh/specloop` (an automation token or a
granular token with publish rights) as the `NPM_TOKEN` secret under the
repository's **Settings → Secrets and variables → Actions**, or from a
terminal with the GitHub CLI:

```bash
bash scripts/set-npm-token.sh                           # prompts; input is hidden
op read op://vault/npm/token | bash scripts/set-npm-token.sh   # or pipe it in
```

The script needs `gh auth login` with admin access to the repository. It checks
the token with `npm whoami` first, stores nothing if npm rejects it, then
confirms the secret is listed. `--repo owner/name` targets another repository and
`--skip-verify` skips the npm check. Rerun it to rotate an expiring token.

Without the secret the
workflow stops at publishing and tells you so; nothing is tagged. The token is
written only as an `${NPM_TOKEN}` placeholder in a temporary npm config, never
to the repository, logs or evidence.

## Release a version

Commit the intended changes on `main`, including `docs/releases/X.Y.Z.md` when
the release needs user-facing notes. Then bump:

| Command | Use |
|---|---|
| `bun run release patch` | Compatible fixes |
| `bun run release minor` | New functionality |
| `bun run release major` | Incompatible public interface changes |
| `bun run release 1.0.0-rc.1` | An explicit version; a prerelease publishes under npm's `next` tag |

`bump` needs a clean tree and a version newer than the current one with no
existing tag. It writes `VERSION`, syncs `package.json` and both plugin manifests,
commits `Release vX.Y.Z` and pushes `main`. On another branch, or with
`--no-push`, it only commits: merge or push the commit to release. Editing
`VERSION` by hand also works; the workflow then syncs the manifests inside the
package and warns that the repository copies are stale.

`bun run release:check` confirms `VERSION` and the synced manifests agree.

## What the workflow does

1. **plan** — reads `VERSION`. If `vX.Y.Z` already exists there is nothing to
   do. A version older than an existing tag fails. Only `main` releases; any
   other ref is a dry run.
2. **verify** — `bun install --frozen-lockfile`, the test suite, typecheck, the
   template and self spec checks, and the release-kit tests.
3. **package** — `npm pack` once, then `scripts/verify-onboarding.sh --tarball`
   against that exact file. Writes `SHA256SUMS` and `release-evidence.md`.
4. **publish** — publishes that tarball. If the version is already on npm with
   identical bytes it is accepted; different bytes stop the release, because
   published versions are immutable. The registry integrity is then confirmed.
5. **github-release** — creates `vX.Y.Z` at the released commit with
   `docs/releases/X.Y.Z.md` (or generated notes), the verification evidence, the
   tarball and `SHA256SUMS`. An existing release is left unchanged.

A pull request that touches `VERSION`, `release.config.json` or the kit runs
verify and package; if its version is new it also dry-runs publish and the
GitHub Release. The separate `kit-drift` job does nothing here, since this is
the source copy.

## Resume a failed release

Fix the cause, then re-run the failed workflow run, or dispatch **release** on
`main` from the Actions tab. Each step accepts completed work: an identical npm
artifact is not republished and an existing tag or release is not replaced. Do
not bump again to recover; that requests a different version.

| Failure | Recovery |
|---|---|
| `NPM_TOKEN is not set` or npm authentication fails | Add or repair the secret, then re-run. |
| npm reports different bytes for the version | That version was published from other source. Release a new version. |
| npm did not show the version after publishing | Re-run; the identical artifact is accepted and the tag follows. |
| Tag or GitHub Release creation failed | Re-run; publishing is skipped as already done. |
| `VERSION ... is older than existing tag` | Bump past the latest tag. |

For independent confirmation:

```bash
npm view @khangtoh/specloop@X.Y.Z version dist.integrity --json
git ls-remote origin refs/tags/vX.Y.Z
```

## Changing the release kit

Edit `scripts/release-kit/release.mjs`, its tests or `.github/workflows/release.yml`
here, run `bun run test:release-kit`, then copy the same files to ProductOS.
ProductOS's `kit-drift` job fails until its copy matches specloop's `main`.
