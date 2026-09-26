# Publishing a specloop release

Use the release scripts from a source checkout. They automate verification,
version synchronization, publishing, evidence, commit, tag, and push.
Authentication and resolving divergent Git history still require maintainer
access and judgment. These commands do not create a GitHub Release or publish
to a separate plugin marketplace; the versioned plugins ship inside the npm
package and source tag.

## Prepare and choose a version

Commit the intended changes and their spec evidence on `main`. Install the
development dependencies with `bun install`. The release needs Bun, Node.js,
npm, Git, network access to npm and `origin`, npm permission to publish
`@khangtoh/specloop`, and permission to push `main` and tags.

Use an existing authenticated npm configuration, or authenticate interactively:

```bash
npm login
npm whoami
```

An automation environment can supply `NPM_TOKEN` through its secret store.
The release driver uses a temporary npm configuration with an environment
placeholder; do not put tokens in commands, tracked files, release evidence,
or logs. Authentication requirements depend on the credential and account;
`npm login` or an npm authentication prompt may need human interaction.
The scripts do not manufacture an OTP or skip verification to accommodate one.

Choose the bump explicitly when adding features or changing compatibility:

| Command | Use |
|---|---|
| `bun run release` | Patch: compatible fixes; same as `bun run release patch` |
| `bun run release minor` | Minor: new functionality |
| `bun run release major` | Major: incompatible public interface changes |
| `bun run release minor --dry` | Rehearse a minor release without publishing, committing, tagging, or pushing |

`--dry-run` is an alias for `--dry`. A dry run runs the verification gates and
restores its manifest edits. It reads remote refs without fetching them and can
create temporary build or package artifacts. If upstream commits are missing
locally, fetch and reconcile before retrying. A dry run does not prove that
npm or Git will authorize the later write operations.

Before choosing the next version, a live release fetches upstream and checks
the registry. Local `main` may contain new commits ahead of `origin/main`, but it
must contain all upstream commits. The current npm version must match the
registry's latest version before a new bump. A dirty tree, behind/diverged
branch, version mismatch, or conflicting release tag stops the operation.
The driver never force-pushes or silently discards another branch's work.

## What one command does

1. Check the branch, working tree, upstream history, registry version, and
   release state before starting a new version.
2. Run the full test suite, TypeScript check, and shipped-template and
   repository spec checks. Typechecking is mandatory; missing dependencies
   must be repaired rather than skipped.
3. Synchronize `package.json` and both plugin manifests to the target version.
4. Pack once and run onboarding verification against that exact tarball.
   Publish the verified tarball rather than repacking the working directory.
5. Read the published version from npm and compare its integrity with the
   verified artifact. An existing version is accepted only when its artifact
   matches; it is never overwritten.
6. Append version, artifact integrity, and verification evidence to
   `spec/agent-session-ledger.md`. Commit the release, create `vX.Y.Z`, and
   explicitly push `main` and that tag to `origin`. Lightweight tags require
   an explicit push; `--follow-tags` alone is insufficient.

The ledger records verification and the intended Git publication before the
release commit. The command's final success output confirms that the push
completed. Publishing does not close unrelated runtime-acceptance checkboxes.
User-facing release notes, when needed, belong in `docs/releases/`; the driver
does not invent feature summaries or acceptance evidence.

For a standalone check of an existing artifact:

```bash
bash scripts/verify-onboarding.sh --tarball /absolute/path/to/package.tgz
```

Without `--tarball`, onboarding verification packs the current checkout itself.

## Resume an interrupted release

If a precondition or initial verification fails before a release state is
saved, repair the cause and rerun the original `bun run release ...` command.
No version has been bumped at that point. Once the driver reports retained
release state, use `finish-release.sh` instead.

After an interrupted release, keep its files and state in place. The driver retains
`specloop-release.json` and its tarball directory `specloop-release/` in Git's
metadata directory (normally `.git/`) so
recovery can use the same version and artifact. It removes this state after
success. These local recovery files are not committed.

```bash
bash scripts/finish-release.sh --dry  # inspect and verify recovery
bash scripts/finish-release.sh        # complete the current version; no bump
```

Recovery still runs the required checks. Only the release driver's own
expected version/ledger changes are accepted in a dirty recovery tree;
unrelated edits must be resolved first. With no saved state, recovery requires
a clean checkout whose current version is already committed. It verifies and
packs that version, then either publishes it or confirms that the existing
registry artifact matches before completing Git publication.

An existing matching tag stays at its original commit; appending recovery
evidence can advance `main` with a separate commit. Final output identifies
both targets. Already-published recovery skips npm publishing authentication
and publication, but still requires registry reads and Git access. An
unpublished recovery target older than the registry's latest version stops
instead of moving `latest` backwards.

| Failure | Recovery |
|---|---|
| npm authentication or permission failure | Refresh authentication with `npm login`, or repair the publishing credential in the secret store. Rerun the original command if no state was saved; otherwise run `bash scripts/finish-release.sh`. Investigate the credential and permission cause rather than assuming every failure requires an OTP. |
| npm publish may have succeeded but the response or registry check failed | Restore network/registry access and run `bash scripts/finish-release.sh`; it checks the existing version and artifact before retrying publication. |
| Registry version already exists | Run `bash scripts/finish-release.sh` for the interrupted version. A matching artifact is reused; a mismatch blocks for investigation. Never attempt to replace published bytes. |
| Tag creation or push failed | Restore Git access and run `bash scripts/finish-release.sh`. It verifies the existing release and retries the explicit branch/tag push without another version bump. |
| Upstream advanced or histories diverged | Inspect `git fetch origin` and `git log --oneline --left-right main...origin/main`; reconcile deliberately. Do not force-push, delete recovery state, or move a published tag to conceal the conflict. |
| Verification failed | Fix the reported failure and preserve any saved release state. Before publishing, resolve source changes through the driver's safety checks; if an artifact is already published, fixes belong in a subsequent release. |

For independent confirmation, substitute the intended version and tag:

```bash
npm view @khangtoh/specloop@X.Y.Z version dist.integrity --json
git ls-remote origin refs/heads/main refs/tags/vX.Y.Z
```

Legacy `--skip-verify` and `--otp` script options are unsupported. Use working
npm authentication and the full verification path. Do not rerun
`bun run release minor` to recover a partial minor release: it requests another
version instead of finishing the existing one.
