import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";

export type Agent = "claude" | "codex" | "both";
export const AGENTS: Agent[] = ["claude", "codex", "both"];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const plugin = join(packageRoot, "plugin/specloop");
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const manifestPath = ".specloop/managed-assets.json";
type Manifest = { files: Record<string, string>; hooks: Record<string, string> };
export type RefreshAction = { path: string; status: "add" | "update" | "current" | "manual merge"; detail?: string };

function occupied(path: string): boolean {
  try { lstatSync(path); return true; } catch { return false; }
}
// Never follow symlink parents when updating assets or shared configuration.
function linked(root: string, path: string): boolean {
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    if (occupied(current) && lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}
function readManifest(root: string): Manifest {
  if (!existsSync(join(root, manifestPath))) return { files: {}, hooks: {} };
  const parsed = JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
  if (!parsed.files || !parsed.hooks) throw new Error("Invalid managed-assets manifest; restore it or manually merge assets.");
  return parsed;
}
function write(root: string, path: string, body: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body);
}
/**
 * Shipped skills carry Claude's top-level `argument-hint`, the inline hint Claude
 * shows after `/specloop `. The Agent Skills spec Codex follows allows no such
 * key, so Codex copies keep the hint under `metadata:` instead.
 */
export function codexSkill(body: string): string {
  const end = body.indexOf("\n---", 4);
  if (!body.startsWith("---\n") || end < 0) return body;
  const lines = body.slice(4, end).split("\n");
  const at = lines.findIndex(line => line.startsWith("argument-hint:"));
  if (at < 0) return body;
  const [hint] = lines.splice(at, 1);
  const metadata = lines.indexOf("metadata:");
  if (metadata < 0) lines.push("metadata:", "  " + hint);
  else lines.splice(metadata + 1, 0, "  " + hint);
  return "---\n" + lines.join("\n") + body.slice(end);
}
export function assetContents(agent: Agent, specDir = "spec"): Map<string, { body: string; legacy?: string }> {
  const files = new Map<string, { body: string; legacy?: string }>();
  const collect = (source: string, target: string, legacy: string, codex = false) => {
    for (const item of readdirSync(source, { withFileTypes: true })) {
      if (item.isDirectory()) collect(join(source, item.name), join(target, item.name), join(legacy, item.name), codex);
      else {
        const body = readFileSync(join(source, item.name), "utf8");
        files.set(join(target, item.name), { body: codex && item.name === "SKILL.md" ? codexSkill(body) : body, legacy: join(legacy, item.name) });
      }
    }
  };
  if (agent !== "codex") {
    collect(join(plugin, "skills"), ".claude/skills", "skills");
    collect(join(plugin, "commands"), ".claude/commands", "commands");
    files.set("CLAUDE.md", { body: "@AGENTS.md\n" });
  }
  if (agent !== "claude") collect(join(plugin, "skills"), ".agents/skills", "skills", true);
  files.set(".specloop/hooks/reconcile.mjs", { body: readFileSync(join(plugin, "hooks/reconcile.mjs"), "utf8") });
  files.set("AGENTS.md", { body: readFileSync(join(packageRoot, "template/AGENTS.md"), "utf8"), legacy: "AGENTS.md" });
  for (const name of ["decision-reconciliation.md", "spec-summary-status.md", "skill-coordination.md"]) {
    files.set(join(specDir, name), { body: readFileSync(join(packageRoot, "template/spec", name), "utf8"), legacy: "spec/" + name });
  }
  return files;
}

export function hookGroup(runtime: "claude" | "codex") {
  // Resolve at execution time, so committed config works in a new clone and from subdirectories.
  const command = `d="$PWD"; while [ ! -f "$d/.specloop/hooks/reconcile.mjs" ] && [ "$d" != / ]; do d="$(dirname "$d")"; done; if [ -f "$d/.specloop/hooks/reconcile.mjs" ]; then bun "$d/.specloop/hooks/reconcile.mjs" ${runtime}; fi`;
  return { hooks: [{ type: "command", command, timeout: 30 }] };
}

