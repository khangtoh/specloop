# Phase 06 inline argument-hint evidence — 2026-09-27

## Claude Code runtime

Runtime: `Claude Code 2.1.283`. Fixture initialized from this checkout with
`bun run bin/specloop.ts init <project> --agent both`, then opened in
`claude` inside a 200×40 tmux pane. The session was not authenticated (a
placeholder API key only got past the login screen), so no turn was
submitted. Slash-command autocomplete and argument hints render locally
before submission, which is all this check covers.

Typing `/specloop` listed the project skill. Typing `/<name> ` (with the
trailing space) rendered each hint inline after the cursor:

```text
❯ /specloop  [loop|status|list · prio spec|prio task · init|upgrade|refresh · check|preflight|audit · layout|group · help|version] [args]
❯ /prio-spec  <NN> <pos>
❯ /list-spec  [all|done|undone]
❯ /spec-layout  [NN]
❯ /spec-upgrade  [dir]
```

This proves the hints render. It does not cover the open Phase 06 box
(submitting `/specloop` and checking the read-only menu response), which
still needs an authenticated Claude session.

## Codex form

Installed `.agents/skills/*/SKILL.md` carry the hint under `metadata:`:

```yaml
metadata:
  argument-hint: "[loop|status|list · prio spec|prio task · init|upgrade|refresh · check|preflight|audit · layout|group · help|version] [args]"
  version: "0.2.0"
```

`skill-creator/scripts/quick_validate.py` reports `Skill is valid!` for all
five Codex copies. The Claude copies fail it by design: `argument-hint` is a
Claude extension outside the Agent Skills spec (impeccable's Claude copies
fail it the same way).

## Automated checks

- `bun test`: 148 pass / 0 fail. New: hint coverage for every skill and
  command, and the `specloop` hint naming every menu action; both runtime
  forms after `init --agent both`; manifest-less refresh of published 0.7.0
  skill bytes to `update`, then `current`.
- `bun run typecheck` exit 0; `bun run check:spec` and `specloop check --dir .` valid.
- `bun run verify:onboarding`: 90 passed, 0 failed over the packed tarball.
