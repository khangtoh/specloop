import { afterEach, beforeEach, expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPreflight } from "../src/commands/preflight.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "specloop-preflight-")); cpSync(join(import.meta.dir, "..", "template"), dir, { recursive: true }); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("preflight emits five structured checks for a valid non-git fixture", () => {
  const output: string[] = []; const original = console.log; console.log = (...a: unknown[]) => output.push(a.join(" "));
  try { expect(runPreflight(dir, { json: true }).exitCode).toBe(1); } finally { console.log = original; }
  const result = JSON.parse(output.join("\n"));
  expect(result.checks).toHaveLength(5);
  const git = result.checks.find((c: { id: string; status: string; action: string }) => c.id === "git");
  expect(git.status).toBe("blocked");
  expect(git.action).toBe("git init");
  for (const check of result.checks) expect(check.action.length).toBeGreaterThan(0);
});
