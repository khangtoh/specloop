import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const roots: string[] = [];
const source = resolve(import.meta.dir, '..');
const files = ['package.json', 'plugin/specloop/.claude-plugin/plugin.json', 'plugin/specloop/.codex-plugin/plugin.json'];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'specloop-release-test-'));
  roots.push(root);
  const repo = join(root, 'repo'), bin = join(root, 'bin'), remote = join(root, 'remote.git');
  mkdirSync(repo); mkdirSync(bin);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, MOCK_ROOT: root, NPM_TOKEN: '', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const cmd = (name: string, args: string[], cwd = repo) => {
    const result = spawnSync(name, args, { cwd, env, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`);
    return result.stdout.trim();
  };
  cmd('git', ['init', '--bare', remote]);
  cmd('git', ['init', '-b', 'main']);
  cmd('git', ['config', 'user.email', 'release@example.com']);
  cmd('git', ['config', 'user.name', 'Release Test']);
  for (const path of files) {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), JSON.stringify({ name: '@test/specloop', version: '1.0.0' }, null, 2) + '\n');
  }
  mkdirSync(join(repo, 'spec'));
  writeFileSync(join(repo, 'spec/agent-session-ledger.md'), '# Ledger\n\n- [ ] Unrelated acceptance\n');
  mkdirSync(join(repo, 'scripts'));
  for (const path of ['release.mjs', 'release.sh', 'finish-release.sh']) copyFileSync(join(source, 'scripts', path), join(repo, 'scripts', path));
  writeFileSync(join(repo, 'scripts/verify-onboarding.sh'), '#!/bin/sh\necho "onboarding $*" >> "$MOCK_ROOT/calls"\n[ "$1" = "--tarball" ] && [ -f "$2" ]\n');
  const mock = `#!/usr/bin/env node
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = process.env.MOCK_ROOT, args = process.argv.slice(2), tool = path.basename(process.argv[1]);
fs.appendFileSync(path.join(root, 'calls'), tool + ' ' + args.join(' ') + '\\n');
const flag = name => fs.existsSync(path.join(root, name));
if(tool === 'bun') {
 if(flag('manifest-gate-mutation')) { const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.name = '@custom/change'; fs.writeFileSync('package.json', JSON.stringify(pkg)); }
 process.exit(flag('gate-fail') ? 1 : 0);
}
const registryFile = path.join(root, 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryFile));
const version = JSON.parse(fs.readFileSync('package.json')).version;
if(args[0] === 'whoami') { console.log(flag('auth-fail') ? 'AUTH SECRET' : 'test-user'); process.exit(flag('auth-fail') ? 1 : 0); }
if(args[0] === 'view') {
 if(flag('network-fail')) { console.log(JSON.stringify({error: {code:'ENETUNREACH'}})); process.exit(1); }
 const requested = args[1].match(/@(\\d+\\.\\d+\\.\\d+)$/)?.[1] || registry.latest;
 const integrity = registry[requested];
 if(!integrity) { console.log(JSON.stringify({error: {code:'E404'}})); process.exit(1); }
 console.log(JSON.stringify({version: requested, 'dist.integrity': integrity}));
} else if(args[0] === 'pack') {
 const filename = 'test-specloop-' + version + '.tgz';
 const content = ['package.json','plugin/specloop/.claude-plugin/plugin.json','plugin/specloop/.codex-plugin/plugin.json'].map(p=>fs.readFileSync(p,'utf8')).join('');
 const tarball = path.join(args[args.indexOf('--pack-destination') + 1], filename);
 fs.writeFileSync(tarball, content);
 console.log(JSON.stringify([{filename, integrity:'sha512-' + crypto.createHash('sha512').update(content).digest('base64')}]));
} else if(args[0] === 'publish') {
 if(flag('publish-fail')) { console.error('AUTH SECRET'); process.exit(1); }
 registry[version] = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(args[1])).digest('base64');
 registry.latest = version; fs.writeFileSync(registryFile, JSON.stringify(registry));
} else process.exit(2);
`;
  for (const tool of ['npm', 'bun']) writeFileSync(join(bin, tool), mock, { mode: 0o755 });
  writeFileSync(join(root, 'registry.json'), JSON.stringify({ latest: '1.0.0', '1.0.0': 'old-integrity' }));
  cmd('git', ['add', '.']); cmd('git', ['commit', '-m', 'initial']);
  cmd('git', ['remote', 'add', 'origin', remote]); cmd('git', ['push', '-u', 'origin', 'main']);
  const run = (mode = 'release', args: string[] = []) => spawnSync('bash', [`scripts/${mode === 'release' ? 'release' : 'finish-release'}.sh`, ...args], { cwd: repo, env, encoding: 'utf8' });
  const calls = () => readFileSync(join(root, 'calls'), 'utf8');
  const flag = (name: string) => writeFileSync(join(root, name), '1');
  return { root, repo, remote, cmd, run, calls, flag };
}

describe('release transaction (isolated git and mocked npm/Bun)', () => {
  test('publishes the single onboarding artifact, synchronizes manifests and explicitly pushes an annotated tag', () => {
    const f = fixture(), result = f.run('release', ['minor']);
    expect(result.status, result.stderr).toBe(0);
    for (const path of files) expect(JSON.parse(readFileSync(join(f.repo, path), 'utf8')).version).toBe('1.1.0');
    expect(f.calls().match(/^npm pack /gm)?.length).toBe(1);
    const tarball = f.calls().match(/^onboarding --tarball (.+)$/m)![1];
    expect(f.calls()).toContain(`npm publish ${tarball} `);
    expect(f.calls()).toContain('bun run typecheck');
    expect(f.cmd('git', ['cat-file', '-t', 'v1.1.0'])).toBe('tag');
    expect(f.cmd('git', ['ls-remote', 'origin', 'refs/tags/v1.1.0'])).toContain('refs/tags/v1.1.0');
    expect(f.cmd('git', ['status', '--porcelain'])).toBe('');
    const ledger = readFileSync(join(f.repo, 'spec/agent-session-ledger.md'), 'utf8');
    expect(ledger).toContain('- [ ] Unrelated acceptance');
    expect(ledger).toContain('Integrity: `sha512-');
    expect(ledger).toContain('push follow');
  });
  test('dry run restores exact manifest bytes, leaves refs unchanged and never publishes', () => {
    const f = fixture(), before = f.cmd('git', ['show-ref']);
    const result = f.run('release', ['major', '--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    expect(f.calls()).not.toContain('npm publish');
    expect(f.cmd('git', ['show-ref'])).toBe(before);
    expect(f.cmd('git', ['status', '--porcelain'])).toBe('');
  });
  test('rejects dirty tree, stale local registry version and failed authentication without version edits', () => {
    for (const failure of ['dirty', 'stale', 'auth-fail', 'network-fail', 'gate-fail']) {
      const f = fixture();
      if (failure === 'dirty') writeFileSync(join(f.repo, 'custom'), 'keep');
      else if (failure === 'stale') writeFileSync(join(f.root, 'registry.json'), JSON.stringify({ latest: '1.2.0', '1.2.0': 'registry-new' }));
      else f.flag(failure);
      const result = f.run();
      expect(result.status, failure).not.toBe(0);
      expect(JSON.parse(readFileSync(join(f.repo, 'package.json'), 'utf8')).version).toBe('1.0.0');
      expect(result.stderr).not.toContain('AUTH SECRET');
      if (failure !== 'dirty') expect(f.cmd('git', ['status', '--porcelain'])).toBe('');
    }
  });
  test('refuses upstream divergence without discarding local commits', () => {
    const f = fixture();
    f.cmd('git', ['checkout', '-b', 'other']);
    writeFileSync(join(f.repo, 'upstream'), 'remote'); f.cmd('git', ['add', '.']); f.cmd('git', ['commit', '-m', 'remote']);
    f.cmd('git', ['push', 'origin', 'HEAD:main']); f.cmd('git', ['checkout', 'main']);
    writeFileSync(join(f.repo, 'local'), 'local'); f.cmd('git', ['add', '.']); f.cmd('git', ['commit', '-m', 'local']);
    const head = f.cmd('git', ['rev-parse', 'HEAD']), result = f.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('divergent');
    expect(f.cmd('git', ['rev-parse', 'HEAD'])).toBe(head);
  });
  test('failed publish resumes exact saved artifact without a second bump or pack', () => {
    const f = fixture(); f.flag('publish-fail');
    expect(f.run().status).not.toBe(0);
    expect(f.run().stderr).toContain('unfinished release');
    rmSync(join(f.root, 'publish-fail'));
    const result = f.run('finish');
    expect(result.status, result.stderr).toBe(0);
    expect(f.calls().match(/^npm pack /gm)?.length).toBe(1);
    expect(JSON.parse(readFileSync(join(f.repo, 'package.json'), 'utf8')).version).toBe('1.0.1');
  });
  test('push failure resumes published version without republishing or overwriting custom edits', () => {
    const f = fixture();
    const hook = join(f.remote, 'hooks/pre-receive'); writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    expect(f.run().status).not.toBe(0);
    expect(f.calls().match(/^npm publish /gm)?.length).toBe(1);
    writeFileSync(join(f.repo, 'custom'), 'preserve');
    expect(f.run('finish').stderr).toContain('unrelated changes');
    expect(readFileSync(join(f.repo, 'custom'), 'utf8')).toBe('preserve');
    rmSync(join(f.repo, 'custom')); rmSync(hook);
    const before = f.cmd('git', ['show-ref']);
    expect(f.run('finish', ['--dry']).status).toBe(0);
    expect(f.cmd('git', ['show-ref'])).toBe(before);
    const result = f.run('finish');
    expect(result.status, result.stderr).toBe(0);
    expect(f.calls().match(/^npm publish /gm)?.length).toBe(1);
    expect(f.calls().match(/^npm pack /gm)?.length).toBe(1);
  });
  test('recovery repairs a saved ledger append interrupted before the file write', () => {
    const f = fixture(); f.flag('publish-fail'); expect(f.run().status).not.toBe(0);
    const statePath = join(f.repo, '.git/specloop-release.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    state.evidence = true;
    state.files['spec/agent-session-ledger.md'] += '\nSaved verified release evidence\n';
    writeFileSync(statePath, JSON.stringify(state));
    writeFileSync(join(f.root, 'registry.json'), JSON.stringify({ latest: state.version, [state.version]: state.integrity }));
    const result = f.run('finish');
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(f.repo, 'spec/agent-session-ledger.md'), 'utf8')).toContain('Saved verified release evidence');
    expect(f.calls().match(/^npm publish /gm)?.length).toBe(1); // Only the initial failed request.
  });
  test('clean no-state recovery preserves an existing matching lightweight tag while pushing new ledger evidence', () => {
    const f = fixture();
    const content = files.map(path => readFileSync(join(f.repo, path), 'utf8')).join('');
    const integrity = 'sha512-' + createHash('sha512').update(content).digest('base64');
    writeFileSync(join(f.root, 'registry.json'), JSON.stringify({ latest: '1.0.0', '1.0.0': integrity }));
    f.cmd('git', ['tag', 'v1.0.0']);
    const tagTarget = f.cmd('git', ['rev-parse', 'v1.0.0']);
    const result = f.run('finish');
    expect(result.status, result.stderr).toBe(0);
    expect(f.calls()).not.toContain('npm publish');
    expect(f.cmd('git', ['rev-parse', 'v1.0.0'])).toBe(tagTarget);
    expect(f.cmd('git', ['ls-remote', 'origin', 'refs/tags/v1.0.0'])).toContain(tagTarget);
    expect(result.stdout).toContain(`v1.0.0 at ${tagTarget}`);
    expect(f.cmd('git', ['status', '--porcelain'])).toBe('');
  });
  test('recovery refuses an unpublished target older than newly advanced npm latest', () => {
    const f = fixture(); f.flag('publish-fail'); expect(f.run().status).not.toBe(0);
    writeFileSync(join(f.root, 'registry.json'), JSON.stringify({ latest: '1.2.0', '1.2.0': 'newer' }));
    const result = f.run('finish');
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('refusing to downgrade latest');
    expect(f.calls().match(/^npm publish /gm)?.length).toBe(1);
  });
  test('verification side effects stop publication and preserve custom content', () => {
    const f = fixture();
    writeFileSync(join(f.repo, 'scripts/verify-onboarding.sh'), '#!/bin/sh\necho custom > README.md\n');
    f.cmd('git', ['add', '.']); f.cmd('git', ['commit', '-m', 'gate fixture']);
    const result = f.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('unrelated changes');
    expect(f.calls()).not.toContain('npm publish');
    expect(readFileSync(join(f.repo, 'README.md'), 'utf8')).toBe('custom\n');
  });
  test('a verification gate cannot silently alter manifest content before the version bump', () => {
    const f = fixture(); f.flag('manifest-gate-mutation');
    const result = f.run();
    expect(result.status).not.toBe(0); expect(result.stderr).toContain('package.json differs');
    expect(f.calls()).not.toContain('npm pack');
    expect(f.calls()).not.toContain('npm publish');
    expect(JSON.parse(readFileSync(join(f.repo, 'package.json'), 'utf8')).name).toBe('@custom/change');
  });
  test('recovery blocks changed artifact and foreign tags', () => {
    const f = fixture(); f.flag('publish-fail'); expect(f.run().status).not.toBe(0);
    const state = JSON.parse(readFileSync(join(f.repo, '.git/specloop-release.json'), 'utf8'));
    writeFileSync(state.tarball, 'tampered');
    expect(f.run('finish').stderr).toContain('integrity changed');
    const other = fixture(); other.flag('publish-fail'); expect(other.run().status).not.toBe(0);
    other.cmd('git', ['tag', 'v1.0.1']);
    // This is not a release commit; it must never be silently overwritten.
    rmSync(join(other.root, 'publish-fail'));
    const result = other.run('finish');
    expect(result.status).not.toBe(0);
  });
});
