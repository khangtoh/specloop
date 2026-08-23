import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-dry-run-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("upgrade without --apply writes nothing", () => {
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, "spec", "01-existing.md"), "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n");
  const before = snapshot(dir);

  expect(runUpgrade(dir)).toBe(0);
  expect(snapshot(dir)).toEqual(before);
});

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) Object.assign(files, snapshot(file));
    else files[relative(dir, file)] = createHash("sha256").update(readFileSync(file)).digest("hex");
  }
  return files;
}
