# Phase 05 — Grouped phase layout (folder of sub-specs)

Goal: a phase can live either as one flat file (`spec/NN-slug.md`) or as a
folder of sub-specs (`spec/NN-slug/README.md` + `NNa-*.md`, `NNb-*.md`, …),
and every command treats both identically; `specloop layout` recommends which
layout suits each phase, and `specloop group <NN>` moves a flat phase into a
folder — splitting its task sections into sub-specs — without losing a
checkbox or breaking a link.

Depends on: None (builds on the 0.3.0 validator/BACKLOG model; independent of
Phases 03 and 04).

<!--
  Decisions locked for this phase (user request, 2026-09-26, while adopting
  specloop in dillinger-aws whose Phase 11 is a folder):
    - Both layouts are first-class. Flat stays the default for `init`.
    - A grouped phase's root is `NN-slug/README.md`; it carries the required
      `Goal:` / `Depends on:` lines. Sub-spec files (any other `*.md` in the
      folder, sorted by name) do NOT need them.
    - Progress is AGGREGATE: README boxes first, then each sub-spec in name
      order. Task numbers (`prio-task NN.T`) run across the whole group.
    - Phase identity stays the number `NN` — BACKLOG entries never change
      when a phase is grouped.
    - `group` is a dry run by default and needs `--apply`, like `upgrade`.
      It refuses to write if the checkbox count/checked totals would change.
    - Only the flat → grouped direction is automated here. Flattening a group
      is recommended by `layout` but done by hand.
-->

## A. Parser and validator

- [x] (p1) Replace the naive ```` ``` ```` toggle with a CommonMark-style fence
      tracker (backtick or tilde, ≥3, backtick info string may not contain a
      backtick, closing fence same char and ≥ opening length) and use it in the
      phase, malformed-task and backlog parsers. Regression: prose like
      "a ```mermaid fence now renders as `<div>`" must not hide later tasks.
- [x] (p1) Discover grouped phases: a directory matching `^\d{2,}-` under the
      spec dir whose `README.md` exists is one phase; aggregate its README and
      sub-spec tasks, each task recording which file and line it lives on.
- [x] (p1) A numbered directory with no `README.md` is an error
      (`group-missing-root`); Goal/Depends-on rules apply to the root only.
- [x] Malformed-task and invalid-priority issues point at the sub-spec file
      and line, not the group root.
- [x] Index rows resolve links by spec-relative path, so `NN-slug/README.md`,
      `NN-slug/` and `./NN-slug.md` all match the right phase (flat links keep
      working unchanged).

## B. Commands consume both layouts

- [x] `status` and `list-spec` show a grouped phase once with aggregate
      counts; `status` names the file holding the next box.
- [x] `prio-task NN.T` edits the correct sub-spec file for a grouped phase.
- [x] `upgrade` detection counts grouped phases, generates BACKLOG entries for
      them, and scans their sub-spec bodies for tasks/Goal/PRD markers.

## C. Layout recommendation — `specloop layout`

- [x] (p1) Add `src/layout.ts`: per phase, report its layout and a
      recommendation — `group` for an incomplete flat phase with > 40 tasks
      (in ≥ 2 task sections), or > 25 tasks across ≥ 3 `##` sections of ≥ 3
      tasks, listing the proposed sub-specs; `flatten` for a grouped phase
      with ≤ 1 sub-spec and ≤ 10 tasks; else `keep` (always `keep` for a
      complete phase). Print a one-line project recommendation.
- [x] Add `specloop layout [--json]` and route it in the CLI + HELP text.
- [x] `upgrade` prints the layout recommendation in its report.

## D. Flat → grouped transition — `specloop group <NN>`

- [x] (p1) Dry run prints the plan: the new folder, each proposed sub-spec
      (`NNa-<slug>.md` per `##` section that holds tasks, with counts), and
      every file whose links would be rewritten.
