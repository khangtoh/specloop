import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { main } from "../src/cli.js";
import { runInit } from "../src/commands/init.js";
import { refreshAssets, type Agent } from "../src/commands/refresh.js";

let dir: string;
let log: typeof console.log;
let error: typeof console.error;
let stdout: string[];
let stderr: string[];
const read = (path: string) => readFileSync(join(dir, path), "utf8");
const write = (path: string, body: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), body);
};
function run(...args: string[]) {
  stdout = []; stderr = [];
  const code = main(["bun", "specloop", ...args, "--dir", dir]);
  return { code, out: stdout.join("\n"), err: stderr.join("\n") };
}
function snapshot(root = dir): Record<string, string> {
  return Object.fromEntries(readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile()).map(e => {
      const path = join(e.parentPath, e.name);
      return [path, createHash("sha256").update(readFileSync(path)).digest("hex")];
    }));
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop menu spaces "));
  log = console.log; error = console.error; stdout = []; stderr = [];
  console.log = (...args) => stdout.push(args.join(" "));
  console.error = (...args) => stderr.push(args.join(" "));
  write(".specloop.json", JSON.stringify({ specDir: "spec" }));
  write("spec/BACKLOG.md", "# Backlog\n\n## Phases (priority order)\n\n- 01 First\n- 02 Finished\n- 03 Third\n");
  write("spec/01-first.md", "# Phase 01 — First\n\nGoal: first.\nDepends on: None.\n\n- [ ] first task\n- [ ] (p3) second task\n");
  write("spec/02-finished.md", "# Phase 02 — Finished\n\nGoal: finished.\nDepends on: None.\n\n- [x] done\n");
  write("spec/03-third.md", "# Phase 03 — Third\n\nGoal: third.\nDepends on: None.\n\n- [ ] third task\n");
});
afterEach(() => {
  console.log = log; console.error = error;
  rmSync(dir, { recursive: true, force: true });
});

test("list and both aliases preserve filters, JSON and priority positions", () => {
  const before = snapshot();
  for (const [filter, ids] of [["all", [1, 2, 3]], ["done", [2]], ["undone", [1, 3]]] as const) {
    const result = run("list", filter, "--json");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out).phases.map((p: { number: number }) => p.number)).toEqual(ids);
    expect(run("list-spec", filter, "--json")).toEqual(result);
    expect(run("listspec", filter, "--json")).toEqual(result);
  }
  expect(run("list")).toEqual(run("list", "undone"));
  expect(run("list", "invalid").code).toBe(1);
  expect(snapshot()).toEqual(before);
});

test("prio spec and aliases reorder incomplete phases, retaining signed arguments", () => {
  const original = read("spec/BACKLOG.md");
  const phase = read("spec/03-third.md");
  for (const [id, pos, order] of [["03", "0", [3, 1, 2]], ["01", "-1", [2, 3, 1]], ["03", "+1", [3, 1, 2]]] as const) {
    let expected;
    for (const command of [["prio", "spec"], ["prio-spec"], ["priospec"]]) {
      write("spec/BACKLOG.md", original);
      const result = run(...command, id, pos);
      expect(result.code).toBe(0);
      expected ??= result;
      expect(result).toEqual(expected);
      expect(JSON.parse(run("list", "all", "--json").out).phases.map((p: { number: number }) => p.number)).toEqual(order);
      expect(read("spec/03-third.md")).toBe(phase);
    }
  }
});

test("prio task and aliases change the selected box with --to or a bump", () => {
  const original = read("spec/01-first.md");
  for (const flags of [[], ["--to", "p1"]]) {
    let expected;
    for (const command of [["prio", "task"], ["prio-task"], ["priotask"]]) {
      write("spec/01-first.md", original);
      const result = run(...command, "01.2", ...flags);
      expect(result.code).toBe(0);
      expected ??= result;
      expect(result).toEqual(expected);
      expect(read("spec/01-first.md")).toBe(original.replace("(p3)", flags.length ? "(p1)" : "(p2)"));
    }
  }
});

test("invalid or incomplete priority requests and shell loop do not mutate files", () => {
  const before = snapshot();
  for (const args of [
    ["prio"], ["prio", "phase", "03", "0"], ["prio", "spec"],
    ["prio", "spec", "03"], ["prio", "spec", "99", "0"],
    ["prio", "task"], ["prio", "task", "bad"], ["prio", "task", "01.99"],
    ["prio", "task", "01.2", "--to", "p9"], ["loop"],
  ]) {
    expect(run(...args).code).toBe(1);
    expect(snapshot()).toEqual(before);
  }
});

test("audit preserves the actual quoted goal and the project's custom prompt", () => {
  write("spec/goal-completion-check.md", "# Local audit\n\n```\nAudit {GOAL} using local evidence.\n```\n");
  const goal = 'the "checkout" flow handles $5 and `literal text`';
  const before = snapshot();
  const result = run("audit", goal);
  expect(result).toEqual({ code: 0, out: `Audit ${goal} using local evidence.`, err: "" });
  expect(run("goal-check", goal)).toEqual(result);
  expect(run("goalcheck", goal)).toEqual(result);
  expect(run("audit").code).toBe(1);
  expect(snapshot()).toEqual(before);
});

test("help advertises canonical commands and is informational outside a project", () => {
  const before = snapshot();
  const result = run("help");
  expect(result.code).toBe(0);
  for (const name of ["list [filter]", "prio spec <NN> <pos>", "prio task <NN.T>", 'audit "<goal>"', "$specloop", "/specloop"]) {
    expect(result.out).toContain(name);
  }
  expect(run("--help")).toEqual(result);
  expect(snapshot()).toEqual(before);
});

for (const agent of ["claude", "codex", "both"] as Agent[]) {
  test(`${agent} install and refresh keep skill workflow references self-contained`, () => {
    const target = join(dir, "installed");
    expect(runInit(target, { agent })).toBe(0);
    const groups = agent === "both" ? [".claude/skills", ".agents/skills"] : [agent === "claude" ? ".claude/skills" : ".agents/skills"];
    for (const group of groups) {
      const skill = join(target, group, "specloop/SKILL.md");
      const body = readFileSync(skill, "utf8");
      const refs = [...body.matchAll(/\]\((references\/[^)]+)\)/g)].map(m => join(dirname(skill), m[1]));
      expect(refs).toHaveLength(4);
      for (const ref of refs) expect(existsSync(ref)).toBe(true);
      const missing = refs[0];
      rmSync(missing);
      const edited = refs[1];
      writeFileSync(edited, "Project custom workflow\n");
      const before = snapshot(target);
      const preview = refreshAssets(target, { agent });
      expect(preview.find(a => join(target, a.path) === missing)?.status).toBe("add");
      expect(preview.find(a => join(target, a.path) === edited)?.status).toBe("manual merge");
      expect(snapshot(target)).toEqual(before);
      refreshAssets(target, { agent, apply: true });
      expect(existsSync(missing)).toBe(true);
      expect(readFileSync(edited, "utf8")).toBe("Project custom workflow\n");
    }
  });
}
