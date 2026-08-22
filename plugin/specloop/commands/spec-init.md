---
description: Scaffold the specloop spec/ structure into this repo and seed the first real phases from a stated goal.
argument-hint: "<one-sentence project goal>"
---

Set up specloop in this repository.

1. If `specloop` is available on PATH, run `specloop init`. Otherwise copy the
   plugin's `template/spec/` directory, `template/AGENTS.md`, and
   `template/.specloop.json` into the repo root (never overwrite an existing
   `AGENTS.md` — merge the specloop section into it instead).
2. Open `spec/README.md` and set the top `Goal:` line from `$ARGUMENTS` (ask
   the user for the goal if it's empty). Fill in the `Status` acceptance
   checkbox and the `Non-goals` section.
3. Decompose the goal into ordered phases. For each phase, copy
   `spec/_TEMPLATE-phase.md` to `spec/NN-title.md`, write its `Goal:` and
   `Depends on:` lines, and list its atomic tasks as `- [ ]` checkboxes — each
   completable and verifiable in one short sitting.
4. Replace the example phase (`spec/01-example-phase.md`) with your real
   Phase 01, and update the phase table in `spec/README.md` so every phase file
   has a row with the correct `checked/total` and status emoji.
5. Run `specloop check` and fix anything it reports until it exits clean.
6. Hand off with the `Spec Summary/Status` section from
   `spec/spec-summary-status.md`.

Do not start implementing tasks in this command — this only establishes the
spec. Use `/spec-loop` to execute it.
