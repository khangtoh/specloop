import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SpecloopConfig } from "./config.js";

export const RUN_STATE_FILE = "specloop-run-state.md";

/** The scope a run is working, as recorded in the advisory run-state record.
 *  `phase` is one phase (bare `specloop`), `loop` is every eligible phase,
 *  `phases` is an explicit list. */
export type RunScope =
  | { kind: "phase"; phase: number }
  | { kind: "loop" }
  | { kind: "phases"; phases: number[] };

export interface RunState {
  status: string; // `idle` | `active` | `blocked`, verbatim from the record
  scope: RunScope | null; // null when the record has no usable `Run scope:`
  statedGoal: string | null;
  currentPhase: string | null;
  raw: string;
}

export function runStatePath(rootDir: string, config: SpecloopConfig): string {
  return join(rootDir, config.specDir, RUN_STATE_FILE);
}

/** A run is live only while the record says `active`. Anything else — `idle`,
 *  `blocked`, a missing record — means no run is in flight, which is what keeps
 *  the Stop hook inert in sessions that aren't running a specloop loop. */
export function isActive(state: RunState | null): boolean {
  return state !== null && state.status.toLowerCase() === "active";
}

export function readRunState(rootDir: string, config: SpecloopConfig): RunState | null {
  const path = runStatePath(rootDir, config);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  return {
    status: field(raw, "Run status") ?? "idle",
    scope: parseRunScope(field(raw, "Run scope")),
    statedGoal: placeholderToNull(field(raw, "Stated goal")),
    currentPhase: placeholderToNull(field(raw, "Current phase")),
    raw,
  };
}

function field(raw: string, label: string): string | null {
  const m = raw.match(new RegExp(`^\\s*${label}:\\s*(.*)$`, "im"));
  return m ? m[1].trim() : null;
}

/** `_None_`, `None`, and an empty value all mean "not set". */
function placeholderToNull(v: string | null): string | null {
  if (v === null) return null;
  const bare = v.replace(/^_+|_+$/g, "").trim();
  return bare === "" || /^none\b/i.test(bare) ? null : v;
}

/** Parse the `Run scope:` value: `loop`, `phase NN`, or `phases NN,NN`. */
export function parseRunScope(value: string | null): RunScope | null {
  if (placeholderToNull(value) === null) return null;
  const v = value!.replace(/[`_]/g, "").trim();
  if (/^loop\b/i.test(v)) return { kind: "loop" };
  const nums = v.match(/\d+/g);
  if (!nums) return null;
  if (/^phases\b/i.test(v)) {
    const phases = dedupe(nums.map((n) => parseInt(n, 10)));
    return phases.length ? { kind: "phases", phases } : null;
  }
  if (/^phase\b/i.test(v)) return { kind: "phase", phase: parseInt(nums[0], 10) };
  return null;
}

export function formatRunScope(scope: RunScope): string {
  if (scope.kind === "loop") return "loop";
  if (scope.kind === "phase") return `phase ${pad(scope.phase)}`;
  return `phases ${scope.phases.map(pad).join(",")}`;
}

/** Rewrite the recorded scope, status, stated goal, and date in place, leaving
 *  every other line of the record untouched. Returns false when there is no
 *  record to update — the record is optional, so that is not an error. */
export function writeRunState(
  rootDir: string,
  config: SpecloopConfig,
  patch: { status?: string; scope?: RunScope; statedGoal?: string; currentPhase?: string },
): boolean {
  const path = runStatePath(rootDir, config);
  if (!existsSync(path)) return false;
  let raw = readFileSync(path, "utf8");
  if (patch.status !== undefined) raw = setField(raw, "Run status", patch.status);
  if (patch.scope !== undefined) raw = setField(raw, "Run scope", formatRunScope(patch.scope));
  if (patch.statedGoal !== undefined) raw = setField(raw, "Stated goal", patch.statedGoal);
  if (patch.currentPhase !== undefined) raw = setField(raw, "Current phase", patch.currentPhase);
  raw = setField(raw, "Last-updated date", today());
  writeFileSync(path, raw);
  return true;
}

/** Replace a `Label: value` line, or append it after `Run status:` when the
 *  record predates the field (an older scaffold must keep working). */
function setField(raw: string, label: string, value: string): string {
  const re = new RegExp(`^(\\s*${label}:)[ \\t]*.*$`, "im");
  if (re.test(raw)) return raw.replace(re, `$1 ${value}`);
  const anchor = raw.match(/^(\s*Run status:.*)$/im);
  if (anchor) return raw.replace(anchor[0], `${anchor[0]}\n${label}: ${value}`);
  return `${raw.trimEnd()}\n${label}: ${value}\n`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dedupe(nums: number[]): number[] {
  return [...new Set(nums)];
}
