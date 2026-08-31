import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const readme = readFileSync(join(root, "README.md"), "utf8");
const state = readFileSync(join(root, "template/spec/specloop-run-state.md"), "utf8");

test("AGENTS preserves the exact trigger, run scopes, and terminal conditions", () => {
  expect(agents).toContain("When the user sends exactly `specloop`, start or resume autonomous execution.");
  expect(agents).toContain("**Goal run:**");
  expect(agents).toContain("**Standard run:**");
  expect(agents).toContain("only the terminal conditions end a run");
});

test("AGENTS preserves continuation and rejected-alias policy", () => {
  expect(agents).toContain("do not stop after a checkbox merely to wait for another `specloop` message");
  expect(agents).toContain("`specloop start`, `specloop run`, and `specloop go` are not run triggers");
});

test("help is informational in both public documents", () => {
  expect(agents).toContain("`specloop help` requests help only; it does not start or resume execution");
  expect(readme).toContain("`specloop help` is informational and does not start a run");
});

test("run-state template has each required label exactly once and its disclaimer", () => {
  for (const label of ["Run status:", "Stated goal:", "Goal acceptance checkbox:", "Current phase:", "Current task:", "Resume point:", "Last-updated date:"]) {
    expect(state.split(label).length - 1).toBe(1);
  }
  expect(state).toContain("Advisory run record: completion and done-state are always derived from spec checkboxes.");
});
