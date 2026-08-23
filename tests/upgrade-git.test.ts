import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runUpgrade } from "../src/commands/upgrade.js";

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-git-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("upgrade --apply only adds files in a git fixture", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir);
  writeFileSync(
    join(specDir, "01-existing.md"),
    "# Phase 01\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] task\n",
  );
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test User"]);
  git(["add", "spec/01-existing.md"]);
  git(["commit", "-m", "fixture"]);

  expect(runUpgrade(dir, { apply: true })).toBe(0);

  const status = git(["status", "--porcelain"]);
  expect(status.trim().split("\n").filter(Boolean)).not.toHaveLength(0);
  expect(status).not.toMatch(/^[ MADRCU][MADRCU]/m);
  expect(status).toMatch(/^\?\? /m);
});

