# Phase 11 — Upstream spec sync at task boundaries

Goal: a long-running loop picks up spec changes another agent pushed upstream, at every task boundary, by merging only the spec files three ways, so the loop builds against the current spec without taking upstream code mid-run and without losing its own checkbox, findings or ledger edits.

Depends on: None.

## Decisions

Owner direction, 2026-10-04, from the getintro repository. A loop running all phases cannot see a phase spec that another agent pushed to main after the run began. A periodic pull does not solve it, because the loop must re-read at a safe point and its own commits make a fast-forward impossible.

What `specloop sync` does:

- **When it runs.** At task boundaries only: after a box is checked and committed, before the next one is chosen.
- **What it touches.** Only the configured spec directory, plus any paths in an optional `syncPaths` in `.specloop.json`. It does not rebase, and upstream code is not taken mid-run.
- **How each file is merged:**
  - most files merge three ways;
  - the session ledger merges three ways, falling back to union, because it is append-only;
  - the run-state file always keeps the local copy, because it records this run.
- **The merge base.** It is the upstream commit last synced, held in a local ref (`refs/specloop/synced/<remote>/<branch>`), so a later sync never re-applies an earlier one. The first sync uses the merge base.
- **Atomic.** Every merge is computed before anything is written. Any conflict, a spec path with uncommitted changes, or a failing `specloop check` afterwards writes nothing (or puts it back), and the command exits 2 with the reason.
- **Inspect, then apply.** It inspects by default, like refresh and group. `--apply` writes the result and makes one local commit, "spec: sync from <remote>/<branch> @<sha>". It never pushes.
- **What it reports:**
  - the phases that changed;
  - the number of new ledger entries;
  - whether BACKLOG or the index changed;
  - the phase in progress, from the run state, when it changed;
  - checked tasks whose wording changed upstream.
- **Exit codes.** 0 when nothing in scope changed, 10 when changes were (or would be) synced, 2 when the loop must stop and reconcile, 1 for a usage or git error.

## Tasks

- [x] (p1) Implement `specloop sync [--apply] [--remote <name>] [--branch <name>] [--json]`: fetch, choose the base, collect upstream-changed files under the spec directory and `syncPaths`, merge each by its rule in memory, and apply atomically with one commit and the synced ref
- [x] (p1) Stop safely: refuse when a spec path has uncommitted changes; report every conflict and write nothing; put back and exit 2 when `specloop check` fails after the merge; handle upstream additions and deletions, and a deletion that meets a local edit as a conflict
- [x] Report what changed for the agent: changed phases (flat and grouped), new ledger entries, BACKLOG and index changes, the run state's current phase when it changed, and checked tasks whose wording changed; text and `--json`
- [x] Route the loop through it: the loop reference, the specloop skill menu, the CLI help, the template and repository `AGENTS.md` loop sections, and the methodology docs; record the 0.8.1 digests of changed shipped assets in `legacy-assets.json` so existing installs refresh cleanly
- [x] Verify with temporary repositories and a bare remote:
  - nothing to sync;
  - an upstream phase edit;
  - a new upstream phase;
  - both sides appending the ledger;
  - a second sync not re-applying the first;
  - a run-state change kept local;
  - a conflicting line;
  - a dirty spec path;
  - a check failure put back;
  - code outside the spec untouched;
  - the in-progress and checked-wording reports;
  - `--json`;
  - and the run of regression, typecheck, both structural checks, and packed onboarding

## Findings / Results

- _2026-10-04_ — Authored from the owner's direction; ledger reconciliation precedes implementation.
- _2026-10-04_ — Built and verified. All five tasks are checked.

  What was built:

  - **`src/commands/sync.ts`.** `syncSpecs`, which returns a report and prints nothing, and `runSync`, which prints it as text or JSON and maps it to exit codes 0, 10, 2 and 1.
  - **The CLI.** `sync` is a command, with `--apply`, `--remote`, `--branch` and `--json`.
  - **Configuration.** `SpecloopConfig.syncPaths` defaults to `[]`.
  - **Where it syncs from.** The flags, else the branch's tracking branch, else origin/main. It fetches that one branch and works from `FETCH_HEAD`.
  - **The base.** The base is `refs/specloop/synced/<remote>/<branch>` when upstream still contains it, otherwise the merge base.
  - **What it merges.** Upstream-changed paths come from `git diff --no-renames` within the spec directory and `syncPaths`. Each file is:
    - kept local, for the run state at the spec root;
    - left alone, when upstream already matches;
    - taken, when the local copy is untouched since the base;
    - a conflict, for a delete against an edit or an add on both sides with different content;
    - otherwise merged with `git merge-file`, with `--union` for the ledger only.
  - **Writing.** Results are written only after every file merged cleanly. `specloop check` then runs, and a failure restores the local copies. The commit is limited to the synced paths, so other staged work is untouched.
  - **Uncommitted changes.** Read with `status -z`, untrimmed, so the first path keeps its leading column.
  - **Symlinked roots.** Paths are compared after `realpath`, which macOS's `/var` symlink needed.

  Routing:

  - **The loop reference.** A new step 6 at the task boundary covers each exit code; the later steps are renumbered.
  - **The skill.** The menu has a `sync` row, its argument hint includes it, and it is in the CLI routing list, as a dry run unless `--apply`.
  - **Instructions and docs.** The template and repository `AGENTS.md` loop sections, the methodology section "Specs that change while a loop runs", and the README all cover it.
  - **Existing installs.** `legacy-assets.json` now holds the 0.8.1 digests of the changed loop reference, the skill (both its Claude and Codex bodies) and `AGENTS.md`, so `refresh` updates existing installs instead of asking for a manual merge. A test pins those digests.

  Verified:

  - **`tests/sync.test.ts`, 16 tests.** They use a bare remote with two clones, the loop and another agent, and cover:
    - nothing to sync;
    - an upstream edit to a phase the loop has not reached, while the loop keeps its checked box, index count and ledger entry, upstream code is not taken, and nothing is rebased;
    - a second sync not re-applying the first, with no duplicated ledger entries;
    - a new phase with its index row and BACKLOG entry;
    - the run state kept local;
    - a conflict that writes nothing and leaves the ref unmoved;
    - an uncommitted spec path;
    - a check failure put back;
    - inspect mode;
    - the in-progress and reworded-checked-task flags;
    - deletions, both taken and conflicting;
    - `syncPaths`;
    - the CLI's JSON output and exit codes 0, 10 and 2;
    - an error outside git;
    - the legacy digests.
  - **The suite.** The full suite has 179 tests, all passing; the typecheck passes; `check:spec` and `check:self` are valid; packed onboarding passes 94 of 94.
  - **Real use.** Run from this checkout against the getintro repository, inspecting only: its main was up to date, and a branch another agent pushed would sync two spec files (the index and the ledger, with 2 new entries) while its code changes were left alone.

  Not done: a version bump, a release or a push, none of which were asked for. Live loop behaviour in a native runtime was not exercised; the loop step is instruction text that the tests and the tabletop run do not prove an agent follows.
