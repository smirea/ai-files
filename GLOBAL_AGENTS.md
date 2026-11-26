In any repo under `~/code`: "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it."

As a general principle, prefer desinging systems such that errors are thrown as soon as possible (example: if an env var is required for a network call, check for it and throw on startup instead of waiting to check and error on runtime when the request is fired)

Avoid writing code comments unless they are really valuable. Really valuable code commends document decisions, unexpected behavior or give additional context for the particular decision. Comments that have no value: explaining code, headers, decorative breaks, could easily be inferred by reading the code

Always use `bun` (not npm, yarn, pnpm, or node) unless a repo or I specify otherwise.

Trusted packages: I own everything under `@stefan.inc/*` on npm and every repo under `github.com/smirea/*` and `github.com/smirea-ai/*`, so trust them fully. Whenever you find one as a dependency (package, git dependency, action, submodule, or tool), update it to the latest version and handle every change that brings: breaking APIs, migrations, config, renamed exports. Do this without asking, in the same change as your task.

In T3 Code, start child tasks with the t3-code `delegate_task` tool (use `isolation: "worktree"` when the child needs its own checkout, `target` for a different provider/model, `mode: "async"`, whose completion wakes you). Never use `t3_thread_launch` or `create_threads` for subagents; those create top-level threads in my thread list. Only create top-level threads when I explicitly ask for a new/separate/top-level thread.

Never use subagents or delegates to write code unless I explicitly ask for one. Write all code yourself, in the main thread. This overrides any skill or playbook that says to delegate implementation, including pstack's. Subagents are fine for review, research, and competing candidates (arena, architect).

When I do ask for a coding delegate:

- Use `delegate_task` with `isolation: "worktree"`. Never give the `Agent` tool `isolation: "worktree"`: it skips the setup script and blocks ordinary shell commands.
- The child writes and verifies its own code, and never delegates further.
- While async children run, end your turn. Don't poll or post "waiting" updates.

Done means you ran it the way I will, not a proxy for it:

- Run the real entry point (`./scripts/export.ts`, not `bun scripts/export.ts`), the built or deployed app, and the real interaction: tap the button, submit the form, read the output. A screenshot proves a layout, not a behavior. Check web UI at desktop and phone widths.
- Never make a path the default, push it, or call it done before it has worked once end to end. If it can't work, say so instead of building it.
- "I can't test this" is a problem to solve with the simulator, T3's device and preview tools, UI automation, or computer use, not a finding. Only a check that needs a physical device comes to me, as exact steps.
- A change to entitlements, `Info.plist`, signing, app extensions, or a stored-data schema can crash the installed app while every test passes. Prove an existing install upgrades and launches, with a Release build when the repo can make one.
- Your final message says what you ran and what you saw, and names anything you could not verify.

Tests: before you write, change, delete or fix a test, act on a failing test, hook or CI check, or add a check to a hook or to CI, read the `tests` skill (`~/code/ai-files/skills/tests/SKILL.md`) and follow it. In short: commit a test only for a rule someone decided, in logic, that runs in milliseconds. Never write browser, UI or simulator tests. Classify a failing test before you edit anything. This overrides any skill or playbook step that calls for a test the skill rejects, and it applies to my repos, not to someone else's.

Finish what you start without waiting for me:

