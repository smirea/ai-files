#!/usr/bin/env bun
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

const usage = `Usage: check-config.ts

Validates the current repo's .agents/task-orchestrator.md, the task-orchestrator skill's repo config, and prints
its frontmatter as JSON. Run it from the repo's main checkout.`;

const args = Bun.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exit(0);
}
if (args.length) fail(`unexpected arguments: ${args.join(' ')}\n\n${usage}`);

const keys = ['project', 'gc', 'teardown', 'ship'] as const;
const parts = ['# Orchestrator', '# Worker'];

const top = git(process.cwd(), 'rev-parse', '--show-toplevel');
const repo = dirname(git(top, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
if (realpathSync(top) !== realpathSync(repo)) fail(`run from the main checkout ${repo}, not the worktree ${top}`);
const path = join(repo, '.agents/task-orchestrator.md');
if (!existsSync(path))
  fail(`${path} is missing; this repo isn't set up for the task orchestrator. ~/code/ai-files/README.md describes the file`);
const match = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) fail(`${path} must start with a --- frontmatter block`);
const meta = Bun.YAML.parse(match[1]!) as Record<string, unknown>;
for (const key of keys)
  if (typeof meta[key] !== 'string' || !meta[key]) fail(`${path}: frontmatter needs a string \`${key}\``);
const lines = match[2]!.split('\n');
for (const part of parts) if (!lines.includes(part)) fail(`${path}: needs a \`${part}\` heading`);
for (const key of ['gc', 'teardown', 'ship'] as const) {
  const [program, ...words] = (meta[key] as string).split(' ');
  if (!Bun.which(program!)) fail(`${path}: \`${key}\` runs ${program}, which isn't on PATH`);
  const script = words.find(word => word.includes('/'));
  if (script && !existsSync(join(repo, script))) fail(`${path}: \`${key}\` runs ${script}, which doesn't exist`);
}
if (Bun.spawnSync(['git', 'check-ignore', '-q', '.orchestrator'], { cwd: repo }).exitCode !== 0)
  fail(`add .orchestrator to ${repo}/.gitignore: the session files live there`);
if (!Bun.which('procrastimate')) fail('procrastimate isn\'t on PATH; run `bun src/setup.ts` in ~/code/scripts');
const tasks = Bun.spawnSync(['procrastimate', 'tasks', meta.project as string], { stderr: 'pipe' });
if (tasks.exitCode !== 0) fail(`${path}: \`project\`: ${tasks.stderr.toString().trim()}`);
console.log(JSON.stringify(Object.fromEntries(keys.map(key => [key, meta[key]])), null, 2));

function git(cwd: string, ...gitArgs: string[]): string {
  const result = Bun.spawnSync(['git', ...gitArgs], { cwd, stderr: 'pipe' });
  if (result.exitCode !== 0) fail(`git ${gitArgs.join(' ')}: ${result.stderr.toString().trim()}`);
  return result.stdout.toString().trim();
}

function fail(message: string): never {
  console.error(`check-config: ${message}`);
  process.exit(1);
}
