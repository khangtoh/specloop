// specloop sync — take upstream spec changes at a task boundary (Phase 11).
//
// A loop that runs for hours reads its specs from the local checkout. When
// another agent pushes a change to a phase the loop has not reached yet, the
// loop never sees it. Pulling on a timer does not help: the loop must re-read
// at a safe point, and its own local commits make a fast-forward impossible.
//
// So the loop calls this at every task boundary (after a box is checked and
// committed, before the next is chosen). It merges only the spec directory,
// plus any `syncPaths` in .specloop.json, three ways, and never rebases or
// takes upstream code mid-run:
//   - most files merge three ways; a real conflict stops the loop;
//   - the session ledger is append-only, so it falls back to a union merge;
//   - the run-state file records this run, so the local copy is always kept.
// The base is the upstream commit last synced, held in a local ref, so a
// second sync never re-applies the first. Everything is computed before
// anything is written; a conflict, an uncommitted spec path, or a failing
// structural check afterwards leaves the checkout as it was.
//
// Inspects by default; --apply writes, makes one local commit and moves the
// synced ref. It never pushes.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { loadConfig } from "../config.js";
import { check } from "../validator/index.js";

export const SYNC_EXIT = { none: 0, error: 1, stop: 2, synced: 10 } as const;

const RUN_STATE = "specloop-run-state.md";
const LEDGER = "agent-session-ledger.md";

export interface SyncFile {
  path: string;
  action: "update" | "add" | "delete" | "kept local" | "unchanged";
  merge?: "taken" | "three-way" | "union";
}

export interface SyncReport {
  status: "none" | "would-sync" | "synced" | "stop" | "error";
  message: string;
  remote?: string;
  branch?: string;
  upstream?: string;
  base?: string;
  commit?: string;
  files: SyncFile[];
  phases: number[];
  ledgerEntries: number;
  backlogChanged: boolean;
  indexChanged: boolean;
  currentPhase: number | null;
  currentPhaseChanged: boolean;
  checkedWordingChanged: { phase: number; task: string }[];
  conflicts: { path: string; reason: string }[];
  issues: string[];
}

export interface SyncOptions {
  apply?: boolean;
  remote?: string;
  branch?: string;
  json?: boolean;
}

interface Git {
  run(args: string[]): { ok: boolean; out: string; err: string };
  text(args: string[]): string;
  show(rev: string, path: string): string | null;
}

function gitAt(cwd: string): Git {
  const run = (args: string[]) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { ok: r.status === 0, out: r.stdout ?? "", err: (r.stderr ?? "").trim() };
  };
  return {
    run,
    text(args) {
      const r = run(args);
      if (!r.ok) throw new Error(`git ${args.join(" ")} failed: ${r.err || "no output"}`);
      return r.out.trim();
    },
    show(rev, path) {
      const r = run(["show", `${rev}:${path}`]);
      return r.ok ? r.out : null;
    },
  };
}

const emptyReport = (status: SyncReport["status"], message: string, extra: Partial<SyncReport> = {}): SyncReport => ({
  status, message, files: [], phases: [], ledgerEntries: 0, backlogChanged: false, indexChanged: false,
  currentPhase: null, currentPhaseChanged: false, checkedWordingChanged: [], conflicts: [], issues: [], ...extra,
});

/** The phase a spec path belongs to: a flat NN-name.md, or a file inside an NN-name folder. */
function phaseOf(specRel: string, path: string, phasePattern: RegExp): number | null {
  const inner = relative(specRel, path);
  if (inner.startsWith("..")) return null;
  const parts = inner.split(sep).join("/").split("/");
  if (parts.length === 1) return phasePattern.test(parts[0]) ? Number.parseInt(parts[0], 10) : null;
  return /^\d{2,}-/.test(parts[0]) ? Number.parseInt(parts[0], 10) : null;
}

