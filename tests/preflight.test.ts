import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPreflight } from "../src/commands/preflight.js";
import { main } from "../src/cli.js";

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


test("missing origin warns ordinarily and blocks a clean-clone goal", () => {
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  const output: string[] = []; const original = console.log; console.log = (...a: unknown[]) => output.push(a.join(" "));
  try { expect(runPreflight(dir, { json: true }).exitCode).toBe(1); } finally { console.log = original; }
  let result = JSON.parse(output.join("\n"));
  expect(result.checks.find((c: { id: string }) => c.id === "git").status).toBe("warning");

  appendFileSync(join(dir, "spec", "specloop-run-state.md"), "\nStated goal: verify clean-clone proof.\n");
  output.length = 0; console.log = (...a: unknown[]) => output.push(a.join(" "));
  try { expect(runPreflight(dir, { json: true }).exitCode).toBe(1); } finally { console.log = original; }
  result = JSON.parse(output.join("\n"));
  const git = result.checks.find((c: { id: string; status: string }) => c.id === "git");
  expect(git.status).toBe("blocked");
  expect(git.action).toContain("origin");
});


test("first blocked check names its failing command and exits nonzero", () => {
  writeFileSync(join(dir, "package.json"), "{}");
  const errors: string[] = []; const original = console.error; console.error = (...a: unknown[]) => errors.push(a.join(" "));
  try { expect(runPreflight(dir).exitCode).toBe(1); } finally { console.error = original; }
  expect(errors.join("\n")).toContain("git rev-parse --is-inside-work-tree");
  expect(errors.join("\n")).toContain("git init");
});


test("a fully healthy fixture passes every check", () => {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ engines: { bun: ">=1.1.0" } }));
  mkdirSync(join(dir, "node_modules"));
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: dir });
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "https://example.test/specloop.git"], { cwd: dir });
  const output: string[] = []; const original = console.log; console.log = (...a: unknown[]) => output.push(a.join(" "));
  try { expect(runPreflight(dir, { json: true }).exitCode).toBe(0); } finally { console.log = original; }
  const result = JSON.parse(output.join("\n"));
  expect(result.checks).toHaveLength(5);
  for (const check of result.checks) expect(check.status).toBe("pass");
});


test("help paths run no checks on a broken fixture", () => {
  rmSync(join(dir, "AGENTS.md"));
  const output: string[] = []; const original = console.log; console.log = (...a: unknown[]) => output.push(a.join(" "));
  try {
    expect(main(["bun", "specloop", "help"])).toBe(0);
    expect(main(["bun", "specloop", "--help"])).toBe(0);
  } finally { console.log = original; }
  expect(output.join("\n")).toContain("Usage:");
  expect(output.join("\n")).not.toContain("| Check | Result | Action |");
});


test("bare specloop blocks on a broken fixture", () => {
  const result = spawnSync("bun", ["run", join(import.meta.dir, "..", "bin", "specloop.ts")], { cwd: dir, encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("| Check | Result | Action |");
  expect(result.stderr).toContain("Preflight blocked");
});
