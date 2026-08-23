import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runUpgrade } from "../src/commands/upgrade.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-phases-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("upgrade --apply leaves every existing numbered phase byte-identical", () => {
  const specDir = join(dir, "spec");
  mkdirSync(specDir);
  const phases = new Map([
    ["01-first.md", "# First\n\nGoal: first.\n\nDepends on: None.\n\n- [ ] keep exact whitespace  \n"],
    ["02-second.md", "# Second\r\n\r\nGoal: second.\r\n\r\nDepends on: 01.\r\n\r\n- [x] complete\r\n"],
  ]);
  for (const [name, content] of phases) writeFileSync(join(specDir, name), content);
  const hashes = new Map([...phases.keys()].map((name) => [name, sha256(join(specDir, name))]));

  expect(runUpgrade(dir, { apply: true })).toBe(0);

  for (const [name, before] of hashes) expect(sha256(join(specDir, name))).toBe(before);
});

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}
