#!/usr/bin/env bun
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const usage = `Usage: isolated.ts [--dry-run] <clone-dir> <command> [args...]

Runs a command inside a t3-bug-fix clone of T3 Code with every tie to the T3 Code
instances on this machine cut:

- drops all inherited T3CODE_* variables (the parent T3's thread id, CLI path, home,
  port, auth token) and VITE_HTTP_URL / VITE_WS_URL / VITE_DEV_SERVER_URL / PORT
- sets T3CODE_HOME to <clone-dir>/.t3, so state never lands in ~/.t3
- sets T3CODE_DEV_INSTANCE to t3-bug-fix-<clone name>, so dev ports hash away from
  the default ports other checkouts use

<clone-dir> must be a standalone clone (not a git worktree, not ~/code/t3code) with an
upstream remote pointing at pingdotgg/t3code. The command runs from <clone-dir>.
--dry-run prints the environment changes and the command without running it.

Examples:
  isolated.ts ~/code/t3code-bugs/foo vp i --frozen-lockfile -- --yes
  isolated.ts ~/code/t3code-bugs/foo vp run dev -- --dry-run
  isolated.ts ~/code/t3code-bugs/foo vp run migrate-dev-db -- --base-dir ~/code/t3code-bugs/foo/.t3`;

const fail = (message: string): never => {
  console.error(`isolated.ts: ${message}`);
  process.exit(1);
};

let args = Bun.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exit(0);
}
const dryRun = args[0] === '--dry-run';
if (dryRun) args = args.slice(1);
const [dirArg, ...command] = args;
if (!dirArg || command.length === 0) fail(`missing ${dirArg ? 'command' : '<clone-dir>'}\n\n${usage}`);

const dir = resolve(dirArg!);
if (!existsSync(dir)) fail(`${dir} does not exist; clone it first (SKILL.md step 1)`);
const gitPath = join(dir, '.git');
if (!existsSync(gitPath)) fail(`${dir} is not a git checkout`);
if (!lstatSync(gitPath).isDirectory())
  fail(`${dir} is a git worktree; use a standalone clone so it shares nothing with another checkout`);
const shared = join(homedir(), 'code', 't3code');
if (existsSync(shared) && realpathSync(dir) === realpathSync(shared))
  fail(`${dir} is the shared T3 Code checkout; make a fresh clone under ~/code/t3code-bugs/`);
const upstream = Bun.spawnSync(['git', '-C', dir, 'remote', 'get-url', 'upstream']).stdout.toString().trim();
if (!/[/:]pingdotgg\/t3code(\.git)?$/.test(upstream))
  fail(`${dir} has no upstream remote for pingdotgg/t3code (got "${upstream}"); run: git -C ${dir} remote add upstream git@github.com:pingdotgg/t3code.git`);

const dropped = Object.keys(process.env).filter(
  (key) => key.startsWith('T3CODE_') || ['VITE_HTTP_URL', 'VITE_WS_URL', 'VITE_DEV_SERVER_URL', 'PORT'].includes(key),
);
const env: Record<string, string | undefined> = { ...process.env };
for (const key of dropped) delete env[key];
const set = {
  T3CODE_HOME: join(dir, '.t3'),
  T3CODE_DEV_INSTANCE: `t3-bug-fix-${basename(dir)}`,
};
Object.assign(env, set);

if (dryRun) {
  console.log(`cwd:   ${dir}`);
  console.log(`unset: ${dropped.join(' ') || '(none)'}`);
  for (const [key, value] of Object.entries(set)) console.log(`set:   ${key}=${value}`);
  console.log(`run:   ${command.join(' ')}`);
  process.exit(0);
}

const child = Bun.spawn(command, { cwd: dir, env, stdio: ['inherit', 'inherit', 'inherit'] });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => child.kill(signal));
process.exit(await child.exited);
