import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { hookGroup } from "../src/commands/refresh.js";

let dir: string;
const runner = join(import.meta.dir, "../plugin/specloop/hooks/reconcile.mjs");
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "specloop hook spaces "));
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, ".specloop.json"), '{}');
  writeFileSync(join(dir, "spec/agent-session-ledger.md"), '# Ledger\n');
  writeFileSync(join(dir, "work.txt"), 'before');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
function hook(event: string, extra: Record<string, unknown> = {}, runtime = "claude") {
  const run = spawnSync(process.execPath, [runner, runtime], {
    input: JSON.stringify({ hook_event_name: event, cwd: dir, session_id: "session-a", ...extra }),
    env: { ...process.env, SPECLOOP_HOOK_STATE_DIR: join(dir, '.cache') }, encoding: 'utf8',
  });
  expect(run.status).toBe(0);
  return run.stdout.trim() ? JSON.parse(run.stdout.trim()) : {};
}
function change() { writeFileSync(join(dir, 'work.txt'), 'after'); }
function append() { appendFileSync(join(dir, 'spec/agent-session-ledger.md'), '\n## 2026-09-16\nImplemented the requested work; verified tests.\n'); }
function git(...args: string[]) { return execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }); }
for (const runtime of ['claude', 'codex']) {
  test(`${runtime}: startup/resume/compact inject contract without resetting prompt baseline`, () => {
    hook('UserPromptSubmit', {}, runtime); change();
    for (const source of ['startup', 'resume', 'compact']) {
      const output = hook('SessionStart', { source }, runtime);
      expect(output.hookSpecificOutput.additionalContext).toContain('Previous decision');
      expect(output.hookSpecificOutput.additionalContext).toContain('read spec/agent-session-ledger.md');
    }
    expect(hook('Stop', {}, runtime).decision).toBe('block');
  });
  test(`${runtime}: valid append satisfies material changes`, () => {
    hook('UserPromptSubmit', {}, runtime); change(); append();
    expect(hook('Stop', {}, runtime)).toEqual({});
  });
}
test('read-only prompt has no ledger churn or Stop correction', () => {
  hook('UserPromptSubmit');
  expect(hook('Stop')).toEqual({});
  expect(readFileSync(join(dir, 'spec/agent-session-ledger.md'), 'utf8')).toBe('# Ledger\n');
});
test('Plan Mode creates no baseline and does not enforce mutations', () => {
  hook('UserPromptSubmit', { permission_mode: 'plan' }); change();
  expect(hook('Stop', { permission_mode: 'plan' })).toEqual({});
  expect(existsSync(join(dir, '.cache'))).toBe(false);
});
test('one correction maximum, including synthetic continuation prompt without retry flag', () => {
  hook('UserPromptSubmit'); change();
  expect(hook('Stop').decision).toBe('block');
  hook('UserPromptSubmit');
  const next = hook('Stop');
  expect(next.decision).toBeUndefined();
  expect(next.systemMessage).toContain('unresolved');
});
test('runtime retry flag is respected on the first observed Stop', () => {
  hook('UserPromptSubmit'); change();
  const output = hook('Stop', { stop_hook_active: true });
  expect(output.decision).toBeUndefined(); expect(output.systemMessage).toContain('unresolved');
});
test('successful correction and next real prompt get independent baselines', () => {
  hook('UserPromptSubmit'); change(); expect(hook('Stop').decision).toBe('block');
  append(); expect(hook('Stop', { stop_hook_active: true })).toEqual({});
  hook('UserPromptSubmit'); writeFileSync(join(dir, 'next.txt'), 'new');
  expect(hook('Stop').decision).toBe('block');
});
test('ledger rewrite and whitespace-only append cannot satisfy enforcement', () => {
  hook('UserPromptSubmit'); change();
  appendFileSync(join(dir, 'spec/agent-session-ledger.md'), '  \n');
  expect(hook('Stop').decision).toBe('block');
  writeFileSync(join(dir, 'spec/agent-session-ledger.md'), '# Replacement\n');
  expect(hook('Stop', { stop_hook_active: true }).systemMessage).toContain('history was altered');
});
test('committed changes remain visible with clean git status', () => {
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  writeFileSync(join(dir, '.gitignore'), '.cache/\n');
  git('add', '.'); git('commit', '-qm', 'baseline');
  hook('UserPromptSubmit'); change(); git('add', '.'); git('commit', '-qm', 'turn');
  expect(git('status', '--porcelain').toString()).toBe('');
  expect(hook('Stop').decision).toBe('block');
});
test('new and deleted files count as material changes', () => {
  hook('UserPromptSubmit'); rmSync(join(dir, 'work.txt')); writeFileSync(join(dir, 'new.txt'), 'new');
  expect(hook('Stop').decision).toBe('block');
});
test('concurrent sessions and runtimes do not overwrite one another', () => {
  hook('UserPromptSubmit'); change();
  hook('UserPromptSubmit', { session_id: 'session-b' });
  hook('UserPromptSubmit', {}, 'codex');
  expect(hook('Stop', { session_id: 'session-b' })).toEqual({});
  expect(hook('Stop', {}, 'codex')).toEqual({});
  expect(hook('Stop').decision).toBe('block');
});
test('non-specloop repository is a silent no-op', () => {
  rmSync(join(dir, '.specloop.json'));
  expect(hook('UserPromptSubmit')).toEqual({});
  expect(hook('Stop')).toEqual({});
  expect(existsSync(join(dir, '.cache'))).toBe(false);
});
test('installed shell command works from nested paths with spaces', () => {
  mkdirSync(join(dir, '.specloop/hooks'), { recursive: true });
  writeFileSync(join(dir, '.specloop/hooks/reconcile.mjs'), readFileSync(runner));
  mkdirSync(join(dir, 'nested space'));
  const result = spawnSync('sh', ['-c', hookGroup('codex').hooks[0]!.command], { cwd: join(dir, 'nested space'), input: JSON.stringify({ cwd: join(dir, 'nested space'), session_id: 'test', hook_event_name: 'SessionStart' }), encoding: 'utf8' });
  expect(result.status).toBe(0); expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain('Before work');
});
test('baseline failures return one valid JSON object with context and a warning', () => {
  const result = hook('UserPromptSubmit', { session_id: '' });
  expect(result.hookSpecificOutput.additionalContext).toContain('Before work');
  expect(result.systemMessage).toContain('missing session_id');
});
