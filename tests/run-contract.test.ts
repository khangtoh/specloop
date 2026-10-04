import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const template = readFileSync(join(root, "template/AGENTS.md"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const state = readFileSync(join(root, "template/spec/specloop-run-state.md"), "utf8");

/** Collapse hard wraps so a clause assertion survives a reflow of the prose. */
const flat = (s: string) => s.replace(/\s+/g, " ");

test("AGENTS preserves the exact trigger and terminal conditions", () => {
  expect(agents).toContain("When the user sends exactly `specloop`, start or resume autonomous execution.");
  expect(agents).toContain("only the terminal conditions end a run");
});

test("AGENTS defines all three run scopes of the trigger grammar", () => {
  expect(agents).toContain("**Standard run**");
  expect(agents).toContain("**Loop run**");
  expect(agents).toContain("**Scoped run**");
  expect(agents).toContain("`specloop loop`");
  expect(agents).toContain("`specloop 1,2,3`");
});

test("AGENTS preserves continuation and rejected-alias policy", () => {
  expect(agents).toContain("do not stop after a checkbox merely to wait for another `specloop` message");
  expect(agents).toContain("`specloop start`, `specloop run`, and `specloop go` are not run triggers");
  expect(agents).toContain("Do not stop at a task or phase boundary");
});

test("AGENTS binds the run to the host's /goal and to printed evidence", () => {
  expect(agents).toContain("specloop goal <target> --start");
  // The single most important integration rule: Claude Code's evaluator reads
  // only the transcript, so unprinted progress cannot be judged.
  expect(flat(agents)).toContain("run `specloop status` and `specloop check` and show their output");
  expect(flat(agents)).toContain("reads only what is in the transcript");
  expect(agents).toContain("fall back to this contract's own autonomy rules");
});

test("the shipped template carries the same run contract as this repo", () => {
  for (const clause of [
    "**Loop run**",
    "**Scoped run**",
    "specloop goal <target> --start",
    "`specloop start`, `specloop run`, and `specloop go` are not run triggers",
  ]) {
    expect(template).toContain(clause);
  }
});

test("help is informational in both public documents", () => {
  expect(agents).toContain("`specloop help` requests help only; it does not start or resume execution");
  expect(readme).toContain("`specloop help` is informational and does not start a run");
});

test("run-state template has each required label exactly once and its disclaimer", () => {
  for (const label of ["Run status:", "Run scope:", "Stated goal:", "Goal acceptance checkbox:", "Current phase:", "Current task:", "Resume point:", "Last-updated date:"]) {
    expect(state.split(label).length - 1).toBe(1);
  }
  expect(state).toContain("Advisory run record: completion and done-state are always derived from spec checkboxes.");
});

test("AGENTS makes the Stop hook's inertness contract explicit", () => {
  expect(agents).toContain("stays inert unless `Run status:` is `active`");
  expect(flat(agents)).toContain("Set `Run status: idle` when a run ends");
});
