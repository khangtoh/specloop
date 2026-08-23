import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../src/commands/upgrade.js";
import { check } from "../src/validator/index.js";
import { loadConfig } from "../src/config.js";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-validation-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("post-apply validation is clean for dillinger input and reports PRD re-authoring gaps", () => {
  seed(
    "# Phase 01 — Dillinger\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n",
    "| 1 | [01-a.md](01-a.md) | Dillinger | ⬜ 0/1 | None |\n",
  );
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  expect(check(dir, loadConfig(dir)).ok).toBe(true);

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  seed(
    "# PRD\n\n## Summary\n\n## Problem\n\n## Scope\n",
    "| 1 | [01-a.md](01-a.md) | PRD | ⬜ 0/0 | None |\n",
  );
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  const rules = check(dir, loadConfig(dir)).issues.map((issue) => issue.rule);
  expect(rules).toContain("missing-goal");
  expect(rules).toContain("missing-depends-on");
});

function seed(phase: string, row: string): void {
  const specDir = join(dir, "spec");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "01-a.md"), phase);
  writeFileSync(
    join(specDir, "README.md"),
    "# Index\n\n| # | File | Purpose | Status | Blocking dependency |\n|---|---|---|---|---|\n" + row,
  );
}
