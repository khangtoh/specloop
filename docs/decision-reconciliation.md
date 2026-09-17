# Decision reconciliation

Before every task and after resumption or compaction, read the session ledger
and relevant authoritative specs. This includes direct requests outside the
loop. The contract is shipped in instructions, skills, commands and
`spec/decision-reconciliation.md`; no new required validator file is introduced.

Record conflicts before dependent implementation in the existing append-only
`agent-session-ledger.md`, using a dated entry with **Previous decision**,
**Conflicting instruction**, **Resolution**, and **Scope and consequences**.
Name sources, retained requirements, superseded requirements and remaining work.
Clear user overrides require no repeated permission; genuinely ambiguous
conflicts require clarification. Update authoritative specs with a supersession
reference and leave historical completed checkboxes intact. In Plan Mode,
review and describe the pending reconciliation without writing project files.

## Runtime behavior

SessionStart injects the contract and ledger location, including startup,
resume and compaction. UserPromptSubmit repeats the reminder and captures a
content baseline. Stop compares file content and executable bits, including
changes committed since the prompt. A nonempty append preserving all original
ledger bytes satisfies the mechanical check. Ledger rewrites are flagged.
A first failure requests one correction pass; a repeated failure emits an
unresolved warning without forcing another continuation. Read-only questions
need no ledger entry, and Plan Mode skips baseline and ledger enforcement.

Baselines are private files beneath the OS temporary directory, keyed by the
canonical project path, runtime and session ID. `SPECLOOP_HOOK_STATE_DIR` can
select a persistent writable location outside the project when needed. They
store hashes and the initial ledger bytes, never prompts or source-file bodies.
Do not point this directory inside the tracked workspace. Stale state can be
removed after sessions end. An interrupted turn retains its original baseline
through resumption; a successfully closed turn starts fresh on the next prompt.

Git projects consider tracked and nonignored untracked files. Non-Git projects
use a recursive scan excluding `.git`, `node_modules`, `.cache`, `dist`, and
`build`. Pure Git metadata changes and ignored generated files are not material
for this check. Changes reverted before Stop are invisible. Concurrent sessions
have separate baselines but share workspace contents: another session's edits
or append may affect the check. Attribution and semantic completeness remain
the agent's responsibility. Missing/corrupt baselines, inaccessible files, and
runner errors produce warnings, not endless continuation. Large repositories
may hit the configured 30-second timeout; inspect runtime hook errors.

## Installation and activation

Run `init --agent claude|codex|both` or `upgrade --apply --agent ...`.
Claude remains the default. `--skills none` skips all agent integration.
`refresh --agent both` previews updates; `--apply` changes only recognizable
assets and merges hook events while preserving other settings. Exit 2 means
manual merges remain. Existing ledgers are never refresh targets. Customized
AGENTS.md/CLAUDE.md files must incorporate the contract manually; fresh Claude
installs get a CLAUDE.md import of AGENTS.md. Link-mode assets are preserved by
refresh so it cannot mutate their source checkout.

Codex loads project skills from `.agents/skills`. See the official
[skill locations](https://learn.chatgpt.com/docs/build-skills).
Codex project hooks use `.codex/hooks.json`; project trust and review of each
unmanaged hook definition are required. Inspect `/hooks` after restarting.
Changed definitions may require renewed trust. See the official
[Codex hook contract](https://learn.chatgpt.com/docs/hooks).
Claude project hooks are merged into `.claude/settings.json`. Review project
trust and `/hooks`, then start a fresh session to verify the configuration;
settings or managed policy can disable hooks. See the official
[Claude hook reference](https://code.claude.com/docs/en/hooks).
These hooks require Bun on PATH and a POSIX shell. Windows without a compatible
shell is not verified. The CLI reports installed configuration, never active
status: only a real runtime observation establishes activity.

## Live acceptance procedure

Use a throwaway repository, install the packed package, select the runtime,
review/trust the generated hooks, and record runtime version and transcript.
Do not substitute invoking the runner with JSON payloads for runtime evidence.

1. Start, resume, and compact: observe injected reconciliation context and
   ledger reads before work. Existing baselines must survive compaction.
2. Seed a project decision, then give a clear override: observe the four-field
   ledger resolution before implementation, updated spec and no repeated
   permission request. Partially supersede it next; retained requirements survive.
3. Give an ambiguous conflict: observe a clarification request before dependent
   changes. Resume after answering and verify the resolution references the answer.
4. Request ordinary work without a conflict: observe a normal session entry,
   without an invented conflict. Ask a read-only question: no ledger churn.
5. In an instrumentation fixture omit an append after a material edit, also
   testing a commit before Stop. Observe one correction pass. Keep the omission
   for that pass and verify the unresolved warning ends further continuations.
6. Enter Plan Mode: review works, no ledger mutation requirement or baseline
   writes. Exit Plan Mode and repeat a normal task.

Record actual hook outputs, file ordering and resulting diffs in phase Findings.
Keep runtime and realistic behavior checkboxes open until all scenarios are
observed. Publishing is a separate task.
