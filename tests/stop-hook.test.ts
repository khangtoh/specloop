import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";
import { runGoal } from "../src/commands/goal.js";
import { decideStopHook } from "../src/commands/stopHook.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { parseRunScope, readRunState, isActive, writeRunState } from "../src/runState.js";

let dir: string;
const LIVE = JSON.stringify({ stop_hook_active: false });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-stop-"));
  runInit(dir);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const runState = () => readFileSync(join(dir, "spec", "specloop-run-state.md"), "utf8");

test("the hook is inert while no run is active", () => {
  // A plugin's hooks fire in every session, so silence by default is the
  // contract: an unarmed specloop must never block an unrelated session.
  expect(decideStopHook(dir, LIVE).block).toBe(false);
});

test("the hook is inert in a directory that is not a specloop project", () => {
  const bare = mkdtempSync(join(tmpdir(), "specloop-bare-"));
  try {
    expect(decideStopHook(bare, LIVE).block).toBe(false);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("an armed run blocks the stop and names the next box", () => {
  expect(runGoal(dir, undefined, { start: true })).toBe(0);
  expect(runState()).toContain("Run status: active");

  const d = decideStopHook(dir, LIVE);
  expect(d.block).toBe(true);
  expect(d.reason).toContain("A specloop run is active");
  expect(d.reason).toContain("Next box — Phase 01.");
  // The way out must be stated, or the only exit is the host's block cap.
  expect(d.reason).toContain("Run status: idle");
});

test("stop_hook_active short-circuits the hook so the block cap can be reached", () => {
  runGoal(dir, undefined, { start: true });
  expect(decideStopHook(dir, JSON.stringify({ stop_hook_active: true })).block).toBe(false);
});

test("setting the run back to idle releases the hook", () => {
  runGoal(dir, undefined, { start: true });
  expect(decideStopHook(dir, LIVE).block).toBe(true);
  writeRunState(dir, DEFAULT_CONFIG, { status: "idle" });
  expect(decideStopHook(dir, LIVE).block).toBe(false);
});

test("a failing specloop check blocks before any checkbox is consulted", () => {
  runGoal(dir, undefined, { start: true });
  // Drift the index away from the phase file: `check` must fail on this.
  const index = join(dir, "spec", "README.md");
  writeFileSync(index, readFileSync(index, "utf8").replace("🟡 2/4", "✅ 4/4"));
  const d = decideStopHook(dir, LIVE);
  expect(d.block).toBe(true);
  expect(d.reason).toContain("specloop check is failing");
});

test("the hook stops blocking once every in-scope box is checked", () => {
  runGoal(dir, undefined, { start: true });
  const phase = join(dir, "spec", "01-example-phase.md");
  writeFileSync(phase, readFileSync(phase, "utf8").replaceAll("- [ ]", "- [x]"));
  const index = join(dir, "spec", "README.md");
  writeFileSync(index, readFileSync(index, "utf8").replace("🟡 2/4", "✅ 4/4"));
  expect(decideStopHook(dir, LIVE).block).toBe(false);
});

test("the hook honours the cwd in the hook payload over its own root", () => {
  runGoal(dir, undefined, { start: true });
  const elsewhere = mkdtempSync(join(tmpdir(), "specloop-cwd-"));
  try {
    expect(decideStopHook(elsewhere, JSON.stringify({ cwd: dir })).block).toBe(true);
    expect(decideStopHook(dir, JSON.stringify({ cwd: elsewhere })).block).toBe(false);
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test("a malformed or empty hook payload is treated as a live stop, not a crash", () => {
  runGoal(dir, undefined, { start: true });
  for (const raw of ["", "not json", "null", "[]"]) {
    expect(decideStopHook(dir, raw).block).toBe(true);
  }
});

test("--start records the scope the hook later reads back", () => {
  expect(runGoal(dir, "loop", { start: true })).toBe(0);
  expect(readRunState(dir, DEFAULT_CONFIG)!.scope).toEqual({ kind: "loop" });
  expect(runState()).toContain("Run scope: loop");
});

test("the run-state scope grammar round-trips every form", () => {
  expect(parseRunScope("loop")).toEqual({ kind: "loop" });
  expect(parseRunScope("phase 03")).toEqual({ kind: "phase", phase: 3 });
  expect(parseRunScope("phases 01,02,03")).toEqual({ kind: "phases", phases: [1, 2, 3] });
  expect(parseRunScope("_None_")).toBeNull();
  expect(parseRunScope(null)).toBeNull();
  expect(parseRunScope("_None — `phase NN` | `loop` | `phases NN,NN`._")).toBeNull();
});

test("only `active` counts as a live run", () => {
  for (const status of ["idle", "blocked", "paused", "ACTIVE"]) {
    writeRunState(dir, DEFAULT_CONFIG, { status });
    expect(isActive(readRunState(dir, DEFAULT_CONFIG))).toBe(status.toLowerCase() === "active");
  }
});

test("writeRunState adds Run scope to a record scaffolded before the field existed", () => {
  const path = join(dir, "spec", "specloop-run-state.md");
  writeFileSync(path, "# specloop run state\n\nRun status: idle\nStated goal: _None_\n");
  expect(writeRunState(dir, DEFAULT_CONFIG, { status: "active", scope: { kind: "loop" } })).toBe(true);
  const raw = readFileSync(path, "utf8");
  expect(raw).toContain("Run scope: loop");
  expect(raw).toContain("Run status: active");
  expect(raw).toMatch(/Last-updated date: \d{4}-\d{2}-\d{2}/);
});

test("writeRunState reports when there is no record to update", () => {
  rmSync(join(dir, "spec", "specloop-run-state.md"));
  expect(writeRunState(dir, DEFAULT_CONFIG, { status: "active" })).toBe(false);
});
