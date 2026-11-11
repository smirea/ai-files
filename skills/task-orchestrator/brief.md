# How to work

You own this job end to end: the PR, its checks, the merge, and master's runs after the merge. Stefan authorized you to merge your PR without asking. The orchestrator doesn't watch your PR or CI and learns only what your report says, so report `merged` only once master is green with your change in it.

This file holds the rules every repo shares. The `# Worker` part of `.agents/task-orchestrator.md` in your worktree holds this repo's setup, verification, and shipping rules, and its frontmatter names the `ship` command. Read it right after this file. Where the two differ, the repo file wins.

## Setup

- Read `AGENTS.md`, the docs the `# Worker` part names, the area docs the brief names, and the `AGENTS.md` of every folder you change. They are binding. A decision your work introduces or revises goes in its area doc in this PR.
- This file, the repo config, and those docs can go stale. When an instruction is wrong (a script that moved, a flag that changed, a tool you do have), do what is right and fix the instruction: a repo file in this PR, this file on `~/code/ai-files` master. Say so in your report's `summary`.
- Setup is automatic and heals itself: T3 ran `agent-t3-worktree setup` when it created your worktree, and the session-start hook and pre-commit rerun it when something is missing. Don't run it by hand. T3 owns the branch name; never rename it.
- Never read or copy the main checkout's env files unless the `# Worker` part names an exception, and never run `env-manager up`, `down`, or `env set` before your PR merges. A new setting goes in the root `.env` schema with a harmless default, since worktrees and CI build from the defaults (`env-manager gen --local`). Its real values go up only after the `ship` command exits 0, from your worktree: see "After the merge".
- Never touch the main checkout or another worktree's servers or simulators. Anything else you need from outside, such as a Sentry event, is in the brief; if it isn't, ask for it with `needs_input`.

## Shell

- Never end your turn while anything you started still runs: a background command, a Monitor, a server, a simulator session, or a review or other subagent. Nothing wakes you once the turn ends, not even a Monitor or background-task notification, and the orchestrator has to restart you. Run subagents and reviews in the foreground.
- A command that may outlive the 600 s tool limit, such as an eval, runs detached with unbuffered output to a file (`nohup cmd > out.log 2>&1 &`), and you wait for it in foreground calls of under 600 s each. Background jobs the harness starts are killed after 30 minutes.
- Never pipe the `ship` command, `git push`, or a test run through `tail`/`head`: the pipe hides the exit status and the error. If the output is long, redirect it to a file and read the end.
- Stop every server you start, by its pid. Never `pkill -f` a pattern another worktree could match: one worker's `pkill` once stopped its siblings' dev servers. Don't chain `sleep` before another command, because a hook blocks it.
- Never use `git stash`; it is shared with every worktree. Use a WIP commit. For a baseline on master, `git worktree add` a throwaway checkout instead. Use `trash`, not `rm`.
- The machine is loaded, so run only the tests that cover the change. A timeout that passes when rerun alone is load; a failure that repeats is yours.
- Git hooks can't be skipped (a Claude Code hook blocks it). A failing hook gets its cause fixed in this PR. A flaky test is a bad test: fix why it flakes, and never add retries or sleeps. "Fails only in this environment" is a bug to fix too, not a reason to move on.

## Done means

- You proved the change the way Stefan will use it: the tap and what it does, the command he runs, the page at desktop and phone widths. A screenshot proves a layout, not a behavior, so drive the interaction.
- "I can't test this" holds only for the device-only checks the `# Worker` part lists. Anything else is a problem to solve, not a result.
- Never make a path the default, or merge it, before it has worked once end to end.
- A change to entitlements, `Info.plist`, app extensions, signing, or stored data can crash the installed app at launch while every test passes. Prove that an existing install upgrades and launches with its data; the `# Worker` part says how in this repo.
- The report's `verification` says what you ran, what you saw, and what you could not verify.

## PR

- Open one PR whose description starts with the `# Tasks being addressed` section the brief gives you, verbatim. Attach screenshots with `gh pr create --attach <file>` (UI changes only, 2 to 4). Then call `link_pull_request` with the PR URL.
- Loop the `ship` command in the foreground with a 600000 ms tool timeout. Its last line is `pr-ship exit <n>`:
  - `0`: merged.
  - `1`: fix the failing checks, or fix or answer each review thread and resolve it. Then push and rerun. If a failing check also fails on master or other PRs, rerun it once with `gh run rerun --failed`; if it fails again, fix it in this PR. End with `blocked` and the run link only when the cause is outside this repo.
  - `2`: another job landed first. Before resolving, read what it changed and why: `git log origin/master -- <conflicted file>` and `gh pr view <number>` for each PR that touched it, so you keep both intents instead of one side. Rebase onto `origin/master`, rerun only the checks that cover the conflicted files, push, rerun. During a rebase, `--theirs` is your branch and `--ours` is master.
  - `3`: rerun.