/** Inspect by default. Only unchanged managed or byte-recognized legacy assets are replaced. */
export function refreshAssets(root: string, opts: { agent?: Agent; apply?: boolean; onlyIntegration?: boolean } = {}): RefreshAction[] {
  let config;
  try { config = loadConfig(root); } catch {
    return [{ path: ".specloop.json", status: "manual merge", detail: "invalid configuration preserved; integration skipped" }];
  }
  const specPath = relative(resolve(root), resolve(root, config.specDir));
  if (specPath.startsWith("..") || isAbsolute(specPath)) throw new Error("specDir must stay inside the project");
  const agent = opts.agent ?? "claude";
  if (linked(root, manifestPath)) throw new Error("Refusing linked managed-assets manifest; manual merge required.");
  const manifest = readManifest(root);
  const oldManifest = JSON.stringify(manifest);
  const legacy = JSON.parse(readFileSync(join(plugin, "legacy-assets.json"), "utf8")) as Record<string, string | string[]>;
  const actions: RefreshAction[] = [];
  const assets = assetContents(agent, config.specDir);
  for (const [path, source] of assets) {
    if (opts.onlyIntegration && /^(\.claude\/(skills|commands)|\.agents\/skills)\//.test(path)) continue;
    const dest = join(root, path);
    if (linked(root, path) || (occupied(dest) && !lstatSync(dest).isFile())) {
      actions.push({ path, status: "manual merge", detail: "linked or non-file asset preserved" }); continue;
    }
    const current = existsSync(dest) ? readFileSync(dest, "utf8") : undefined;
    const legacyHashes = source.legacy ? legacy[source.legacy] : undefined;
    const recognized = current !== undefined && (manifest.files[path] === digest(current) ||
      (Array.isArray(legacyHashes) ? legacyHashes.includes(digest(current)) : legacyHashes === digest(current)));
    const status = current === source.body ? "current" : current === undefined ? "add" : recognized ? "update" : "manual merge";
    actions.push({ path, status });
    if (opts.apply && status !== "manual merge") {
      if (status !== "current") write(root, path, source.body);
      manifest.files[path] = digest(source.body);
    }
  }
  for (const runtime of (agent === "both" ? ["claude", "codex"] : [agent]) as ("claude" | "codex")[]) {
    const path = runtime === "claude" ? ".claude/settings.json" : ".codex/hooks.json";
    if (linked(root, path)) { actions.push({ path, status: "manual merge", detail: "linked configuration preserved" }); continue; }
    let settings: Record<string, any>;
    try {
      settings = existsSync(join(root, path)) ? JSON.parse(readFileSync(join(root, path), "utf8")) : {};
      if (!settings || typeof settings !== "object" || Array.isArray(settings) || (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== "object" || Array.isArray(settings.hooks)))) throw new Error();
      for (const event of ["SessionStart", "UserPromptSubmit", "Stop"]) if (settings.hooks?.[event] !== undefined && !Array.isArray(settings.hooks[event])) throw new Error();
    } catch { actions.push({ path, status: "manual merge", detail: "invalid hook configuration preserved" }); continue; }
    settings.hooks ??= {};
    let changed = false;
    for (const event of ["SessionStart", "UserPromptSubmit", "Stop"]) {
      const key = `${path}:${event}`;
      const desired = hookGroup(runtime);
      const groups: any[] = settings.hooks[event] ?? [];
      const exact = groups.some(group => JSON.stringify(group) === JSON.stringify(desired));
      if (exact) { if (opts.apply) manifest.hooks[key] = digest(JSON.stringify(desired)); continue; }
      const owned = groups.findIndex(group => manifest.hooks[key] === digest(JSON.stringify(group)));
      const customized = groups.some(group => JSON.stringify(group).includes('.specloop/hooks/reconcile.mjs'));
      if (customized && owned === -1) { actions.push({ path: key, status: "manual merge", detail: "customized specloop hook preserved" }); continue; }
      if (owned >= 0) groups[owned] = desired; else groups.push(desired);
      settings.hooks[event] = groups;
      changed = true;
      if (opts.apply) manifest.hooks[key] = digest(JSON.stringify(desired));
    }
    actions.push({ path, status: changed ? (existsSync(join(root, path)) ? "update" : "add") : "current" });
    if (opts.apply && changed) write(root, path, JSON.stringify(settings, null, 2) + "\n");
  }
  if (opts.apply && JSON.stringify(manifest) !== oldManifest) write(root, manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return actions;
}

/** Record only the skill/command files just installed by the compatibility installer. */
export function rememberInstalled(root: string, installed: string[], agent: Agent): void {
  if (!installed.length || linked(root, manifestPath)) return;
  const manifest = readManifest(root);
  for (const [path, source] of assetContents(agent)) {
    if (installed.some(prefix => path === prefix || path.startsWith(prefix + '/')) && !linked(root, path)) manifest.files[path] = digest(source.body);
  }
  write(root, manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

export function runRefresh(root: string, opts: { agent?: Agent; apply?: boolean } = {}): number {
  if (!existsSync(join(root, '.specloop.json'))) {
    console.error("No .specloop.json found; run init or upgrade first. Nothing changed."); return 1;
  }
  try {
    const actions = refreshAssets(root, opts);
    for (const action of actions) console.log(`${action.status}: ${action.path}${action.detail ? ' — ' + action.detail : ''}`);
    console.log(opts.apply ? "Assets installed/updated where safe. Hook activity unverified: review runtime trust, restart, and inspect /hooks. Manual merges remain your responsibility." : "Dry run; use --apply to refresh recognized assets. Ledger history is never replaced.");
    return actions.some(action => action.status === 'manual merge') ? 2 : 0;
  } catch (error) { console.error((error as Error).message); return 1; }
}
