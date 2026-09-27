// Hermetic tests for the shared release kit: a throwaway git repository with a
// bare origin, and stub npm/gh executables on PATH. Run: node --test scripts/release-kit/release.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, KIT_FILES, nextVersion, parseVersion } from './release.mjs';

const kitDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(kitDir, '..', '..');

const NPM = `#!/usr/bin/env bash
echo "npm $*" >> "$SHIM_LOG"
case "$1" in
  view)
    if [ -f "$SHIM_STATE/published" ]; then printf '"%s"\\n' "$(cat "$SHIM_STATE/published")"
    else echo '{"error":{"code":"E404"}}'; echo "npm error code E404" >&2; exit 1; fi ;;
  publish)
    [ -n "$NPM_CONFIG_USERCONFIG" ] && cp "$NPM_CONFIG_USERCONFIG" "$SHIM_STATE/npmrc"
    [ -f "$SHIM_STATE/publish-fails" ] && exit 1
    node -e "const c=require('crypto'),f=require('fs');f.writeFileSync(process.env.SHIM_STATE+'/published','sha512-'+c.createHash('sha512').update(f.readFileSync(process.argv[1])).digest('base64'))" "$2" ;;
esac
`;
const GH = `#!/usr/bin/env bash
echo "gh $*" >> "$SHIM_LOG"
if [ "$1 $2" = "release view" ]; then [ -f "$SHIM_STATE/release" ]; exit $?; fi
if [ "$1 $2" = "release create" ]; then
  while [ $# -gt 0 ]; do [ "$1" = "--notes-file" ] && cp "$2" "$SHIM_STATE/notes.md"; shift; done
  touch "$SHIM_STATE/release"
fi
`;

const CONFIG = {
  name: 'demo-pkg',
  sync: [{ file: 'package.json', json: 'version' }, { file: 'README.md', pattern: 'Current release: \\[([^\\]]+)\\]' }],
  changelog: 'CHANGELOG.md',
  setup: [['node', '-e', "require('fs').appendFileSync('.ran','setup\\n')"]],
  verify: [['node', '-e', "require('fs').appendFileSync('.ran','verify\\n')"]],
  package: ['node', '-e', "require('fs').writeFileSync(process.argv[1] + '/demo-pkg-' + process.argv[2] + '.tgz', 'bytes of ' + process.argv[2])", '{out}', '{version}'],
  verifyArtifacts: [['node', '-e', "require('fs').appendFileSync('.ran','artifact ' + require('path').basename(process.argv[1]) + '\\n')", '{tarball}']],
  publish: 'npm',
};

function sh(cwd, ...argv) {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${argv.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function fixture(t, { config = CONFIG, version = '1.2.0' } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'release kit '));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const origin = join(base, 'origin.git');
  const repo = join(base, 'repo');
  const state = join(base, 'state');
  const bin = join(base, 'bin');
  for (const dir of [state, bin]) mkdirSync(dir);
  writeFileSync(join(bin, 'npm'), NPM); writeFileSync(join(bin, 'gh'), GH);
  chmodSync(join(bin, 'npm'), 0o755); chmodSync(join(bin, 'gh'), 0o755);
  sh(base, 'git', 'init', '-q', '--bare', '-b', 'main', origin);
  sh(base, 'git', 'clone', '-q', origin, repo);
  sh(repo, 'git', 'checkout', '-q', '-b', 'main');
  sh(repo, 'git', 'config', 'user.email', 'kit@example.test');
  sh(repo, 'git', 'config', 'user.name', 'Kit Test');
  mkdirSync(join(repo, 'scripts', 'release-kit'), { recursive: true });
  copyFileSync(join(kitDir, 'release.mjs'), join(repo, 'scripts', 'release-kit', 'release.mjs'));
  writeFileSync(join(repo, 'release.config.json'), JSON.stringify(config, null, 2) + '\n');
  writeFileSync(join(repo, 'VERSION'), version + '\n');
  writeFileSync(join(repo, 'package.json'), `{\n  "name": "demo-pkg",\n    "version": "${version}",\n  "dependencies": { "x": "1.0.0" }\n}\n`);
  writeFileSync(join(repo, 'README.md'), `# Demo\n\nCurrent release: [${version}](CHANGELOG.md).\n`);
  writeFileSync(join(repo, 'CHANGELOG.md'), `# Changelog\n\n## Unreleased\n\n- Added a thing.\n\n## ${version} — 2026-01-01\n\n- Earlier.\n`);
  writeFileSync(join(repo, '.gitignore'), 'dist/\n.ran\n');
  sh(repo, 'git', 'add', '-A');
  sh(repo, 'git', 'commit', '-q', '-m', 'init');
  sh(repo, 'git', 'push', '-q', 'origin', 'main');
  const log = join(state, 'log');
  writeFileSync(log, '');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SHIM_LOG: log, SHIM_STATE: state, RELEASE_KIT_POLL_MS: '1', GITHUB_REF: 'refs/heads/main' };
  delete env.NPM_TOKEN; delete env.GITHUB_OUTPUT;
  const kit = (args, extra = {}) => {
    const result = spawnSync(process.execPath, ['scripts/release-kit/release.mjs', ...args], { cwd: repo, encoding: 'utf8', env: { ...env, ...extra } });
    return { code: result.status, out: result.stdout, err: result.stderr };
  };
  const read = (path) => readFileSync(join(repo, path), 'utf8');
  const calls = () => readFileSync(log, 'utf8');
  return { base, origin, repo, state, kit, read, calls, sh: (...argv) => sh(repo, ...argv) };
}