- Wait on PR checks only with the `ship` command, never `gh run watch`. Treat review-bot comments skeptically: fix real bugs, and dismiss noise with a concrete reason in your reply.
- A job the brief marks as research, or "don't merge": open a draft PR, skip the `ship` command, and end with `needs_input`, the findings in `summary`, and the decisions you need in `questions`.

## After the merge

- Master's runs for your merge are yours: CI, plus any post-merge run the `# Worker` part lists. Find them with `gh run list --branch master --commit "$(gh pr view --json mergeCommit -q .mergeCommit.oid)"`, and wait on each with `timeout 540 gh run watch <id> --exit-status` in a foreground call, rerunning it until the run completes. TestFlight takes over 20 minutes, and a call that outlives the tool limit moves to the background and ends your turn without a report, so never run the watch unbounded, with `run_in_background`, or through a Monitor. A run that a newer merge cancelled is that merge's to watch, since its run includes your commit: you're done with it.
- A red run is yours to fix, even when it comes from your merge combined with a sibling's (two PRs that each pass alone but both declare the same type). Fix it in a follow-up PR from your worktree, on a new branch off `origin/master`, shipped the same way, and put its URL in `summary`. End with `blocked` and the run link only when the cause is outside this repo.
- A new setting: upload its values now, from your worktree. For each environment it needs, `env-manager env set dev` (or `prod`), which downloads that environment's real values over your placeholders, set the value in the root `.env.local`, then `env-manager up`. Never `up` without that `env set` first: it would upload the schema defaults over the real values. Both commands make a local "chore: env manager update" commit; never push it, since teardown deletes the branch. The `# Worker` part says how this repo syncs a setting to its hosts. A value only Stefan has (a key from a dashboard) is a `needs_input` instead.
- Clean up what you started: stop your servers by pid, close any `agent-device` session, shut your simulator down with `device_close`, and `trash` scratch files outside the worktree. Leave the worktree, the simulators it claimed, its data, and its branches: the orchestrator's teardown removes them.

## Scope: fix what you find

Stefan wants to hear about a problem only when he must. Everything real you find along the way is yours to fix, as more commits on this branch with the same proof as the task: a bug, a weird interaction, bad UX, jank, a performance issue, a gap the task needs, a flaky test, dev-tooling friction (a slow command, a flaky tool, a manual step), a stale doc. Skip imagined edge cases that cost more than they're worth, and don't report them.

- The brief names your footprint and your neighbors'. Your footprint is a guide, not a fence: work wherever the job takes you. Its pointers are leads from the orchestrator's look, not a plan: verify them, and the approach is yours.
- Check with the orchestrator only before a fix that reaches into a neighbor's footprint: end with `coordinate`, the planned change and the files it touches in `questions`, and your worktree as it is. You resume with its answer. Anything else needs no check; read the decision docs a fix touches before you make it.
- Only three kinds of finding leave this branch, in `outOfScope`: an architecture change the decision docs don't settle, a problem in an underlying dependency (another repo such as `sync-engine` or `env-manager`, an Apple framework, a hosted service), and a product decision only Stefan can make. A device-only check joins them only when the change can't be trusted without it. Each becomes a `needs-input` task Stefan has to answer, so write the decision or the steps he needs, not the history. Anything else, fix.
- If you need input on the job itself, end with `needs_input`. Don't message the orchestrator any other way mid-job.
- End with only this JSON:

```json
{"status": "merged" | "coordinate" | "needs_input" | "blocked", "pr": "<url or null>", "branch": "...", "worktree": "<absolute path>", "tasks": {"done": ["<id>"], "not_done": [{"id": "...", "reason": "..."}]}, "summary": "<2-4 sentences: what changed, clients covered>", "verification": "<what you ran, what you saw, what you could not verify>", "questions": "<for coordinate/needs_input/blocked>", "outOfScope": [{"title": "...", "description": "...", "kind": "architecture" | "dependency" | "product" | "device-check", "relatedTaskId": "..."}]}
```
