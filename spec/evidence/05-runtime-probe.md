# Phase 05 runtime probe — 2026-09-17

This is partial live evidence, not hook acceptance.

- Runtime: `codex-cli 0.154.0`; fresh throwaway project initialized using
  `bun run bin/specloop.ts init /tmp/specloop-runtime-proof --agent codex`.
- Probe: `codex exec --ephemeral --ignore-user-config --skip-git-repo-check
  --sandbox read-only -C /tmp/specloop-runtime-proof --json` with the prompt:
  “Read-only acceptance probe: state whether you received specloop SessionStart
  or UserPromptSubmit reconciliation context, and list the four required
  conflict fields. Do not edit any files.”
- Sandbox initialization initially failed with `Operation not permitted`;
  the approved outside-sandbox retry completed successfully.
- Observed tool action: read `.agents/skills/specloop/SKILL.md`,
  `spec/agent-session-ledger.md`, `spec/spec-summary-status.md`, `spec/README.md`.
- The fixture did not put `specloop` on PATH; its attempted validator command
  failed with `command not found`. Packaged onboarding separately validates
  a real installed CLI.
- Exact relevant final response:

> I received **no visible SessionStart or UserPromptSubmit hook reconciliation context**. I received reconciliation instructions through your supplied AGENTS.md and the files I read.

The response correctly listed Previous decision, Conflicting instruction,
Resolution, and Scope and consequences. This proves skill/instruction loading,
not hook activation or Stop behavior. Trust/activation must be reviewed in a
fresh session before the full acceptance procedure can run. Unrelated user
hooks were present, so broad hook-trust bypass was not used.

Claude inspection: `2.1.236 (Claude Code)`; `claude auth status` reported
`loggedIn: false`, `authMethod: none`. Authenticated Claude acceptance remains
pending. No claims are made about Stop retries, Plan Mode or semantic conflict
handling in a live runtime from the synthetic unit tests.
