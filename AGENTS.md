# ai-files

Stefan's agent configuration for this machine, kept in one place and symlinked to where each tool reads it. `README.md` lists every file and its link targets.

- `GLOBAL_AGENTS.md` is the global instructions file every agent tool loads (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and others). This file is only about this repo.
- `skills/<name>/` holds personal skills. `setup-skills.ts` links them into each agent's skill directory, installs the third-party skills as plugins, and trashes anything else it finds there; the README's Skills section lists the set. A skill that needs repo-specific settings reads them from a file in that repo, as `task-orchestrator` reads `.agents/task-orchestrator.md`.
- `claude/` holds Claude Code-only files (hooks).
- `t3-pstack/models.md` is the t3-pstack model sheet. Check edits with `node <plugin root>/skills/setup-pstack/scripts/t3-sheet.mjs t3-pstack/models.md <catalog.json>`, or rerun `/t3-pstack:setup-pstack`.
- `t3/` holds T3 Code's settings. Two files are linked into `~/.t3/userdata/`; `settings.json` is copied by `t3/sync.ts capture` and `apply`. The README's T3 Code section explains why.
- `setup.sh` creates every link and runs `setup-skills.ts` and `t3/sync.ts apply`. Rerun it after adding a skill or a link target, and add the target to `setup.sh` and the README table.

A CLI more than one skill or repo could use, such as `procrastimate`, goes in `~/code/scripts`, which puts it on PATH; its `AGENTS.md` has the rules. A script only one skill needs lives in that skill's `scripts/`, with no dependencies, and follows the same rules: `--help`, a usage error that prints the help, `--dry-run` on anything with side effects, and errors that name the fix.

The paths elsewhere are symlinks into this repo, so an edit anywhere lands here. Single user, no PRs: commit to master and push. Secrets never go in git; the repo is public.