- [x] (p1) `--apply` moves `NN-slug.md` → `NN-slug/README.md` (`git mv` when
      in a git work tree, so history follows), writes the sub-specs, and
      leaves a `## Sub-specs` link list where the first task section was.
- [x] (p1) Refuse to write when the recomputed checked/total differs from the
      original, or when the target folder already exists.
- [x] `--no-split` only moves the file into the folder.
- [x] Rewrite relative links inside moved content (one level deeper) and
      inbound links to `NN-slug.md` in spec markdown files and `AGENTS.md`;
      list (don't edit) any other repo files that mention the old path.

## E. Tests, docs, release

- [x] Tests: grouped discovery + aggregate counts, missing root, index link
      forms, prio-task into a sub-spec, fence regression, layout heuristics,
      group dry-run/apply/no-split/refusal and link rewriting.
- [x] Document both layouts and the two commands in `README.md`,
      `docs/methodology.md`, the plugin skill, and a `/spec-layout` command.
- [x] Dogfood on dillinger-aws: `specloop check` passes with its Phase 11
      folder recognized, and `layout` output is recorded in Findings.
- [ ] Bump to 0.6.0 (additive; no breaking change) and record the release.

## Findings / Results

- _2026-09-26_ — Opened from the dillinger-aws adoption: `specloop check`
  reported `index-orphan-row` for its folder-based Phase 11 and a false
  `index-count-mismatch` (27 vs 36) on Phase 15 caused by an inline
  "```mermaid fence" in prose being read as a code-fence opener.
- _2026-09-26_ — Sections A–D implemented: `createFenceTracker`,
  `discoverPhases`/`parseGroupedPhase` (aggregate tasks carry their source
  file), `group-missing-root`, path-based index matching with flat-basename
  back-compat, group-aware `status`/`list-spec`/`prio-task`/`upgrade`,
  `src/layout.ts` + `specloop layout`, `specloop group <NN>`. Heuristic
  refined during dogfooding: complete phases are always `keep` (dillinger's
  finished Phases 15 and 20 were otherwise flagged). Dogfood fixes: generated
  links were being deepened twice; prose mentions in spec files now reported.
- _2026-09-26_ — Verification: `bun test` 80 pass / 0 fail (21 new in
  `tests/grouped-layout.test.ts`); `check:spec` and `check:self` valid; full
  `tsc` clean against curl-fetched TypeScript 5.9.3 + `@types/node`/`@types/bun`
  (the local `bun install` blocker from Phase 03 persists, so the repo's own
  `bun run typecheck` still can't resolve types).
- _2026-09-26_ — dillinger-aws dogfood: `specloop check` → valid, 20 phases,
  259/454 (Phase 11 folder = 19/19 across README + 11a–11d). `specloop layout`
  → "Mixed layout recommended: group 12, 19": Phase 12 (129 tasks, 9 sections
  → 12a–12i) and Phase 19 (43 tasks, 4 steps); 18 others keep. `group 12
  --apply` on a scratch copy kept 14/129, `git mv`-ed the root, relinked
  `spec/README.md`, and reported 4 files with prose mentions.
- _2026-09-26_ — Renumbered 04 → 05 and rebased onto `origin/main` after the
  first release attempt hit npm `E403` "cannot publish over 0.5.0": the local
  clone predated upstream's Phase 04 (agent-asset onboarding, released 0.5.0 on
  2026-09-13). Merged: upstream's generated phase index now uses
  `discoverPhases`, so adopted grouped phases get `NN-x/README.md` rows; the
  onboarded asset set grows to 5 skills + 8 commands (`spec-layout`). Fixed a
  flake in `scripts/verify-onboarding.sh` (`tar | grep -q` under `pipefail`
  SIGPIPE). Evidence after rebase: `bun test` 93 pass / 0 fail, `check:self`
  valid (5 phases), `check:spec` valid, `tsc` exit 0,
  `bash scripts/verify-onboarding.sh` "onboarding verified end to end" twice.