test('version parsing, ordering and bumps', () => {
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(nextVersion('1.2.3', '1.4.0-rc.1'), '1.4.0-rc.1');
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.throws(() => parseVersion('v1.2'));
  assert.throws(() => nextVersion('1.2.3', 'huge'));
});

test('bump sets VERSION, syncs files in place, cuts the changelog, commits and pushes main', (t) => {
  const f = fixture(t);
  const result = f.kit(['bump', 'minor']);
  assert.equal(result.code, 0, result.err);
  assert.equal(f.read('VERSION'), '1.3.0\n');
  assert.match(f.read('package.json'), /\n {4}"version": "1\.3\.0",\n/);
  assert.match(f.read('package.json'), /"x": "1\.0\.0"/);
  assert.match(f.read('README.md'), /Current release: \[1\.3\.0\]\(CHANGELOG\.md\)/);
  assert.match(f.read('CHANGELOG.md'), /## Unreleased\n\nNo unreleased changes\.\n\n## 1\.3\.0 — \d{4}-\d{2}-\d{2}\n\n- Added a thing\./);
  assert.equal(f.sh('git', 'log', '-1', '--format=%s'), 'Release v1.3.0');
  assert.equal(f.sh('git', 'status', '--porcelain'), '');
  assert.equal(sh(f.origin, 'git', 'rev-parse', 'main'), f.sh('git', 'rev-parse', 'HEAD'));
  assert.equal(f.kit(['check']).code, 0);
});

test('bump refuses a dirty tree, an older version or an existing tag, and --no-push stays local', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.repo, 'README.md'), 'edited\n');
  assert.equal(f.kit(['bump', 'patch']).code, 1);
  f.sh('git', 'checkout', '--', 'README.md');
  assert.equal(f.kit(['bump', '1.1.0']).code, 1);
  f.sh('git', 'tag', 'v1.2.1');
  assert.match(f.kit(['bump', 'patch']).err, /v1\.2\.1 already exists/);
  const pushedBefore = sh(f.origin, 'git', 'rev-parse', 'main');
  assert.equal(f.kit(['bump', '1.5.0', '--no-push']).code, 0);
  assert.equal(sh(f.origin, 'git', 'rev-parse', 'main'), pushedBefore);
  assert.equal(f.read('VERSION'), '1.5.0\n');
});

test('bump off the release branch commits without pushing', (t) => {
  const f = fixture(t);
  f.sh('git', 'checkout', '-q', '-b', 'feature');
  const result = f.kit(['bump', 'patch']);
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /merge this commit to main/);
  assert.notEqual(sh(f.origin, 'git', 'rev-parse', 'main'), f.sh('git', 'rev-parse', 'HEAD'));
});

