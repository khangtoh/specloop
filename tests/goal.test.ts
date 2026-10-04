import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { CONDITION_LIMIT, blockedPhases, buildGoalPlan, parseGoalTarget } from "../src/goal.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop-goal-"));
  runInit(dir);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Replace the scaffolded spec with three phases: 01 open, 02 blocked, 03 done. */
function threePhases(): void {
  const spec = join(dir, "spec");
  rmSync(join(spec, "01-example-phase.md"));
  writeFileSync(join(spec, "01-alpha.md"), "# Phase 01 — Alpha\n\nGoal: a.\n\nDepends on: None.\n\n- [ ] (p3) low one\n- [ ] (p1) high one\n");
  writeFileSync(join(spec, "02-bravo.md"), "# Phase 02 — Bravo\n\nGoal: b.\n\nDepends on: None.\n\n- [ ] blocked work\n");
  writeFileSync(join(spec, "03-charlie.md"), "# Phase 03 — Charlie\n\nGoal: c.\n\nDepends on: None.\n\n- [x] done work\n");
  writeFileSync(
    join(spec, "README.md"),
    [
      "# Demo — Spec Index",
      "",
      "Goal: demo.",
      "",
      "## Phases",
      "",
      "| # | File | Purpose | Status | Blocking dependency |",
      "|---|------|---------|--------|----------------------|",
      "| 1 | [01-alpha.md](01-alpha.md) | Alpha | 🟡 0/2 | None |",
      "| 2 | [02-bravo.md](02-bravo.md) | Bravo | ⛔ 0/1 | Waiting on a vendor |",
      "| 3 | [03-charlie.md](03-charlie.md) | Charlie | ✅ 1/1 | None |",
      "",
      "## Status",
      "",
      "- [ ] **Demo ships**",
      "",
      "## Non-goals",
      "",
      "- Nothing.",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(spec, "BACKLOG.md"),
    "# Backlog\n\n## Phases (priority order)\n\n- 03 Charlie\n- 01 Alpha\n- 02 Bravo\n",
  );
}

test("the target grammar matches the agent trigger grammar", () => {
  expect(parseGoalTarget(undefined)).toEqual({ kind: "top" });
  expect(parseGoalTarget("")).toEqual({ kind: "top" });
  expect(parseGoalTarget("loop")).toEqual({ kind: "loop" });
  expect(parseGoalTarget("LOOP")).toEqual({ kind: "loop" });
  expect(parseGoalTarget("1,2,3")).toEqual({ kind: "phases", phases: [1, 2, 3] });
  expect(parseGoalTarget("01, 03")).toEqual({ kind: "phases", phases: [1, 3] });
  expect(parseGoalTarget("2,2")).toEqual({ kind: "phases", phases: [2] });
});

test("a target that is neither loop nor a phase list is rejected, not guessed", () => {
  for (const bad of ["start", "go", "run", "loop2", "all", "1,x"]) {
    expect(parseGoalTarget(bad)).toHaveProperty("error");
  }
});

test("blocked phases come from the index's ⛔ override", () => {
  threePhases();
  expect(blockedPhases(dir, DEFAULT_CONFIG)).toEqual([2]);
});

test("the no-argument target picks the top eligible phase in BACKLOG order", () => {
  threePhases();
  // BACKLOG order is 03, 01, 02 — but 03 is complete, so the top *eligible*
  // phase is 01, not the literal top of the list.
  const plan = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "top" });
  expect(plan.scope).toEqual({ kind: "phase", phase: 1 });
  expect(plan.inScope.map((p) => p.number)).toEqual([1]);
  expect(plan.condition).toContain("Phase 01 (Alpha) is complete");
});

test("a loop target spans every phase but skips the blocked one", () => {
  threePhases();
  const plan = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "loop" });
  expect(plan.inScope.map((p) => p.number)).toEqual([3, 1]);
  expect(plan.blocked).toEqual([2]);
  expect(plan.remaining).toHaveLength(2);
  expect(plan.condition).toContain("Every eligible phase in spec/ is complete");
  expect(plan.condition).toContain("Skipped as `⛔ blocked`");
  // Only a loop run owns the whole-goal acceptance checkbox.
  expect(plan.condition).toContain("acceptance checkbox");
});

test("a phase list is taken in BACKLOG order, not the order typed", () => {
  threePhases();
  const plan = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "phases", phases: [1, 3] });
  expect(plan.inScope.map((p) => p.number)).toEqual([3, 1]);
  expect(plan.condition).toContain("Phases 03, 01 are each complete");
});

test("a phase list reports ids that do not exist", () => {
  threePhases();
  expect(buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "phases", phases: [1, 9] }).missing).toEqual([9]);
});

test("remaining boxes are ordered by task priority within a phase", () => {
  threePhases();
  const plan = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "top" });
  expect(plan.remaining[0].task.text).toBe("high one");
  expect(plan.remaining[1].task.text).toBe("low one");
});

test("the condition names the commands that prove it and forbids impression", () => {
  threePhases();
  const c = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "loop" }).condition;
  expect(c).toContain("`specloop status`");
  expect(c).toContain("`specloop check`");
  expect(c).toContain("A feature that works when tried by hand is not a checked box");
  expect(c.length).toBeLessThanOrEqual(CONDITION_LIMIT);
});

test("a long backlog elides the phase list instead of losing the clauses", () => {
  const spec = join(dir, "spec");
  rmSync(join(spec, "01-example-phase.md"));
  const rows: string[] = [];
  const backlog: string[] = [];
  for (let i = 1; i <= 120; i++) {
    const n = String(i).padStart(3, "0");
    writeFileSync(join(spec, `${n}-p.md`), `# Phase ${n}\n\nGoal: g.\n\nDepends on: None.\n\n- [ ] work\n`);
    rows.push(`| ${i} | [${n}-p.md](${n}-p.md) | P | 🟡 0/1 | None |`);
    backlog.push(`- ${n} P`);
  }
  writeFileSync(
    join(spec, "README.md"),
    `# Demo\n\nGoal: g.\n\n## Phases\n\n| # | File | Purpose | Status | Blocking dependency |\n|---|---|---|---|---|\n${rows.join("\n")}\n\n## Status\n\n- [ ] **Ships**\n\n## Non-goals\n\n- None.\n`,
  );
  writeFileSync(join(spec, "BACKLOG.md"), `# Backlog\n\n## Phases (priority order)\n\n${backlog.join("\n")}\n`);
  const c = buildGoalPlan(dir, DEFAULT_CONFIG, { kind: "loop" }).condition;
  expect(c.length).toBeLessThanOrEqual(CONDITION_LIMIT);
  expect(c).toContain("and 80 more (see `specloop list-spec`)");
  // The clauses that define the condition must survive the elision.
  expect(c).toContain("Met when `specloop status` shows no unchecked task left");
  expect(c).toContain("`specloop check`");
});

test("init still validates with the Run scope field in the run-state record", () => {
  const record = readFileSync(join(dir, "spec", "specloop-run-state.md"), "utf8");
  expect(record).toContain("Run scope:");
});
