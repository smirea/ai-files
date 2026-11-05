# ai-files

Stefan's agent configuration for this machine, kept in one place and symlinked to where each tool reads it. `README.md` lists every file and its link targets.

- `GLOBAL_AGENTS.md` is the global instructions file every agent tool loads (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and others). This file is only about this repo.
- `skills/<name>/` holds personal skills, linked into `~/.claude/skills` and `~/.agents/skills`. A skill that needs repo-specific settings reads them from a file in that repo, as `task-orchestrator` reads `.agents/task-orchestrator.md`.
- `claude/` holds Claude Code-only files (pstack model overrides, hooks).
- `package.json` holds the dependencies skill scripts import (commander for CLIs); `setup.sh` installs them.
- `setup.sh` creates every link. Rerun it after adding a skill or a link target, and add the target to `setup.sh` and the README table.

Scripts are run by agents that have never seen them, so each one must explain itself:

- A script is an executable named for what it drives (`procrastimate.ts`, not `pm.ts`). TypeScript ones keep the `.ts`, so editors and tsc check them, and start with `#!/usr/bin/env bun`.
- `--help` works on the script and on every command, and running it with no arguments or a bad one prints the relevant help. Build CLIs with commander (`@commander-js/extra-typings`), which does this.
- Every command that writes, deletes, or has other side effects takes `--dry-run`: it does the reads, then prints the writes it would make, and makes none.
- An error says what failed and how to fix it: the command to run, the file to edit, or the valid values.

The paths elsewhere are symlinks into this repo, so an edit anywhere lands here. Single user, no PRs: commit to master and push. Secrets go in env-manager (project `ai-files`), never in git; the repo is public.
