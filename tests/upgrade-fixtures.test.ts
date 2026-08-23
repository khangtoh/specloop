import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgrade } from "../src/commands/upgrade.js";
import { check } from "../src/validator/index.js";
import { loadConfig } from "../src/config.js";

let dir: string;
const fixtures = join(import.meta.dir, "fixtures", "upgrade");

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "specloop-upgrade-fixture-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("dillinger fixture adopts hermetically with an ordered backlog and clean check", () => {
  copy("dillinger");
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  expect(readFileSync(join(dir, "spec", "BACKLOG.md"), "utf8")).toContain("- 01 Dillinger fixture");
  expect(check(dir, loadConfig(dir)).ok).toBe(true);
});

test("omarchy fixture adopts hermetically and reports expected PRD gaps without changing the source", () => {
  const source = join(fixtures, "omarchy", "spec", "01-prd.md");
  const before = readFileSync(source, "utf8");
  copy("omarchy");
  expect(runUpgrade(dir, { apply: true })).toBe(0);
  expect(existsSync(join(dir, "spec", "BACKLOG.md"))).toBe(true);
  const rules = check(dir, loadConfig(dir)).issues.map((issue) => issue.rule);
  expect(rules).toContain("missing-goal");
  expect(readFileSync(source, "utf8")).toBe(before);
});

function copy(name: string): void {
  cpSync(join(fixtures, name), dir, { recursive: true });
}
