import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detect, runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-edge-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("an empty spec directory is classified as none", () => {
  mkdirSync(join(dir, "spec"));
  expect(detect(dir).model).toBe("none");
  expect(runUpgrade(dir)).toBe(0);
});

test("mixed inputs use detection priority and backlog includes every phase", () => {
  seed("01-dillinger.md", "# Dillinger\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  seed("02-prd.md", "# PRD\n\n## Summary\n\n## Problem\n\n## Scope\n");
  expect(detect(dir).model).toBe("dillinger-like");
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  const backlog = readFileSync(join(dir, "spec", "BACKLOG.md"), "utf8");
  expect(backlog).toContain("- 01 Dillinger\n- 02 PRD");
});

test("an existing backlog is kept rather than regenerated", () => {
  seed("01-a.md", "# A\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  writeFileSync(join(dir, "spec", "BACKLOG.md"), "backlog sentinel\n");
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  expect(readFileSync(join(dir, "spec", "BACKLOG.md"), "utf8")).toBe("backlog sentinel\n");
});

test("generated backlog preserves odd phase titles without over-stripping", () => {
  seed("01-2fa.md", "# 2FA setup\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] t\n");
  seed("02-phase.md", "# Phase 3: Foo\n\nGoal: g.\n\nDepends on: 01.\n\n- [ ] t\n");
  seed("03-bar.md", "# 03 — Bar\n\nGoal: g.\n\nDepends on: 02.\n\n- [ ] t\n");
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  const backlog = readFileSync(join(dir, "spec", "BACKLOG.md"), "utf8");
  expect(backlog).toContain("- 01 2FA setup\n- 02 Foo\n- 03 Bar");
});

function seed(name: string, content: string): void {
  mkdirSync(join(dir, "spec"), { recursive: true });
  writeFileSync(join(dir, "spec", name), content);
}