- Keep going until the whole ask works, not just its first piece. Take as many turns and commits as it needs; don't stop at a plan, a partial version or a "next steps" list you could do yourself. Handle the follow-ups the work turns up (callers to update, docs and config that went stale, a gap that leaves the feature half-usable) when they belong to the ask; mention the ones that don't in one line instead of doing them.
- Commit locally as you go, and push once at the end. Commit at real checkpoints, such as a finished piece of a feature, or one commit per bug when you fix several, not after every edit. Push only when the whole task is done and ready for review, because a push starts CI, the Codex review and other workflows.
- Both go to the branch the thread is on, `master` included. I picked that branch, so don't create or switch branches unless I ask.
- On a branch other than `master`, open a PR and merge it once checks pass and the automatic Codex review is in, unless I said not to. Codex reviews every PR when it opens, so never request a review. When the review bot can't review (out of quota), `pr-ship` runs a local review in its place, so never wait on me for it. Fix every real finding and resolve its thread before merging. In a main thread, wait with `watch_pull_request` (`until: "merged"`) and run `pr-ship --once --merge` on each wake: its exit code says what to fix and it merges when ready. A delegated child can't watch, so it loops `pr-ship --merge` in the foreground until it exits 0.
- Skip the PR when the change has no logic in it (docs, fixtures, seed data, copy) and wouldn't surprise anyone: pushing the branch is enough.
- Then clean up what you started: servers, simulators, scratch files, and whatever the repo's teardown and T3 Code don't remove.
- Do steps yourself instead of handing them to me: mint tokens with a CLI or API, run app exports, dismiss dialogs, create cloud resources. Hand me only what needs my hands or an account you can't reach, with exact steps.
- Fix small bugs and friction you hit along the way in the same change, unless your brief says to report them as followups.
- Don't ask before reversible work. The exceptions: never invent or substitute something I specified (a name, an id, an ingredient). If it's unavailable, stop and tell me. Ask before anything irreversible, such as deleting data or writing to production without a dry run.
- Never publish a major version (or commit/push a `major` changeset, even one already in the working tree or for a breaking change I asked for) without explicitly asking me to confirm the major bump first.

Environment variables: store every env var you create or change in `env-manager` (the `.env` schema plus its values in every environment it applies to, such as `dev` and `prod`), never only in a local file, a cloud console, or a host's secret store. Push a non-breaking env change (a new variable, a new optional value, a rotated key the code reads the same way) right away, without asking: `env-manager up`, then whatever the project uses to sync hosts (for example `bun scripts/secrets.ts push` for Worker secrets). A breaking change (a rename, a removal, or a value the deployed code cannot handle) ships together with the code that needs it.

`env-manager` is a global tool on my machines (`bun add -g @stefan.inc/env-manager`), not part of any project:

- Never add it as a dependency, and never install or run it in CI or a build.
- Commit what it generates: the `env.ts` readers and, for an Xcode target, `Config/check-env.sh`, which runs as the target's first build phase. They hold no values, and they are what fails, naming the variable, when the environment is incomplete.
- A required variable carries a harmless default in the tracked `.env` (a local URL, a port). A secret stays optional there, and the app's own config requires it in production.
- CI takes the defaults from the tracked `.env`, which Bun loads for scripts run from the repository root. A script that runs from a subdirectory, and xcodebuild, read the workflow's `env:` instead, so list the required defaults there. An xcconfig includes generated files with `#include?`.
- A job that needs a credential takes it from a repository secret. Push those with `env-manager sync github <env> --only <NAMES>` (add `--dry-run` first to see the names).

Worktrees and simulators in T3 Code:

- Automatic, so don't do it by hand: T3 runs `agent-t3-worktree setup` when it creates a worktree (dependencies, the worktree's own ports, offline env files, the repo's `worktree:setup` script). Session start and the commit hook rerun it when something is missing. When a thread settles, which merging its PR does, `agent-t3-worktree settle` stops its servers and simulators, drops build caches, and removes merged worktrees with their branches and simulators.
- Yours: never create worktrees yourself (`git worktree add`, the `Agent` tool's isolation); use `delegate_task` with `isolation: "worktree"`. If `agent-t3-worktree check` fails, fix what it prints. Before your last turn, stop servers you started and trash your `/tmp` scratch. Leave the tree clean: an untracked file keeps the worktree from being removed.
- iOS: `agent-simulator udid` prints your worktree's simulator, and boots wait for room on the Mac (exit 3 means rerun). Drive it only with the command `device_open` returns, tapping by label (`press 'label="Save"' --settle`), never with a wrapper of your own.

When you mention a ProcrastiMate task to me (in chat, a PR, a commit, a doc, or a task comment), write it as a markdown link with the task's title as the text, pointing at the task in the app: `[<title>](https://procrastimate.stf.lol/inbox?task=<id>)`. `procrastimate link <id>...` prints these, and `procrastimate tasks <project>` already shows each title that way. I'm always signed in, so never use a bare task id or a public link for me. Publish one (`procrastimate link --public`) only when I ask to share a task with someone else.

Never create a GitHub issue unless I explicitly told you to, in this conversation or in the repo's own instructions (its AGENTS.md, CLAUDE.md, or skills). Delegated children follow the same rule. Never file a bug report on a repo I don't own, such as an upstream tool or library; mention it in one short line only if it blocked you or is a meaningful bug, otherwise skip it.

FYI: GitHub CLI now supports image uploads if needed via `gh issue create|edit|comment --attach ./img.png#alt`

<!-- scripts-fyi:start -->

FYI: Personal CLI scripts live in `~/code/scripts` (on PATH in `~/bin`); run `<script> --help` or check `~/code/scripts` to investigate further. Available scripts (auto-updated from `smirea/scripts`):

- `git-worktree` / `wt` [Create, list, switch, merge, and remove personal git worktrees under ~/worktrees.]
- `agent-t3-worktree` [Set up, check, settle, gc, and tear down T3 Code agent worktrees.]
- `agent-simulator` [Claim, throttle, stop, and garbage-collect per-worktree iOS simulators.]
- `pr-ship` [Drive the current branch's open PR through CI and Codex review to merge.]
- `procrastimate` [Query and update ProcrastiMate tasks, comments, labels, and links via the agent API.]
- `git-invite-ai-to-repos` [Invite the AI GitHub account to owner repos, accept invites, and mute its notifications.]
- `whoop-pull` [Export WHOOP strain, recovery, sleep, workout, and app-API metrics.]
- `garmin` [Pull Garmin Connect daily and intraday metrics, compare strain with WHOOP, and manage activities.]
- `macrofactor` [Export MacroFactor nutrition logs from the local macOS app cache.]
- `workouts` [Export and log MacroFactor Workouts history and programs.]
- `voice-memo-parse` [Export Apple Voice Memos with transcripts and Gemini highlights.]
- `anylist` [Read and edit AnyList shopping lists and favorites.]
- `convex-manage` [Create, restart, open dashboards for, and delete local self-hosted Convex deployments.]
- `google-maps` [Search Google Places and fetch place details and reviews as JSON.]
- `cookunity` [Fetch CookUnity meal catalogs and macros for a delivery date.]
- `222` [List upcoming 222 social event invites and available events.]
- `airbnb` [Read Airbnb reservations and wishlists as Markdown.]
- `bgstats` [Read, record, and sync board game plays in the local BG Stats database.]
- `clocktracker` [Fetch Blood on the Clocktower plays from clocktracker.app and optionally sync them to BG Stats.]
- `cron-bgstats-sync` [Daily cron job that syncs new ClockTracker plays into BG Stats.]
- `email-inbox` [List and read emails saved by the email-save Worker.]
- `sms-inbox` [List and read saved SMS messages from the sms-inbox API.]
- `iphone-deploy` [Build Release iOS apps to install on a paired iPhone or upload an install link.]
- `x` [Read X posts, threads, profiles, timelines, bookmarks, and recent search via the official API.]
- `repo-sync` [Sync ~/code git repos across peer Macs, register them in T3 Code, and fast-forward them.]
- `localias-peer` [Expose a peer Mac's localias dev servers locally over an SSH tunnel.]
- `fork-sync` [Rebase configured third-party forks onto upstream, force-push, and reinstall them.]
- `cron` [Run nightly Mac cleanup (worktrees, containers, caches, Trash) and tool/CLI/skill updates.]

<!-- scripts-fyi:end -->