test('check reports synced files that disagree with VERSION', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.repo, 'VERSION'), '1.3.0\n');
  const result = f.kit(['check']);
  assert.equal(result.code, 1);
  assert.match(result.err, /package\.json \(1\.2\.0\), README\.md \(1\.2\.0\)/);
});

test('plan releases a new version from main only, skips a tagged one and refuses going backwards', (t) => {
  const f = fixture(t);
  const outputs = join(f.base, 'outputs');
  writeFileSync(outputs, '');
  let result = f.kit(['plan'], { GITHUB_OUTPUT: outputs });
  assert.equal(result.code, 0, result.err);
  assert.match(readFileSync(outputs, 'utf8'), /version=1\.2\.0\ntag=v1\.2\.0\nnew=true\nrelease=true\nprerelease=false\n/);
  result = f.kit(['plan'], { GITHUB_REF: 'refs/pull/7/merge' });
  assert.match(result.out, /new=true\nrelease=false/);
  f.sh('git', 'tag', 'v1.2.0');
  f.sh('git', 'push', '-q', 'origin', 'v1.2.0');
  f.sh('git', 'tag', '-d', 'v1.2.0');
  result = f.kit(['plan']);
  assert.match(result.out, /already exists[\s\S]*new=false\nrelease=false/);
  f.sh('git', 'tag', 'v2.0.0');
  writeFileSync(join(f.repo, 'VERSION'), '1.9.0\n');
  result = f.kit(['plan']);
  assert.equal(result.code, 1);
  assert.match(result.err, /older than existing tag v2\.0\.0/);
});

test('verify runs setup and checks and stops on the first failure', (t) => {
  const f = fixture(t);
  assert.equal(f.kit(['verify']).code, 0);
  assert.equal(f.read('.ran'), 'setup\nverify\n');
  const failing = fixture(t, { config: { ...CONFIG, verify: [['node', '-e', 'process.exit(3)'], ['node', '-e', "require('fs').writeFileSync('.after','')"]] } });
  assert.equal(failing.kit(['verify']).code, 1);
  assert.equal(existsSync(join(failing.repo, '.after')), false);
});

test('package builds artifacts, checks them, and writes checksums and evidence', (t) => {
  const f = fixture(t);
  const result = f.kit(['package']);
  assert.equal(result.code, 0, result.err);
  const tgz = join(f.repo, 'dist', 'demo-pkg-1.2.0.tgz');
  assert.equal(readFileSync(tgz, 'utf8'), 'bytes of 1.2.0');
  const sum = createHash('sha256').update(readFileSync(tgz)).digest('hex');
  assert.equal(f.read('dist/SHA256SUMS'), `${sum}  demo-pkg-1.2.0.tgz\n`);
  assert.equal(f.read('.ran'), 'artifact demo-pkg-1.2.0.tgz\n');
  assert.match(f.read('dist/release-evidence.md'), new RegExp(`\\| \`demo-pkg-1\\.2\\.0\\.tgz\` \\| \`${sum}\` \\|`));
});

test('package syncs stale files for the artifact and warns', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.repo, 'VERSION'), '1.3.0\n');
  const result = f.kit(['package']);
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /::warning::Synced package\.json \(1\.2\.0\), README\.md \(1\.2\.0\) to 1\.3\.0/);
  assert.match(f.read('package.json'), /"version": "1\.3\.0"/);
});

