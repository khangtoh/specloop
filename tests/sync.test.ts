import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncSpecs, runSync, SYNC_EXIT } from "../src/commands/sync.js";
import { main } from "../src/cli.js";

// A bare remote and two clones: `loop` is the long-running specloop loop with
// local commits of its own, `other` is another agent pushing spec edits.
let root: string, loop: string, other: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const read = (dir: string, p: string) => readFileSync(join(dir, p), "utf8");
const write = (dir: string, p: string, body: string) => { mkdirSync(join(dir, p, ".."), { recursive: true }); writeFileSync(join(dir, p), body); };
const edit = (dir: string, p: string, from: string, to: string) => {
  const s = read(dir, p);
  if (!s.includes(from)) throw new Error(`fixture edit: ${from} not in ${p}`);
  writeFileSync(join(dir, p), s.replace(from, to));
};
const commit = (dir: string, msg: string) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", msg); };
const push = (dir: string) => git(dir, "push", "-q", "origin", "main");
const user = (dir: string, name: string) => { git(dir, "config", "user.name", name); git(dir, "config", "user.email", `${name}@example.test`); };

const PHASE_02 = `# Phase 02 — Not yet worked on

Goal: a phase the loop has not reached, which another agent may change.

Depends on: 01.

- [ ] Build the thing as first written.
- [ ] Test the thing.

## Findings / Results

- _2026-01-02_ — Not started.
`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "specloop-sync-"));
  const seed = join(root, "seed");
  cpSync(join(import.meta.dir, "..", "template"), seed, { recursive: true });
  write(seed, "spec/02-not-yet.md", PHASE_02);
  edit(seed, "spec/README.md", "| 1 | [01-example-phase.md](01-example-phase.md) | Example scaffold phase — replace with your own | 🟡 2/4 | None |",
    "| 1 | [01-example-phase.md](01-example-phase.md) | Example scaffold phase — replace with your own | 🟡 2/4 | None |\n| 2 | [02-not-yet.md](02-not-yet.md) | A phase not yet reached | ⬜ 0/2 | 01 |");
  edit(seed, "spec/BACKLOG.md", "- 01 Example: project scaffold", "- 01 Example: project scaffold\n- 02 Not yet worked on");
  write(seed, "src/app.js", "export const version = 1;\n");
  git(seed, "init", "-q", "-b", "main"); user(seed, "seed"); commit(seed, "seed");
  // The branch is named everywhere: a machine whose git defaults to "master"
  // would otherwise give the bare remote a HEAD that does not exist, and every
  // clone an empty checkout (found when CI ran 0.9.0's release).
  git(root, "init", "-q", "--bare", "-b", "main", "remote.git");
  git(seed, "remote", "add", "origin", join(root, "remote.git"));
  push(seed);
  for (const name of ["loop", "other"]) { git(root, "clone", "-q", "-b", "main", join(root, "remote.git"), name); user(join(root, name), name); }
  loop = join(root, "loop"); other = join(root, "other");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** The loop checks a box in phase 01, records it, and commits locally (never pushed). */
function loopWorks() {
  edit(loop, "spec/01-example-phase.md", "- [ ] Add a lint step", "- [x] Add a lint step");
  edit(loop, "spec/README.md", "| 🟡 2/4 | None |", "| 🟡 3/4 | None |");
  appendFileSync(join(loop, "spec/agent-session-ledger.md"), "\n## Session: loop — lint step\n\nChecked the lint step.\n");
  write(loop, "src/app.js", "export const version = 1;\nexport const lint = true;\n");
  commit(loop, "loop: lint step");
}

test("nothing upstream: up to date, exit 0, nothing written", () => {
  loopWorks();
  const head = git(loop, "rev-parse", "HEAD");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("none");
  expect(git(loop, "rev-parse", "HEAD")).toBe(head);
});

