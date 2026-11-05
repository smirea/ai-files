# ai-files

Stefan's agent configuration for this machine, kept in one place and symlinked to where each tool reads it. `README.md` lists every file and its link targets.

- `GLOBAL_AGENTS.md` is the global instructions file every agent tool loads (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and others). This file is only about this repo.
- `skills/<name>/` holds personal skills, linked into `~/.claude/skills` and `~/.agents/skills`. A skill that needs repo-specific settings reads them from a file in that repo, as `task-orchestrator` reads `.agents/task-orchestrator.md`.
- `claude/` holds Claude Code-only files (pstack model overrides, hooks).
- `package.json` holds the dependencies skill scripts import (commander for CLIs); `setup.sh` installs them.
- `setup.sh` creates every link. Rerun it after adding a skill or a link target, and add the target to `setup.sh` and the README table.

The paths elsewhere are symlinks into this repo, so an edit anywhere lands here. Single user, no PRs: commit to master and push. Secrets go in env-manager (project `ai-files`), never in git; the repo is public.