/** git merge-file, in memory. Returns the merged text and whether it conflicted. */
function mergeThree(ours: string, base: string, theirs: string, union: boolean): { text: string; conflict: boolean } {
  const dir = mkdtempSync(join(tmpdir(), "specloop-sync-"));
  try {
    const [o, b, t] = ["ours", "base", "theirs"].map((n) => join(dir, n));
    writeFileSync(o, ours); writeFileSync(b, base); writeFileSync(t, theirs);
    const r = spawnSync("git", ["merge-file", "-p", ...(union ? ["--union"] : []), "-L", "local", "-L", "base", "-L", "upstream", o, b, t],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status === null || r.status < 0) throw new Error(`git merge-file failed: ${r.stderr}`);
    return { text: r.stdout, conflict: r.status > 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const headings = (text: string | null) => (text ?? "").split("\n").filter((l) => /^## /.test(l)).length;
const checkedTasks = (text: string | null) => (text ?? "").split("\n").filter((l) => /^\s*- \[x\] /i.test(l));

/** Computes, and with apply performs, one sync. Prints nothing. */
export function syncSpecs(rootDir: string, opts: SyncOptions = {}): SyncReport {
  let config;
  try { config = loadConfig(rootDir); } catch (e) { return emptyReport("error", (e as Error).message); }
  const git = gitAt(rootDir);
  const top = git.run(["rev-parse", "--show-toplevel"]);
  if (!top.ok) return emptyReport("error", "Not a git repository, so there is no upstream to sync from.");
  // Git reports real paths; a project reached through a symlink (macOS's /var)
  // must be compared the same way.
  const repoRoot = realpathSync(top.out.trim());
  const realRoot = realpathSync(rootDir);
  const toRepo = (p: string) => relative(repoRoot, resolve(realRoot, p)).split(sep).join("/");
  const specRel = toRepo(config.specDir);
  const extra = (config.syncPaths ?? []).map(toRepo);
  const scope = [specRel, ...extra];
  if (scope.some((p) => p.startsWith(".."))) return emptyReport("error", "specDir and syncPaths must stay inside the repository.");
  const phasePattern = new RegExp(config.phasePattern);

  // Where upstream is: the flags, else the branch's tracking branch, else origin/main.
  let remote = opts.remote, branch = opts.branch;
  if (!remote || !branch) {
    const up = git.run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    const [r, ...b] = up.ok ? up.out.trim().split("/") : [];
    remote ??= r || "origin";
    branch ??= b.length ? b.join("/") : "main";
  }
  const fetched = git.run(["fetch", "--quiet", remote, branch]);
  if (!fetched.ok) return emptyReport("error", `Could not fetch ${remote}/${branch}: ${fetched.err}`, { remote, branch });
  const upstream = git.text(["rev-parse", "FETCH_HEAD"]);

  // The base: the upstream commit last synced, if upstream still contains it;
  // otherwise where this branch and upstream last met.
  const syncedRef = `refs/specloop/synced/${remote}/${branch}`;
  const prev = git.run(["rev-parse", "--verify", "--quiet", syncedRef]);
  const prevSha = prev.ok ? prev.out.trim() : "";
  const prevUsable = prevSha && git.run(["merge-base", "--is-ancestor", prevSha, upstream]).ok;
  const mb = git.run(["merge-base", "HEAD", upstream]);
  if (!prevUsable && !mb.ok) return emptyReport("error", `This branch and ${remote}/${branch} share no history.`, { remote, branch, upstream });
  const base = prevUsable ? prevSha : mb.out.trim();
  const ctx = { remote, branch, upstream, base };
  const moveRef = () => { if (opts.apply) git.text(["update-ref", syncedRef, upstream]); };

  if (base === upstream) { moveRef(); return emptyReport("none", `Spec is up to date with ${remote}/${branch}.`, ctx); }
  const changed = git.text(["diff", "--name-only", "--no-renames", base, upstream, "--", ...scope]).split("\n").filter(Boolean);
  if (!changed.length) { moveRef(); return emptyReport("none", `Nothing under ${scope.join(", ")} changed on ${remote}/${branch}.`, ctx); }

  // The run state is never taken from upstream, so its local edits do not block.
  // Untrimmed and NUL-separated: each entry is "XY path", and trimming would
  // eat the leading space of a worktree-only change.
  const status = git.run(["status", "--porcelain", "-z", "--", ...scope]);
  if (!status.ok) return emptyReport("error", `git status failed: ${status.err}`, ctx);
  const dirty = status.out.split("\0").filter(Boolean).map((e) => e.slice(3))
    .filter((p) => p !== `${specRel}/${RUN_STATE}`);
  if (dirty.length) {
    return emptyReport("stop", "Commit or discard the uncommitted spec changes first; sync only runs at a task boundary.",
      { ...ctx, issues: dirty.map((p) => `uncommitted: ${p}`) });
  }

  // Merge every file in memory first.
  const files: SyncFile[] = [];
  const results = new Map<string, { ours: string | null; result: string | null }>();
  const conflicts: SyncReport["conflicts"] = [];
  for (const path of changed) {
    const name = basename(path);
    const atSpecRoot = dirname(path) === specRel;
    const ours = git.show("HEAD", path), baseC = git.show(base, path), theirs = git.show(upstream, path);
    if (atSpecRoot && name === RUN_STATE) { files.push({ path, action: "kept local" }); continue; }
    if (theirs === ours) { files.push({ path, action: "unchanged" }); continue; }
    let result: string | null; let merge: SyncFile["merge"];
    if (ours === baseC) { result = theirs; merge = "taken"; }
    else if (theirs === null) { conflicts.push({ path, reason: "deleted upstream, changed locally" }); continue; }
    else if (ours === null) { conflicts.push({ path, reason: "changed upstream, deleted locally" }); continue; }
    else if (baseC === null) { conflicts.push({ path, reason: "added on both sides with different content" }); continue; }
    else {
      const union = atSpecRoot && name === LEDGER;
      const m = mergeThree(ours, baseC, theirs, union);
      if (m.conflict) { conflicts.push({ path, reason: "both sides changed the same lines" }); continue; }
      result = m.text; merge = union ? "union" : "three-way";
    }
    if (result === ours) { files.push({ path, action: "unchanged" }); continue; }
    results.set(path, { ours, result });
    files.push({ path, action: result === null ? "delete" : ours === null ? "add" : "update", merge });
  }

  // What the agent needs to re-read.
  const phases = new Set<number>();
  const checkedWordingChanged: SyncReport["checkedWordingChanged"] = [];
  let ledgerEntries = 0, backlogChanged = false, indexChanged = false;
  for (const [path, { ours, result }] of results) {
    const n = phaseOf(specRel, path, phasePattern);
    if (n !== null) {
      phases.add(n);
      const after = new Set((result ?? "").split("\n").map((l) => l.trim()));
      for (const line of checkedTasks(ours)) if (!after.has(line.trim())) checkedWordingChanged.push({ phase: n, task: line.trim().replace(/^- \[x\]\s*/i, "") });
    }
    if (dirname(path) === specRel && basename(path) === LEDGER) ledgerEntries += Math.max(0, headings(result) - headings(ours));
    if (dirname(path) === specRel && basename(path) === "BACKLOG.md") backlogChanged = true;
    if (dirname(path) === specRel && basename(path) === config.indexFile) indexChanged = true;
  }
  const runState = git.show("HEAD", `${specRel}/${RUN_STATE}`);
  const cur = /Current phase:\s*(?:Phase\s*)?0*(\d+)/i.exec(runState ?? "");
  const currentPhase = cur ? Number(cur[1]) : null;
  const report: SyncReport = {
    ...emptyReport(conflicts.length ? "stop" : results.size ? (opts.apply ? "synced" : "would-sync") : "none", ""),
    ...ctx, files, phases: [...phases].sort((a, b) => a - b), ledgerEntries, backlogChanged, indexChanged,
    currentPhase, currentPhaseChanged: currentPhase !== null && phases.has(currentPhase), checkedWordingChanged, conflicts,
  };

  if (conflicts.length) { report.message = "Upstream spec changes conflict with local ones. Nothing was written; reconcile them before the next task."; return report; }
  if (!results.size) { moveRef(); report.message = `Upstream spec changes are already here (${remote}/${branch}).`; return report; }
  if (!opts.apply) { report.message = `${results.size} spec file(s) would be synced from ${remote}/${branch}. Run with --apply at a task boundary.`; return report; }

  // Write, check, then commit; put everything back if the result is invalid.
  const write = (path: string, text: string | null) => {
    const abs = join(repoRoot, path);
    if (text === null) { if (existsSync(abs)) unlinkSync(abs); return; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  };
  for (const [path, { result }] of results) write(path, result);
  const checked = check(rootDir, config);
  if (!checked.ok) {
    for (const [path, { ours }] of results) write(path, ours);
    report.status = "stop";
    report.message = "The merged spec fails specloop check, so nothing was kept. Reconcile by hand.";
    report.issues = checked.issues.filter((i) => i.severity === "error").map((i) => `${i.file}: ${i.message}`);
    return report;
  }
  const paths = [...results.keys()];
  const added = paths.filter((p) => results.get(p)!.result !== null);
  if (added.length) git.text(["add", "--", ...added]);
  git.text(["commit", "--quiet", "--no-verify", "-m", `spec: sync from ${remote}/${branch} @${upstream.slice(0, 7)}`, "--", ...paths]);
  report.commit = git.text(["rev-parse", "HEAD"]);
  moveRef();
  report.message = `Synced ${results.size} spec file(s) from ${remote}/${branch} @${upstream.slice(0, 7)}. Re-read what changed before choosing the next task.`;
  return report;
}

function exitFor(r: SyncReport): number {
  if (r.status === "error") return SYNC_EXIT.error;
  if (r.status === "stop") return SYNC_EXIT.stop;
  if (r.status === "synced" || r.status === "would-sync") return SYNC_EXIT.synced;
  return SYNC_EXIT.none;
}

export function runSync(rootDir: string, opts: SyncOptions = {}): number {
  const r = syncSpecs(rootDir, opts);
  if (opts.json) { console.log(JSON.stringify(r, null, 2)); return exitFor(r); }
  const out = r.status === "error" || r.status === "stop" ? console.error : console.log;
  out(`specloop sync: ${r.message}`);
  for (const f of r.files.filter((f) => f.action !== "unchanged")) out(`  ${f.action.padEnd(10)} ${f.path}${f.merge ? ` (${f.merge})` : ""}`);
  for (const c of r.conflicts) out(`  conflict   ${c.path}: ${c.reason}`);
  for (const i of r.issues) out(`  ${i}`);
  if (r.phases.length) out(`  phases changed upstream: ${r.phases.map((n) => String(n).padStart(2, "0")).join(", ")}`);
  if (r.ledgerEntries) out(`  new ledger entries: ${r.ledgerEntries}`);
  if (r.backlogChanged) out("  BACKLOG.md changed: re-read the work order");
  if (r.indexChanged) out("  the phase index changed");
  if (r.currentPhaseChanged) out(`  the phase in progress (${String(r.currentPhase).padStart(2, "0")}) changed upstream: reconcile it before its next task`);
  for (const t of r.checkedWordingChanged) out(`  checked task reworded upstream in phase ${String(t.phase).padStart(2, "0")}: ${t.task}`);
  return exitFor(r);
}
