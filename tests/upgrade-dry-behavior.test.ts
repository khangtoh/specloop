import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../src/commands/upgrade.js";
import { installAgentAssets } from "../src/commands/agentAssets.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-dry-behavior-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("dry-run plan lists exactly the missing adoption pieces", () => {
  phase("Goal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  const output = capture(() => runUpgrade(dir));
  const plan = clean(output).split("\n").filter((line) => line.startsWith("  ◦ "));
  expect(plan).toEqual([
    "  ◦ add spec/spec-summary-status.md",
    "  ◦ add spec/goal-completion-check.md",
    "  ◦ add spec/agent-session-ledger.md",
    "  ◦ generate spec/README.md (phase index) from 1 numbered specs",
    "  ◦ generate spec/BACKLOG.md from 1 numbered specs",
    "  ◦ add spec/specloop-run-state.md (optional advisory run record)",
    "  ◦ add AGENTS.md (specloop binding)",
    "  ◦ add .specloop.json (validator config)",
    "  ◦ install 4 specloop skills and 7 /spec-* commands into .claude/",
  ]);
});

test("a complete specloop layout has an empty adoption plan", () => {
  phase("Goal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  for (const name of ["spec-summary-status.md", "goal-completion-check.md", "agent-session-ledger.md", "BACKLOG.md", "specloop-run-state.md", "README.md"]) {
    writeFileSync(join(dir, "spec", name), "present\n");
  }
  writeFileSync(join(dir, "AGENTS.md"), "present\n");
  writeFileSync(join(dir, ".specloop.json"), "{}\n");
  // A complete layout now includes the project-scoped agent assets.
  const log = console.log;
  console.log = () => {};
  try { installAgentAssets(dir); } finally { console.log = log; }
  const output = clean(capture(() => runUpgrade(dir)));
  expect(output).toContain("Nothing to adopt.");
  expect(output).not.toContain("Adoption plan:");
});

test("the PRD re-authoring note appears only for PRD inputs", () => {
  phase("Goal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  expect(clean(capture(() => runUpgrade(dir)))).not.toContain("PRD-style specs need re-authoring");
  rmSync(join(dir, "spec"), { recursive: true, force: true });
  phase("## Summary\n\n## Problem\n\n## Scope\n");
  expect(clean(capture(() => runUpgrade(dir)))).toContain("PRD-style specs need re-authoring");
});

function phase(content: string): void {
  mkdirSync(join(dir, "spec"), { recursive: true });
  writeFileSync(join(dir, "spec", "01-a.md"), content);
}

function capture(run: () => number): string {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));
  try { expect(run()).toBe(0); } finally { console.log = original; }
  return lines.join("\n");
}

function clean(output: string): string {
  return output.replace(/\x1b\[[0-9;]*m/g, "");
}