test("an upstream edit to a phase not yet reached arrives; the loop keeps its own work; code is untouched", () => {
  edit(other, "spec/02-not-yet.md", "Build the thing as first written.", "Build the thing as now agreed, with the new rule.");
  appendFileSync(join(other, "spec/agent-session-ledger.md"), "\n## Session: other — phase 02 changed\n\nRewrote phase 02.\n");
  write(other, "src/app.js", "export const version = 2;\n");
  commit(other, "other: phase 02 and code"); push(other);
  loopWorks();
  const loopHead = git(loop, "rev-parse", "HEAD");

  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(r.phases).toEqual([2]);
  expect(r.ledgerEntries).toBe(1);
  expect(read(loop, "spec/02-not-yet.md")).toContain("Build the thing as now agreed, with the new rule.");
  expect(read(loop, "spec/01-example-phase.md")).toContain("- [x] Add a lint step");
  expect(read(loop, "spec/README.md")).toContain("| 🟡 3/4 | None |");
  const ledger = read(loop, "spec/agent-session-ledger.md");
  expect(ledger).toContain("## Session: loop — lint step");
  expect(ledger).toContain("## Session: other — phase 02 changed");
  // Upstream code is not taken mid-run, and nothing was rebased.
  expect(read(loop, "src/app.js")).toContain("export const lint = true;");
  expect(read(loop, "src/app.js")).not.toContain("version = 2");
  expect(git(loop, "rev-parse", "HEAD~1")).toBe(loopHead);
  expect(git(loop, "log", "-1", "--format=%s")).toMatch(/^spec: sync from origin\/main @[0-9a-f]{7}$/);
  expect(r.files.find((f) => f.path === "spec/agent-session-ledger.md")?.merge).toBeDefined();
  expect(git(loop, "status", "--porcelain")).toBe("");
  expect(git(loop, "rev-parse", "refs/specloop/synced/origin/main")).toBe(git(other, "rev-parse", "HEAD"));
});

test("a second sync does not re-apply the first, and a later ledger append is not duplicated", () => {
  appendFileSync(join(other, "spec/agent-session-ledger.md"), "\n## Session: other — first\n\nFirst.\n");
  commit(other, "other: first"); push(other);
  loopWorks();
  expect(syncSpecs(loop, { apply: true }).status).toBe("synced");
  expect(syncSpecs(loop, { apply: true }).status).toBe("none");

  appendFileSync(join(loop, "spec/agent-session-ledger.md"), "\n## Session: loop — second\n\nSecond.\n");
  commit(loop, "loop: second");
  appendFileSync(join(other, "spec/agent-session-ledger.md"), "\n## Session: other — third\n\nThird.\n");
  commit(other, "other: third"); push(other);
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  const ledger = read(loop, "spec/agent-session-ledger.md");
  for (const h of ["other — first", "loop — lint step", "loop — second", "other — third"]) {
    expect(ledger.split(`## Session: ${h}`).length - 1).toBe(1);
  }
});

test("a new upstream phase arrives with its index row and BACKLOG entry", () => {
  write(other, "spec/03-new.md", PHASE_02.replace("Phase 02 — Not yet worked on", "Phase 03 — New").replace("Depends on: 01.", "Depends on: 02."));
  edit(other, "spec/README.md", "| 2 | [02-not-yet.md](02-not-yet.md) | A phase not yet reached | ⬜ 0/2 | 01 |",
    "| 2 | [02-not-yet.md](02-not-yet.md) | A phase not yet reached | ⬜ 0/2 | 01 |\n| 3 | [03-new.md](03-new.md) | A new phase | ⬜ 0/2 | 02 |");
  edit(other, "spec/BACKLOG.md", "- 02 Not yet worked on", "- 02 Not yet worked on\n- 03 New");
  commit(other, "other: phase 03"); push(other);
  loopWorks();
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(r.phases).toEqual([3]);
  expect(r.backlogChanged).toBe(true);
  expect(r.indexChanged).toBe(true);
  expect(r.files.find((f) => f.path === "spec/03-new.md")?.action).toBe("add");
  expect(existsSync(join(loop, "spec/03-new.md"))).toBe(true);
  expect(read(loop, "spec/README.md")).toContain("| 🟡 3/4 | None |");
  expect(read(loop, "spec/README.md")).toContain("[03-new.md](03-new.md)");
});

