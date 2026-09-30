import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = join(import.meta.dir, "..", "scripts", "set-npm-token.sh");
const TOKEN = "npm_SecretValue123";
let dir: string;

// Stub gh and npm record their arguments; gh keeps the secret it was given on stdin.
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "set npm token "));
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env bash
echo "gh $*" >> "$STUB/log"
case "$1 $2" in
  "auth status") [ -f "$STUB/logged-out" ] && exit 1; exit 0 ;;
  "repo view") exit 0 ;;
  "secret set") cat > "$STUB/secret" ;;
  "secret list") [ -f "$STUB/secret" ] && printf 'NPM_TOKEN\\t2026-09-27T00:00:00Z\\n' ;;
esac
`);
  writeFileSync(join(dir, "npm"), `#!/usr/bin/env bash
echo "npm $*" >> "$STUB/log"
cp "$NPM_CONFIG_USERCONFIG" "$STUB/npmrc"
[ "$NPM_TOKEN" = "${TOKEN}" ] && echo khangtoh || exit 1
`);
  chmodSync(join(dir, "gh"), 0o755);
  chmodSync(join(dir, "npm"), 0o755);
  writeFileSync(join(dir, "log"), "");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(input: string, ...args: string[]) {
  const r = spawnSync("bash", [script, ...args], {
    input, encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, STUB: dir, NPM_TOKEN: "" },
  });
  return { code: r.status, out: r.stdout, err: r.stderr, log: readFileSync(join(dir, "log"), "utf8") };
}
const secret = () => { try { return readFileSync(join(dir, "secret"), "utf8"); } catch { return undefined; } };

test("verifies the token with npm, stores it through stdin and confirms it is listed", () => {
  const r = run(`${TOKEN}\n`);
  expect(r.code).toBe(0);
  expect(r.out).toContain("npm accepts the token for user: khangtoh");
  expect(r.out).toContain("NPM_TOKEN is set on khangtoh/specloop");
  expect(secret()).toBe(TOKEN);
  expect(r.log).toContain("gh secret set NPM_TOKEN --repo khangtoh/specloop");
  expect(readFileSync(join(dir, "npmrc"), "utf8")).toBe("//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");
  expect(r.log + r.out + r.err).not.toContain(TOKEN);
});

test("a token npm rejects is not stored", () => {
  const r = run("npm_wrong\n");
  expect(r.code).toBe(1);
  expect(r.err).toContain("npm rejected the token");
  expect(secret()).toBeUndefined();
  expect(r.log).not.toContain("secret set");
});

test("empty input, a logged-out gh and unknown options change nothing", () => {
  expect(run("\n").err).toContain("No token given");
  writeFileSync(join(dir, "logged-out"), "");
  expect(run(`${TOKEN}\n`).err).toContain("gh auth login");
  rmSync(join(dir, "logged-out"));
  expect(run(`${TOKEN}\n`, "--bogus").code).toBe(2);
  expect(secret()).toBeUndefined();
});

test("--repo and --skip-verify target another repository without calling npm", () => {
  const r = run(`  ${TOKEN}  \n`, "--repo", "someone/else", "--skip-verify");
  expect(r.code).toBe(0);
  expect(secret()).toBe(TOKEN);
  expect(r.log).toContain("gh secret set NPM_TOKEN --repo someone/else");
  expect(r.log).not.toContain("npm ");
});
