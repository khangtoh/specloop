import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";
import { runUpgrade } from "../src/commands/upgrade.js";
import { assetContents, refreshAssets, runRefresh, type Agent } from "../src/commands/refresh.js";
import { main } from "../src/cli.js";
let dir: string;
let log: typeof console.log;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'specloop refresh spaces ')); log = console.log; console.log = () => {}; });
afterEach(() => { console.log = log; rmSync(dir, { recursive: true, force: true }); });
const read = (path: string) => readFileSync(join(dir, path), 'utf8');
for (const agent of ['claude', 'codex', 'both'] as Agent[]) {
  test(`init ${agent} installs selected skills and hooks; refresh is idempotent`, () => {
    expect(runInit(dir, { agent })).toBe(0);
    expect(existsSync(join(dir, '.claude/settings.json'))).toBe(agent !== 'codex');
    expect(existsSync(join(dir, '.codex/hooks.json'))).toBe(agent !== 'claude');
    expect(existsSync(join(dir, '.agents/skills/specloop/SKILL.md'))).toBe(agent !== 'claude');
    const manifest = read('.specloop/managed-assets.json');
    const actions = refreshAssets(dir, { agent, apply: true });
    expect(actions.every(a => a.status === 'current')).toBe(true);
    expect(read('.specloop/managed-assets.json')).toBe(manifest);
  });
  test(`upgrade ${agent} dry-run and apply`, () => {
    mkdirSync(join(dir, 'spec'));
    writeFileSync(join(dir, 'spec/01-test.md'), '# Test\n\nGoal: test.\n\nDepends on: None.\n\n- [ ] test\n');
    runUpgrade(dir, { agent }); expect(existsSync(join(dir, '.specloop'))).toBe(false);
    runUpgrade(dir, { agent, apply: true });
    expect(existsSync(join(dir, agent === 'codex' ? '.codex/hooks.json' : '.claude/settings.json'))).toBe(true);
  });
}
test('custom instructions, skills and unrelated hooks survive refresh; ledger never reset even on forced init', () => {
  runInit(dir, { agent: 'both' });
  writeFileSync(join(dir, 'AGENTS.md'), 'Custom instructions\n');
  appendFileSync(join(dir, '.agents/skills/specloop/SKILL.md'), '\nCustom rules\n');
  appendFileSync(join(dir, 'spec/agent-session-ledger.md'), '\nHistorical decision\n');
  const ledger = read('spec/agent-session-ledger.md');
  const settings = JSON.parse(read('.claude/settings.json'));
  settings.permissions = { deny: ['Bash(rm *)'] };
  const unrelated = { hooks: [{ type: 'command', command: 'echo unrelated' }] };
  settings.hooks.Stop.push(unrelated);
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(settings));
  const before = read('.claude/settings.json');
  expect(runRefresh(dir, { agent: 'both' })).toBe(2);
  expect(read('.claude/settings.json')).toBe(before);
  expect(runRefresh(dir, { agent: 'both', apply: true })).toBe(2);
  expect(read('AGENTS.md')).toBe('Custom instructions\n');
  expect(read('.agents/skills/specloop/SKILL.md')).toContain('Custom rules');
  expect(JSON.parse(read('.claude/settings.json')).hooks.Stop).toContainEqual(unrelated);
  expect(read('spec/agent-session-ledger.md')).toBe(ledger);
  runInit(dir, { force: true }); expect(read('spec/agent-session-ledger.md')).toBe(ledger);
});
test('legacy shipped assets update, customized legacy files need manual merge', () => {
  runInit(dir);
  const legacy = readFileSync(join(import.meta.dir, "fixtures/agent-assets/specloop-0.5.0.md"), "utf8");
  writeFileSync(join(dir, '.claude/skills/specloop/SKILL.md'), legacy);
  const dry = refreshAssets(dir);
  expect(dry.find(a => a.path === '.claude/skills/specloop/SKILL.md')?.status).toBe('update');
  expect(read('.claude/skills/specloop/SKILL.md')).toBe(legacy);
  refreshAssets(dir, { apply: true });
  expect(read('.claude/skills/specloop/SKILL.md')).toContain('Decision reconciliation');
});
test('customized managed hook is preserved without duplicate; other events can install', () => {
  runInit(dir);
  const settings = JSON.parse(read('.claude/settings.json'));
  settings.hooks.Stop[0].hooks[0].timeout = 7;
  delete settings.hooks.SessionStart;
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(settings));
  const actions = refreshAssets(dir, { apply: true });
  expect(actions.some(a => a.status === 'manual merge')).toBe(true);
  const after = JSON.parse(read('.claude/settings.json'));
  expect(after.hooks.Stop).toHaveLength(1);
  expect(after.hooks.Stop[0].hooks[0].timeout).toBe(7);
  expect(after.hooks.SessionStart).toHaveLength(1);
});
test('symlinked skills and malformed configuration are preserved', () => {
  runInit(dir, { skills: 'link' });
  expect(refreshAssets(dir, { apply: true }).some(a => a.status === 'manual merge')).toBe(true);
  writeFileSync(join(dir, '.claude/settings.json'), '{invalid');
  refreshAssets(dir, { apply: true });
  expect(read('.claude/settings.json')).toBe('{invalid');
});
test('non-specloop refresh refuses to create assets; --agent validation rejects missing/invalid values', () => {
  expect(runRefresh(dir, { apply: true })).toBe(1);
  expect(existsSync(join(dir, '.specloop'))).toBe(false);
  expect(main(['bun', 'specloop', 'init', dir, '--agent', 'invalid'])).toBe(1);
  expect(main(['bun', 'specloop', 'init', dir, '--agent'])).toBe(1);
});
test('an unchanged older managed file upgrades; extra custom files survive', () => {
  runInit(dir);
  const path = '.claude/skills/specloop/SKILL.md';
  const old = '# Earlier managed version\n';
  writeFileSync(join(dir, path), old);
  const manifest = JSON.parse(read('.specloop/managed-assets.json'));
  manifest.files[path] = new Bun.CryptoHasher('sha256').update(old).digest('hex');
  writeFileSync(join(dir, '.specloop/managed-assets.json'), JSON.stringify(manifest));
  writeFileSync(join(dir, '.claude/skills/specloop/custom.txt'), 'keep me');
  expect(refreshAssets(dir).find(a => a.path === path)?.status).toBe('update');
  refreshAssets(dir, { apply: true });
  expect(read(path)).toContain('Decision reconciliation');
  expect(read('.claude/skills/specloop/custom.txt')).toBe('keep me');
});
test('hook merging preserves unrelated settings when installing new event groups', () => {
  runInit(dir, { skills: 'none' });
  mkdirSync(join(dir, '.claude'));
  const unrelated = { hooks: [{ type: 'command', command: 'echo hello' }] };
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ permissions: { deny: ['Bash(rm *)'] }, hooks: { Stop: [unrelated] } }));
  refreshAssets(dir, { apply: true });
  const result = JSON.parse(read('.claude/settings.json'));
  expect(result.permissions.deny).toEqual(['Bash(rm *)']);
  expect(result.hooks.Stop).toHaveLength(2);
  expect(result.hooks.Stop[0]).toEqual(unrelated);
});