test("the run state is always the loop's own", () => {
  edit(other, "spec/specloop-run-state.md", "Current phase: _None_", "Current phase: Phase 09 (someone else's run)");
  edit(other, "spec/02-not-yet.md", "- [ ] Test the thing.", "- [ ] Test the thing, twice.");
  commit(other, "other: run state"); push(other);
  edit(loop, "spec/specloop-run-state.md", "Current phase: _None_", "Current phase: Phase 01");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(r.files.find((f) => f.path === "spec/specloop-run-state.md")?.action).toBe("kept local");
  expect(read(loop, "spec/specloop-run-state.md")).toContain("Current phase: Phase 01");
});

test("a conflicting line stops the loop and writes nothing", () => {
  edit(other, "spec/02-not-yet.md", "Build the thing as first written.", "Build it their way.");
  commit(other, "other: their way"); push(other);
  edit(loop, "spec/02-not-yet.md", "Build the thing as first written.", "Build it our way.");
  commit(loop, "loop: our way");
  const head = git(loop, "rev-parse", "HEAD");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("stop");
  expect(r.conflicts).toEqual([{ path: "spec/02-not-yet.md", reason: "both sides changed the same lines" }]);
  expect(read(loop, "spec/02-not-yet.md")).toContain("Build it our way.");
  expect(git(loop, "rev-parse", "HEAD")).toBe(head);
  expect(git(loop, "status", "--porcelain")).toBe("");
  expect(() => git(loop, "rev-parse", "--verify", "--quiet", "refs/specloop/synced/origin/main")).toThrow();
});

test("an uncommitted spec path stops it: sync only runs at a task boundary", () => {
  edit(other, "spec/02-not-yet.md", "- [ ] Test the thing.", "- [ ] Test the thing, twice.");
  commit(other, "other"); push(other);
  edit(loop, "spec/01-example-phase.md", "- [ ] Add a lint step", "- [x] Add a lint step");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("stop");
  expect(r.issues.join("\n")).toContain("spec/01-example-phase.md");
  expect(read(loop, "spec/02-not-yet.md")).not.toContain("twice");
});

test("a merge that fails specloop check is put back", () => {
  write(other, "spec/03-unindexed.md", PHASE_02.replace("Phase 02 — Not yet worked on", "Phase 03 — Unindexed"));
  commit(other, "other: phase without an index row"); push(other);
  const head = git(loop, "rev-parse", "HEAD");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("stop");
  expect(r.issues.length).toBeGreaterThan(0);
  expect(existsSync(join(loop, "spec/03-unindexed.md"))).toBe(false);
  expect(git(loop, "rev-parse", "HEAD")).toBe(head);
  expect(git(loop, "status", "--porcelain")).toBe("");
});

test("without --apply it only inspects", () => {
  edit(other, "spec/02-not-yet.md", "- [ ] Test the thing.", "- [ ] Test the thing, twice.");
  commit(other, "other"); push(other);
  const head = git(loop, "rev-parse", "HEAD");
  const r = syncSpecs(loop);
  expect(r.status).toBe("would-sync");
  expect(r.phases).toEqual([2]);
  expect(read(loop, "spec/02-not-yet.md")).not.toContain("twice");
  expect(git(loop, "rev-parse", "HEAD")).toBe(head);
});

test("it flags the phase in progress, and checked tasks reworded upstream", () => {
  edit(other, "spec/02-not-yet.md", "- [ ] Test the thing.", "- [ ] Test the thing, twice.");
  edit(other, "spec/01-example-phase.md", "- [x] Add a test runner and one trivially-passing test.", "- [x] Add a test runner and two passing tests.");
  commit(other, "other"); push(other);
  edit(loop, "spec/specloop-run-state.md", "Current phase: _None_", "Current phase: Phase 02 — Not yet worked on");
  commit(loop, "loop: working on 02");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(r.currentPhase).toBe(2);
  expect(r.currentPhaseChanged).toBe(true);
  expect(r.checkedWordingChanged).toEqual([{ phase: 1, task: "Add a test runner and one trivially-passing test. Done: `npm test`" }]);
});

test("an upstream deletion is taken when the loop left the file alone", () => {
  unlinkSync(join(other, "spec/skill-coordination.md"));
  commit(other, "other: delete"); push(other);
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(r.files.find((f) => f.path === "spec/skill-coordination.md")?.action).toBe("delete");
  expect(existsSync(join(loop, "spec/skill-coordination.md"))).toBe(false);
  expect(git(loop, "status", "--porcelain")).toBe("");
});

