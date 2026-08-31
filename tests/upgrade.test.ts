import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("upgrade --apply keeps existing protected adoption files unchanged and reports them", () => {
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, "spec", "01-existing.md"), "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n");
  const sentinels = new Map([
    [join(dir, "AGENTS.md"), "agents sentinel\n"],
    [join(dir, ".specloop.json"), "config sentinel\n"],
    [join(dir, "spec", "BACKLOG.md"), "backlog sentinel\n"],
    [join(dir, "spec", "spec-summary-status.md"), "summary sentinel\n"],
    [join(dir, "spec", "goal-completion-check.md"), "goal sentinel\n"],
    [join(dir, "spec", "agent-session-ledger.md"), "ledger sentinel\n"],
    [join(dir, "spec", "specloop-run-state.md"), "run state sentinel\n"],
  ]);
  for (const [file, content] of sentinels) writeFileSync(file, content);

  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(" "));
  try {
    expect(runUpgrade(dir, { apply: true })).toBe(0);
  } finally {
    console.log = originalLog;
  }

  for (const [file, content] of sentinels) {
    expect(readFileSync(file, "utf8")).toBe(content);
    expect(output.join("\n")).toContain(`${file.split("/").pop()} exists — kept`);
  }
});

test("upgrade --apply adds the optional run-state record when absent", () => {
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, "spec", "01-existing.md"), "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n");

  expect(runUpgrade(dir, { apply: true })).toBe(0);
  expect(readFileSync(join(dir, "spec", "specloop-run-state.md"), "utf8")).toContain("Run status:");
});
