In any repo under `~/code`: "This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it."

As a general principle, prefer desinging systems such that errors are thrown as soon as possible (example: if an env var is required for a network call, check for it and throw on startup instead of waiting to check and error on runtime when the request is fired)

Avoid writing code comments unless they are really valuable. Really valuable code commends document decisions, unexpected behavior or give additional context for the particular decision. Comments that have no value: explaining code, headers, decorative breaks, could easily be inferred by reading the code

when comitting code use the `AI_COMITTER_NAME='your-model-name-and-version' gai <conventional commit message>` (a script on PATH, `~/bin/gai`, that runs `git commit -m ...` with proper attribution, so it works in non-interactive shells). example `AI_COMITTER_NAME=opus-4.6 gai 'feat: ...'`

Prefer using `trash` instead of `rm` (it works exactly the same as `rm` but moves the files to the trash so they can be recovered in case of error)

@~/.claude/pstack-models.md

In T3 Code, start child tasks with the t3-code `delegate_task` tool (use `isolation: "worktree"` when the child needs its own checkout, `target` for a different provider/model, `mode: "async"`, whose completion wakes you). Never use `t3_thread_launch` or `create_threads` for subagents; those create top-level threads in my thread list. Only create top-level threads when I explicitly ask for a new/separate/top-level thread.

Never use subagents or delegates to write code unless I explicitly ask for one. Write all code yourself, in the main thread. This overrides any skill or playbook that says to delegate implementation, including pstack's. Subagents are fine for review, research, and competing candidates (arena, architect).

When I do ask for a coding delegate:
- Use `delegate_task` with `isolation: "worktree"`. Never give the `Agent` tool `isolation: "worktree"`: it skips the setup script and blocks shell commands and `gai`.
- The child writes and verifies its own code, and never delegates further.
- While async children run, end your turn. Don't poll or post "waiting" updates.

Done means you ran it the way I will, not a proxy for it:
- Run the real entry point (`./scripts/export.ts`, not `bun scripts/export.ts`), the built or deployed app, and the real interaction: tap the button, submit the form, read the output. A screenshot proves a layout, not a behavior. Check web UI at desktop and phone widths.
- Never make a path the default, push it, or call it done before it has worked once end to end. If it can't work, say so instead of building it.
- "I can't test this" is a problem to solve with the simulator, T3's device and preview tools, UI automation, or computer use, not a finding. Only a check that needs a physical device comes to me, as exact steps.
- A change to entitlements, `Info.plist`, signing, app extensions, or a stored-data schema can crash the installed app while every test passes. Prove an existing install upgrades and launches, with a Release build when the repo can make one.
- Your final message says what you ran and what you saw, and names anything you could not verify.

Finish what you start without waiting for me:
- Commit and push to the branch the thread is on, `master` included. I picked that branch, so don't create or switch branches unless I ask.
- On a branch other than `master`, open a PR and merge it once checks pass and the automatic Codex review is in, unless I said not to. Codex reviews every PR when it opens, so never request a review. Fix every real finding and resolve its thread before merging.
- Skip the PR when the change has no logic in it (docs, fixtures, seed data, copy) and wouldn't surprise anyone: pushing the branch is enough.
- Then clean up what you started: servers, simulators, scratch files, and whatever the repo's teardown and T3 Code don't remove.
- Do steps yourself instead of handing them to me: mint tokens with a CLI or API, run app exports, dismiss dialogs, create cloud resources. Hand me only what needs my hands or an account you can't reach, with exact steps.
- Fix small bugs and friction you hit along the way in the same change, unless your brief says to report them as followups.
- Don't ask before reversible work. The exceptions: never invent or substitute something I specified (a name, an id, an ingredient). If it's unavailable, stop and tell me. Ask before anything irreversible, such as deleting data or writing to production without a dry run.

Environment variables: store every env var you create or change in `env-manager` (the `.env` schema plus its values in every environment it applies to, such as `dev` and `prod`), never only in a local file, a cloud console, or a host's secret store. Push a non-breaking env change (a new variable, a new optional value, a rotated key the code reads the same way) right away, without asking: `env-manager up`, then whatever the project uses to sync hosts (for example `bun scripts/secrets.ts push` for Worker secrets). A breaking change (a rename, a removal, or a value the deployed code cannot handle) ships together with the code that needs it.

Worktrees and simulators in T3 Code:
- Automatic, so don't do it by hand: T3 runs `agent-t3-worktree setup` when it creates a worktree (dependencies, the worktree's own ports, offline env files, the repo's `worktree:setup` script). Session start and the commit hook rerun it when something is missing. When a thread settles, which merging its PR does, `agent-t3-worktree settle` stops its servers and simulators, drops build caches, and removes merged worktrees with their branches and simulators.
- Yours: never create worktrees yourself (`git worktree add`, the `Agent` tool's isolation); use `delegate_task` with `isolation: "worktree"`. If `agent-t3-worktree check` fails, fix what it prints. Before your last turn, stop servers you started and trash your `/tmp` scratch. Leave the tree clean: an untracked file keeps the worktree from being removed.
- iOS: `agent-simulator udid` prints your worktree's simulator, and boots wait for room on the Mac (exit 3 means rerun). Drive it only with the command `device_open` returns, tapping by label (`press 'label="Save"' --settle`), never with a wrapper of your own.

When you mention a ProcrastiMate task to me (in chat, a PR, a commit, a doc, or a task comment), write it as a markdown link with the task's title as the text, pointing at the task in the app: `[<title>](https://procrastimate.stf.lol/inbox?task=<id>)`. `procrastimate link <id>...` prints these, and `procrastimate tasks <project>` already shows each title that way. I'm always signed in, so never use a bare task id or a public link for me. Publish one (`procrastimate link --public`) only when I ask to share a task with someone else.

Never create a GitHub issue unless I explicitly told you to, in this conversation or in the repo's own instructions (its AGENTS.md, CLAUDE.md, or skills). Delegated children follow the same rule. Never file a bug report on a repo I don't own, such as an upstream tool or library; mention it in one short line only if it blocked you or is a meaningful bug, otherwise skip it.

FYI: GitHub CLI now supports image uploads if needed via `gh issue create|edit|comment --attach ./img.png#alt`
