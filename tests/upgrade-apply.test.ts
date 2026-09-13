import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../src/commands/upgrade.js";
import { runCheck } from "../src/commands/check.js";

let dir: string;
const template = join(import.meta.dir, "..", "template");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-apply-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("upgrade --apply scaffolds missing files from templates and uses the detected spec directory", () => {
  const specDir = join(dir, "docs", "specs");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "01-alpha.md"), "# Phase 01 — Alpha\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  writeFileSync(join(specDir, "02-2fa.md"), "# 2FA setup\n\nGoal: g.\n\nDepends on: 01.\n\n- [ ] t\n");

  expect(runUpgrade(dir, { apply: true })).toBe(0);

  for (const name of ["spec-summary-status.md", "goal-completion-check.md", "agent-session-ledger.md"]) {
    expect(readFileSync(join(specDir, name), "utf8")).toBe(readFileSync(join(template, "spec", name), "utf8"));
  }
  expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(readFileSync(join(template, "AGENTS.md"), "utf8"));
  expect(JSON.parse(readFileSync(join(dir, ".specloop.json"), "utf8")).specDir).toBe("docs/specs");
  expect(readFileSync(join(specDir, "BACKLOG.md"), "utf8")).toContain("- 01 Alpha\n- 02 2FA setup");
});

test("upgrade --apply leaves a layout that passes specloop check", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir, { recursive: true });
  writeFileSync(
    join(specDir, "01-legacy.md"),
    "# Phase 01 — Legacy\n\nGoal: g.\n\nDepends on: None.\n\n- [x] done\n- [ ] open\n",
  );

  const log = console.log;
  console.log = () => {};
  let upgraded: number;
  let checked: number;
  try {
    upgraded = runUpgrade(dir, { apply: true });
    checked = runCheck(dir);
  } finally {
    console.log = log;
  }

  expect(upgraded).toBe(0);
  // The adopted repo must validate immediately — upgrade tells the user to run this.
  expect(checked).toBe(0);

  const index = readFileSync(join(specDir, "README.md"), "utf8");
  expect(index).toContain("[01-legacy.md](01-legacy.md)");
  expect(index).toContain("🟡 1/2");
  expect(index).not.toContain("01-example-phase.md");
});