test('publish needs a token, publishes once, and never writes the token to disk', (t) => {
  const f = fixture(t);
  assert.equal(f.kit(['package']).code, 0);
  let result = f.kit(['publish']);
  assert.equal(result.code, 1);
  assert.match(result.err, /NPM_TOKEN is not set/);
  assert.doesNotMatch(f.calls(), /npm publish/);
  result = f.kit(['publish'], { NPM_TOKEN: 'secret-token-value' });
  assert.equal(result.code, 0, result.err);
  assert.match(f.calls(), /npm publish .*demo-pkg-1\.2\.0\.tgz --access public/);
  assert.equal(readFileSync(join(f.state, 'npmrc'), 'utf8'), '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');
  assert.match(f.read('dist/release-evidence.md'), /npm: `demo-pkg@1\.2\.0`, integrity `sha512-/);
  result = f.kit(['publish'], { NPM_TOKEN: 'secret-token-value' });
  assert.match(result.out, /already on npm with identical bytes/);
  assert.equal(f.calls().match(/npm publish/g).length, 1);
});

test('publish refuses different published bytes; dry run and no registry publish nothing', (t) => {
  const f = fixture(t);
  assert.equal(f.kit(['package']).code, 0);
  assert.match(f.kit(['publish', '--dry']).out, /Dry run: would publish/);
  writeFileSync(join(f.state, 'published'), 'sha512-somethingelse');
  const result = f.kit(['publish'], { NPM_TOKEN: 'x' });
  assert.equal(result.code, 1);
  assert.match(result.err, /different bytes/);
  const none = fixture(t, { config: { ...CONFIG, publish: null } });
  assert.equal(none.kit(['package']).code, 0);
  assert.match(none.kit(['publish']).out, /No registry configured/);
  assert.doesNotMatch(f.calls() + none.calls(), /npm publish/);
});

test('github-release tags HEAD with changelog notes, evidence and assets, once', (t) => {
  const f = fixture(t);
  assert.equal(f.kit(['bump', 'minor']).code, 0);
  assert.equal(f.kit(['package']).code, 0);
  assert.match(f.kit(['github-release', '--dry']).out, /Dry run: would create v1\.3\.0/);
  assert.doesNotMatch(f.calls(), /release create/);
  const result = f.kit(['github-release']);
  assert.equal(result.code, 0, result.err);
  const head = f.sh('git', 'rev-parse', 'HEAD');
  assert.match(f.calls(), new RegExp(`gh release create v1\\.3\\.0 --target ${head} --title demo-pkg v1\\.3\\.0 --notes-file .+notes\\.md .+/dist/demo-pkg-1\\.3\\.0\\.tgz .+/dist/SHA256SUMS\\n`));
  assert.doesNotMatch(f.calls(), /--generate-notes/);
  const notes = readFileSync(join(f.state, 'notes.md'), 'utf8');
  assert.match(notes, /^- Added a thing\.\n\n## Verification/);
  assert.match(f.kit(['github-release']).out, /already exists/);
  assert.equal(f.calls().match(/release create/g).length, 1);
});

test('drift compares every kit file with the upstream copy', async (t) => {
  const f = fixture(t, { config: { ...CONFIG, kitUpstream: 'owner/source' } });
  for (const path of KIT_FILES.slice(1)) {
    mkdirSync(dirname(join(f.repo, path)), { recursive: true });
    copyFileSync(join(repoRoot, path), join(f.repo, path));
  }
  const served = Object.fromEntries(KIT_FILES.map((path) => [`/${path}`, readFileSync(join(f.repo, path))]));
  const server = createServer((req, res) => { const body = served[req.url]; res.writeHead(body ? 200 : 404); res.end(body); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  // Asynchronous, so this process keeps serving the upstream files meanwhile.
  const drift = () => new Promise((done) => execFile(process.execPath, ['scripts/release-kit/release.mjs', 'drift'],
    { cwd: f.repo, env: { ...process.env, RELEASE_KIT_UPSTREAM_URL: url } },
    (error, stdout, stderr) => done({ code: error ? error.code : 0, out: stdout, err: stderr })));
  let result = await drift();
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /matches owner\/source/);
  served['/.github/workflows/release.yml'] = Buffer.from('changed upstream\n');
  result = await drift();
  assert.equal(result.code, 1);
  assert.match(result.err, /differs from owner\/source: \.github\/workflows\/release\.yml/);
  const source = fixture(t, { config: { ...CONFIG, kitSource: true } });
  assert.match(source.kit(['drift']).out, /source copy/);
});

test("this repository's release config and kit are complete and consistent", () => {
  for (const path of KIT_FILES) assert.ok(existsSync(join(repoRoot, path)), `${path} is missing`);
  const result = spawnSync(process.execPath, [join(kitDir, 'release.mjs'), 'check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
