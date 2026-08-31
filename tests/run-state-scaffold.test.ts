import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";
import { check } from "../src/validator/index.js";
import { DEFAULT_CONFIG } from "../src/config.js";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "specloop-run-state-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("init scaffolds the advisory run-state record and the result validates", () => {
  expect(runInit(dir)).toBe(0);
  expect(existsSync(join(dir, "spec", "specloop-run-state.md"))).toBe(true);
  expect(check(dir, DEFAULT_CONFIG).ok).toBe(true);
});

test("the run-state record remains optional to structural validation", () => {
  expect(runInit(dir)).toBe(0);
  rmSync(join(dir, "spec", "specloop-run-state.md"));
  expect(check(dir, DEFAULT_CONFIG).ok).toBe(true);
});