test("a deletion that meets a local edit is a conflict", () => {
  unlinkSync(join(other, "spec/skill-coordination.md"));
  commit(other, "other: delete"); push(other);
  appendFileSync(join(loop, "spec/skill-coordination.md"), "\nA local rule.\n");
  commit(loop, "loop: local rule");
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("stop");
  expect(r.conflicts[0]).toEqual({ path: "spec/skill-coordination.md", reason: "deleted upstream, changed locally" });
});

test("syncPaths brings in the plans a phase links to, and nothing else", () => {
  write(loop, ".specloop.json", JSON.stringify({ syncPaths: ["docs/plans"] }));
  commit(loop, "loop: sync plans");
  write(other, "docs/plans/thing.md", "# The plan\n\nAgreed.\n");
  write(other, "docs/other.md", "Not a plan.\n");
  commit(other, "other: plan"); push(other);
  const r = syncSpecs(loop, { apply: true });
  expect(r.status).toBe("synced");
  expect(read(loop, "docs/plans/thing.md")).toContain("Agreed.");
  expect(existsSync(join(loop, "docs/other.md"))).toBe(false);
});

test("the CLI: --json and exit codes 0, 10 and 2", () => {
  const out: string[] = []; const log = console.log, err = console.error;
  console.log = (...a: unknown[]) => out.push(a.join(" ")); console.error = (...a: unknown[]) => out.push(a.join(" "));
  try {
    expect(main(["bun", "specloop", "sync", "--dir", loop, "--json"])).toBe(SYNC_EXIT.none);
    expect(JSON.parse(out.join("\n")).status).toBe("none");
    edit(other, "spec/02-not-yet.md", "- [ ] Test the thing.", "- [ ] Test the thing, twice.");
    commit(other, "other"); push(other);
    out.length = 0;
    expect(main(["bun", "specloop", "sync", "--dir", loop, "--apply"])).toBe(SYNC_EXIT.synced);
    expect(out.join("\n")).toContain("phases changed upstream: 02");
    edit(other, "spec/02-not-yet.md", "- [ ] Build the thing as first written.", "- [ ] Theirs.");
    commit(other, "other"); push(other);
    edit(loop, "spec/02-not-yet.md", "- [ ] Build the thing as first written.", "- [ ] Ours.");
    commit(loop, "loop");
    out.length = 0;
    expect(runSync(loop, { apply: true })).toBe(SYNC_EXIT.stop);
    expect(out.join("\n")).toContain("conflict   spec/02-not-yet.md");
  } finally { console.log = log; console.error = err; }
});

test("outside a git repository it is an error, not a crash", () => {
  const plain = mkdtempSync(join(tmpdir(), "specloop-plain-"));
  try {
    cpSync(join(import.meta.dir, "..", "template"), plain, { recursive: true });
    const r = syncSpecs(plain, { apply: true });
    expect(r.status).toBe("error");
  } finally { rmSync(plain, { recursive: true, force: true }); }
});

test("installs of 0.8.1's changed assets stay recognized, so refresh updates them cleanly", () => {
  const legacy = JSON.parse(readFileSync(join(import.meta.dir, "..", "plugin/specloop/legacy-assets.json"), "utf8"));
  const has = (key: string, digest: string) => ([] as string[]).concat(legacy[key] ?? []).includes(digest);
  expect(has("skills/specloop/references/loop.md", "37b8ed109bfdd243404009617143de6d463f131040d94578e98fbf3c5c639fec")).toBe(true);
  expect(has("skills/specloop/SKILL.md", "64d9b927bbf58e20eb7bb12fd7a6ba9cf5dea880a3b6e7b2313bd6c263f9f692")).toBe(true);
  expect(has("skills/specloop/SKILL.md", "30592c523129e11ac97b7f96ded7b419a86366c7643c58f8c102839d88e9f734")).toBe(true);
  expect(has("AGENTS.md", "e785de2da71bcc6842cb058abc1a5bcdf51a04334fca3cfc095a1aeb06011a77")).toBe(true);
});
