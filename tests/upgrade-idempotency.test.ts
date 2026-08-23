import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-idempotency-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("a second upgrade --apply reports nothing to adopt and makes no writes", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir);
  writeFileSync(
    join(specDir, "01-existing.md"),
    "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n",
  );

  expect(runUpgrade(dir, { apply: true })).toBe(0);
  const before = snapshot(dir);
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(" "));
  try {
    expect(runUpgrade(dir, { apply: true })).toBe(0);
  } finally {
    console.log = originalLog;
  }

  expect(output.join("\n")).toContain("Nothing to adopt.");
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
