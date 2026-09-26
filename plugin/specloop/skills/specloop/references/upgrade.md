# Adopt existing specs

Run `specloop upgrade` with the supplied directory and options to inspect the
project. Without `--apply`, return that report without editing anything.
With `--apply`, run the CLI's non-destructive scaffolding, then re-author the
existing PRD/spec content into numbered atomic-task phases:

- Preserve stable numbers, slugs, original intent, and requirements.
- Add Goal and Depends on lines, translating acceptance criteria to atomic
  checkboxes. Check already-completed work only with recorded evidence.
- Reconcile BACKLOG order and the phase index with all phase files.
- Run `specloop check` and fix structural issues. Record findings and the
  session ledger, then use the mandatory Spec Summary/Status handoff.

If the CLI is unavailable or fails, report the cause before doing dependent
work. Do not claim adoption succeeded from a preview alone.
