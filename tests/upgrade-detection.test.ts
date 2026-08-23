import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { detect, runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-detect-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("detect classifies a specloop project", () => {
  phase("spec/01-a.md", "Goal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  process("spec/spec-summary-status.md");
  process("spec/goal-completion-check.md");
  process("spec/agent-session-ledger.md");
  expect(detect(dir).model).toBe("specloop");
});

test("detect classifies a dillinger-like project", () => {
  phase("spec/01-a.md", "Goal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  expect(detect(dir).model).toBe("dillinger-like");
});

test("detect classifies a PRD project as omarchy-like", () => {
  phase("spec/01-a.md", "## Summary\n\n## Problem\n\n## Scope\n");
  expect(detect(dir).model).toBe("omarchy-like");
});

test("detect classifies unstructured numbered specs as ad-hoc", () => {
  phase("spec/01-a.md", "# Notes\n\nSome text.\n");
  expect(detect(dir).model).toBe("ad-hoc");
});

test("detect reports no spec model and upgrade exits successfully", () => {
  expect(detect(dir).model).toBe("none");
  expect(runUpgrade(dir)).toBe(0);
});

test("detect resolves all supported spec directories", () => {
  for (const specDir of ["spec", "docs/specs", "specs"]) {
    const fixture = join(dir, specDir.replace("/", "-"));
    mkdirSync(join(fixture, specDir), { recursive: true });
    expect(detect(fixture).specDir).toBe(specDir);
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("detect reports every structural flag from a hand-built fixture", () => {
  phase("spec/01-a.md", "Goal: g.\n\nDepends on: None.\n\n## Summary\n\n- [ ] t\n");
  writeFileSync(join(dir, "spec", "BACKLOG.md"), "# Backlog\n");
  process("spec/spec-summary-status.md");
  process("spec/goal-completion-check.md");
  process("spec/agent-session-ledger.md");
  writeFileSync(join(dir, "AGENTS.md"), "agent instructions\n");
  const result = detect(dir);
  expect(result.numbered).toEqual(["01-a.md"]);
  expect(result.hasTasks).toBe(true);
  expect(result.hasGoalDepends).toBe(true);
  expect(result.hasPrdSections).toBe(true);
  expect(result.hasBacklog).toBe(true);
  expect(result.hasProcessFiles).toEqual({ summaryStatus: true, goalCheck: true, ledger: true });
  expect(result.hasAgents).toBe(true);
});

function phase(name: string, content: string): void {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), content);
}

function process(name: string): void {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), "process\n");
}
